'use strict';

const redis = require('../config/redis');
const config = require('../config');
const logger = require('./logger');

/**
 * Best-effort distributed leader lock (Redis SET NX PX).
 *
 * Used so that when multiple app processes run, only ONE of them runs the
 * dispatch sweeper. Without Redis (single process) tryAcquire() always returns
 * true, so behaviour is unchanged.
 *
 * The lock auto-expires (ttl) so a crashed leader never wedges dispatch — the
 * next process to try wins. We re-acquire on every sweep tick (short renew),
 * which keeps a stable leader while it's alive but hands over quickly if it dies.
 */

const LOCK_KEY = 'lock:dispatch-sweeper';
const owner = config.server.instanceId;

/**
 * Try to acquire (or renew) the sweeper lock for `ttlMs`.
 * Returns true if this process holds the lock. Single-process (no Redis): true.
 */
async function tryAcquireSweeper(ttlMs) {
  const client = redis.getClient();
  if (!client || !redis.isConnected()) return true; // single-process mode

  try {
    // If we already own it, renew (extend TTL). Otherwise acquire only if free.
    const current = await client.get(LOCK_KEY);
    if (current === owner) {
      await client.pexpire(LOCK_KEY, ttlMs);
      return true;
    }
    // SET key owner PX ttl NX  → only sets if the key does not exist.
    const res = await client.set(LOCK_KEY, owner, 'PX', ttlMs, 'NX');
    return res === 'OK';
  } catch (err) {
    // On Redis error, don't starve dispatch — fall back to running locally.
    logger.error(`leaderLock error, running sweeper locally: ${err.message}`);
    return true;
  }
}

/** Release the lock if we own it (called on graceful shutdown). */
async function releaseSweeper() {
  const client = redis.getClient();
  if (!client) return;
  try {
    const current = await client.get(LOCK_KEY);
    if (current === owner) await client.del(LOCK_KEY);
  } catch (_) {
    /* expiry will clean it up */
  }
}

module.exports = { tryAcquireSweeper, releaseSweeper, LOCK_KEY };
