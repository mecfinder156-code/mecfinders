'use strict';

const cache = require('./cache');

/**
 * Short-TTL cache for the per-request user lookup done by the auth middleware.
 *
 * `authenticate` runs on nearly every API call and previously hit the DB with a
 * `User.findById` every single time. Under thousands of concurrent users that is
 * the single busiest query in the system. Caching the user document for a few
 * seconds (Redis when available, else in-process) collapses that to roughly one
 * DB read per user per TTL window, with a bounded staleness: a ban or profile
 * change takes effect within the TTL, and the security-critical paths
 * (logout, deactivate) invalidate the entry immediately.
 */

const USER_TTL_S = parseInt(process.env.USER_CACHE_TTL_S, 10) || 30;
const keyFor = (id) => `user:${String(id)}`;

/** Cached lean user document (or null if not found). */
async function getCachedUser(id) {
  return cache.getOrSet(keyFor(id), USER_TTL_S, async () => {
    // Required lazily to avoid a circular require at module load.
    const User = require('../modules/users/models/user.model');
    const doc = await User.findById(id).lean();
    return doc || null;
  });
}

/** Drop a user from the cache after a mutation (ban, profile change, logout). */
async function invalidate(id) {
  if (!id) return;
  await cache.invalidate(keyFor(id));
}

module.exports = { getCachedUser, invalidate, USER_TTL_S };
