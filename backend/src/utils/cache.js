'use strict';

const redis = require('../config/redis');
const logger = require('./logger');

/**
 * Tiny cache-aside helper for rarely-changing reference data (categories,
 * services, pricing). Uses Redis when available (shared across processes),
 * otherwise a per-process in-memory Map. Either way it collapses repeated DB
 * reads under load.
 *
 * This is deliberately best-effort: any cache error falls through to the
 * loader so correctness never depends on the cache.
 */

const mem = new Map(); // key -> { value, expiresAt }

function memGet(key) {
  const hit = mem.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt <= Date.now()) {
    mem.delete(key);
    return undefined;
  }
  return hit.value;
}

function memSet(key, value, ttlSeconds) {
  mem.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

/**
 * Return cached value for `key`, or run `loader()`, cache its result, return it.
 * @param {string} key
 * @param {number} ttlSeconds
 * @param {() => Promise<any>} loader
 */
async function getOrSet(key, ttlSeconds, loader) {
  // 1) Try Redis
  const client = redis.getClient();
  if (client && redis.isConnected()) {
    try {
      const raw = await client.get(key);
      if (raw != null) return JSON.parse(raw);
      const value = await loader();
      // Fire-and-forget the write so a slow Redis never delays the response.
      client.set(key, JSON.stringify(value), 'EX', ttlSeconds).catch(() => {});
      return value;
    } catch (err) {
      logger.error(`cache redis get failed for ${key}: ${err.message}`);
      // fall through to loader
      return loader();
    }
  }

  // 2) In-memory fallback
  const cached = memGet(key);
  if (cached !== undefined) return cached;
  const value = await loader();
  memSet(key, value, ttlSeconds);
  return value;
}

/**
 * Invalidate a key (or key prefix for the in-memory map). Call after a mutation
 * that changes reference data so stale entries clear immediately.
 */
async function invalidate(key) {
  const client = redis.getClient();
  if (client && redis.isConnected()) {
    try {
      await client.del(key);
    } catch (err) {
      logger.error(`cache invalidate failed for ${key}: ${err.message}`);
    }
  }
  mem.delete(key);
}

/**
 * Invalidate every key starting with `prefix`. Used when an admin edits data
 * that fans out across many cache keys (e.g. services cached per city/category).
 */
async function invalidatePrefix(prefix) {
  // In-memory: delete matching keys.
  for (const key of mem.keys()) {
    if (key.startsWith(prefix)) mem.delete(key);
  }
  // Redis: scan + del (SCAN is non-blocking, safe on a live server).
  const client = redis.getClient();
  if (client && redis.isConnected()) {
    try {
      let cursor = '0';
      do {
        const [next, keys] = await client.scan(
          cursor,
          'MATCH',
          `${prefix}*`,
          'COUNT',
          100
        );
        cursor = next;
        if (keys.length) await client.del(...keys);
      } while (cursor !== '0');
    } catch (err) {
      logger.error(`cache invalidatePrefix failed for ${prefix}: ${err.message}`);
    }
  }
}

/** Clear every in-memory entry (Redis entries expire on their own TTL). */
function clearMemory() {
  mem.clear();
}

module.exports = { getOrSet, invalidate, invalidatePrefix, clearMemory };
