'use strict';

const http = require('http');

const config = require('./src/config');
const logger = require('./src/utils/logger');
const { connectDB, disconnectDB } = require('./src/config/database');
const redis = require('./src/config/redis');
const leaderLock = require('./src/utils/leaderLock');
const app = require('./src/app');
const { initSocket } = require('./src/realtime/socket');
const dispatchService = require('./src/modules/bookings/dispatch.service');

const startServer = async () => {
  // Initialise Redis first (optional). Enables multi-process scaling for the
  // Socket.IO adapter and the dispatch sweeper leader-lock. No-op without
  // REDIS_URL — the app then runs exactly as a single process.
  redis.initRedis();

  // Connect to database
  await connectDB(config.mongodb.uri);

  // Wrap the Express app in an HTTP server so Socket.IO can attach to it.
  const server = http.createServer(app);

  // Realtime layer for live Customer <-> Provider booking sync.
  initSocket(server);

  // Backend-controlled dispatch: expire timed-out mechanic offers and advance.
  dispatchService.startSweeper();

  server.listen(config.port, () => {
    logger.info(`Server running in ${config.env} mode on port ${config.port}`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    dispatchService.stopSweeper();
    server.close(async () => {
      // Release the sweeper leader-lock so another process takes over instantly
      // instead of waiting for the lock TTL to expire.
      await leaderLock.releaseSweeper();
      await redis.closeRedis();
      await disconnectDB();
      logger.info('Server closed');
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Rejection:', err);
    shutdown('UNHANDLED_REJECTION');
  });
};

startServer();
