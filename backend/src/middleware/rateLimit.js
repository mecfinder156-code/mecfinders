'use strict';

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const config = require('../config');
const redis = require('../config/redis');

/**
 * Rate limiting. Protects the API from a single misbehaving client (or an
 * attacker) exhausting the server / DB pool. Tiered:
 *   - authLimiter    : tight, on login/OTP/refresh (brute-force + SMS abuse)
 *   - writeLimiter   : moderate, on booking/payment mutations
 *   - apiLimiter     : loose global backstop on everything else
 *
 * When REDIS_URL is set (multi-process deployments) the counters live in Redis
 * so the limit is enforced GLOBALLY across every app process — otherwise a
 * brute-force attacker could get N× the limit by spreading requests across the
 * N processes behind the load balancer. Without Redis (single process) it uses
 * the default in-memory store, which is correct for one process.
 */

// Build a shared Redis store for a limiter, or undefined to use the in-memory
// default. The client is resolved lazily per command (Redis is initialised at
// server start, after this module is first required).
function makeStore(prefix) {
  if (!config.redis.enabled) return undefined;
  return new RedisStore({
    prefix,
    sendCommand: (...args) => redis.getClient().call(...args),
  });
}

const json = (message) => (req, res) =>
  res.status(429).json({ success: false, message });

// Never rate-limit during automated tests — they fire many requests as one
// user in quick succession, which is legitimate there.
const skipInTest = () => config.env === 'test';

// Key by authenticated user id when available, else IP. Keeps one user on one
// device from being punished for sharing an IP (NAT / campus wifi). The IP
// fallback goes through ipKeyGenerator so IPv6 addresses are normalised to a
// /64 subnet (a single IPv6 user can otherwise rotate addresses to bypass).
function keyGenerator(req) {
  if (req.user && (req.user.id || req.user._id)) {
    return `u:${String(req.user.id || req.user._id)}`;
  }
  return ipKeyGenerator(req.ip);
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  limit: 200, // 200 attempts / 15 min / IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipInTest,
  store: makeStore('rl:auth:'),
  handler: json('Too many attempts. Please try again in a few minutes.'),
});

const writeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  limit: 600, // 600 writes / min / user
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator,
  skip: skipInTest,
  store: makeStore('rl:write:'),
  handler: json('You are doing that too fast. Please slow down.'),
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  limit: parseInt(process.env.RATE_LIMIT_GLOBAL_PER_MIN, 10) || 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator,
  store: makeStore('rl:api:'),
  // Health checks and webhooks must never be rate-limited.
  skip: (req) =>
    skipInTest() ||
    req.path === '/api/health' ||
    req.path.startsWith('/api/webhooks'),
  handler: json('Too many requests. Please try again shortly.'),
});

module.exports = { authLimiter, writeLimiter, apiLimiter };
