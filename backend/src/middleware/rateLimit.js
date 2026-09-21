'use strict';

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const config = require('../config');

/**
 * Rate limiting. Protects the API from a single misbehaving client (or an
 * attacker) exhausting the server / DB pool. Tiered:
 *   - authLimiter    : tight, on login/OTP/refresh (brute-force + SMS abuse)
 *   - writeLimiter   : moderate, on booking/payment mutations
 *   - apiLimiter     : loose global backstop on everything else
 *
 * NOTE: for multi-process deployments behind a proxy, express-rate-limit uses
 * the default in-memory store per process. That's acceptable as a backstop
 * (each process gets a share of the limit). For strict global limits across
 * processes, swap in rate-limit-redis later — the limits below are generous
 * enough that per-process counting is fine for now.
 */

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
  limit: 20, // 20 attempts / 15 min / IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipInTest,
  handler: json('Too many attempts. Please try again in a few minutes.'),
});

const writeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  limit: 60, // 60 writes / min / user
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator,
  skip: skipInTest,
  handler: json('You are doing that too fast. Please slow down.'),
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  limit: parseInt(process.env.RATE_LIMIT_GLOBAL_PER_MIN, 10) || 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator,
  // Health checks and webhooks must never be rate-limited.
  skip: (req) =>
    skipInTest() ||
    req.path === '/api/health' ||
    req.path.startsWith('/api/webhooks'),
  handler: json('Too many requests. Please try again shortly.'),
});

module.exports = { authLimiter, writeLimiter, apiLimiter };
