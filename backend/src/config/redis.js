'use strict';

const Redis = require('ioredis');
const config = require('./index');
const logger = require('../utils/logger');

/**
 * Optional Redis layer.
 *
 * Redis is only used when REDIS_URL is set. It unlocks horizontal scaling:
 *   - Socket.IO Redis adapter  → realtime events cross process boundaries
 *   - distributed sweeper lock → only ONE process runs dispatch expiry
 *   - shared cache (optional)
 *
 * If REDIS_URL is not set, every getter here returns null and callers fall
 * back to single-process behaviour. The app must boot fine either way, so a
 * Redis connection failure is logged but never crashes the process.
 */

let client = null; // general-purpose client (locks, cache)
let pubClient = null; // Socket.IO adapter pub
let subClient = null; // Socket.IO adapter sub
let connected = false;

function buildClient(label) {
  const c = new Redis(config.redis.url, {
    // Don't queue commands forever if Redis is down; fail fast so callers can
    // fall back instead of hanging a request.
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy(times) {
      // Back off, cap at 5s. Keep trying so a transient blip self-heals.
      return Math.min(times * 200, 5000);
    },
  });
  c.on('ready', () => {
    connected = true;
    logger.info(`Redis ${label} ready`);
  });
  c.on('error', (err) => {
    connected = false;
    logger.error(`Redis ${label} error: ${err.message}`);
  });
  c.on('end', () => {
    connected = false;
  });
  return c;
}

/**
 * Initialise Redis if configured. Idempotent. Returns true if Redis is enabled.
 */
function initRedis() {
  if (!config.redis.enabled) {
    logger.info('Redis disabled (no REDIS_URL) — running single-process mode');
    return false;
  }
  if (client) return true;
  try {
    client = buildClient('client');
    pubClient = buildClient('pub');
    subClient = pubClient.duplicate();
    subClient.on('error', (err) => logger.error(`Redis sub error: ${err.message}`));
    logger.info('Redis initialising for multi-process scaling');
    return true;
  } catch (err) {
    logger.error(`Redis init failed, falling back to single-process: ${err.message}`);
    client = pubClient = subClient = null;
    return false;
  }
}

function getClient() {
  return client;
}

/** Socket.IO adapter needs a pub + sub pair. Returns null if Redis disabled. */
function getAdapterClients() {
  if (!pubClient || !subClient) return null;
  return { pubClient, subClient };
}

function isEnabled() {
  return Boolean(client);
}

function isConnected() {
  return connected;
}

async function closeRedis() {
  const clients = [client, pubClient, subClient].filter(Boolean);
  await Promise.all(clients.map((c) => c.quit().catch(() => {})));
  client = pubClient = subClient = null;
  connected = false;
}

module.exports = {
  initRedis,
  getClient,
  getAdapterClients,
  isEnabled,
  isConnected,
  closeRedis,
};
