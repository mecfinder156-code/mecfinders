'use strict';

/**
 * PM2 process manager config for running MecFinders in cluster mode.
 *
 *   npm i -g pm2
 *   pm2 start ecosystem.config.js --env production
 *   pm2 logs        # tail logs
 *   pm2 monit       # live dashboard
 *   pm2 reload mecfinders-api   # zero-downtime reload after a deploy
 *
 * IMPORTANT: running more than one instance REQUIRES REDIS_URL to be set (in
 * .env). Without it, each process has its own Socket.IO memory and its own
 * sweeper — realtime breaks across processes and dispatch double-fires. With
 * Redis, the Socket.IO adapter bridges processes and the leader-lock ensures
 * exactly one sweeper runs.
 *
 * `instances: 'max'` forks one worker per CPU core. On a 2-core box that's 2
 * processes; tune `instances` to a number if you want to reserve headroom.
 * Also size MONGO_MAX_POOL so instances * MONGO_MAX_POOL < Atlas conn limit.
 */

module.exports = {
  apps: [
    {
      name: 'mecfinders-api',
      script: 'server.js',
      instances: process.env.WEB_CONCURRENCY || 'max',
      exec_mode: 'cluster', // enables Node cluster + load balancing across cores
      max_memory_restart: '500M', // auto-restart a worker if it leaks past 500MB
      kill_timeout: 10000, // match the app's 10s graceful-shutdown window
      wait_ready: false,
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
