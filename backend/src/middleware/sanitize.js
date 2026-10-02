'use strict';

/**
 * Lightweight NoSQL-injection guard (Express 5 safe).
 *
 * Strips any object key that starts with `$` or contains a `.` from the request
 * body/params/query, in place. This neutralises operator-injection payloads like
 * `{ "firebaseUid": { "$ne": null } }` or `{ "email": { "$gt": "" } }` that would
 * otherwise turn a `findOne` into a match-anything query.
 *
 * We mutate in place rather than reassigning `req.query` (a getter with no setter
 * in Express 5, so assignment throws). No legitimate request uses `$`-prefixed or
 * dotted KEYS (values such as emails are untouched), so this is safe to apply
 * globally.
 */

const BLOCKED_KEY = /^\$|\./;

function scrub(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 20) return;
  if (Array.isArray(obj)) {
    for (const item of obj) scrub(item, depth + 1);
    return;
  }
  for (const key of Object.keys(obj)) {
    if (BLOCKED_KEY.test(key)) {
      delete obj[key];
      continue;
    }
    scrub(obj[key], depth + 1);
  }
}

module.exports = function sanitizeRequest(req, res, next) {
  try { scrub(req.body); } catch (_) { /* ignore */ }
  try { scrub(req.params); } catch (_) { /* ignore */ }
  try { if (req.query) scrub(req.query); } catch (_) { /* query may be read-only */ }
  next();
};
