'use strict';

const path = require('path');
const logger = require('../utils/logger');
const config = require('./index');

/**
 * Firebase Admin SDK — single source of truth for the whole backend.
 *
 * Used for TWO things:
 *   1. Verifying Firebase ID tokens on mobile auth (login/register). The mobile
 *      apps sign in with Firebase phone-OTP and send the resulting ID token; we
 *      verify it here and trust ONLY the decoded uid/phone — never values from
 *      the request body. This is what makes mobile auth actually secure.
 *   2. Sending FCM push notifications (see notifications/push.service.js).
 *
 * Credentials are read from env (preferred) or a service-account.json fallback.
 * Initialisation is idempotent and best-effort: if creds are absent the module
 * reports `isConfigured() === false` and `verifyIdToken` throws a clear 503-style
 * error so the auth layer FAILS CLOSED (never falls back to trusting the client).
 */

let admin = null;
let configured = false;
let initTried = false;

function loadCredential(adminSdk) {
  // 1) Explicit env creds (12-factor friendly, no file on disk).
  const { projectId, clientEmail, privateKey } = config.firebase;
  if (projectId && clientEmail && privateKey) {
    return adminSdk.credential.cert({
      projectId,
      clientEmail,
      // Env stores the key with literal "\n"; convert back to real newlines.
      privateKey: privateKey.replace(/\\n/g, '\n'),
    });
  }
  // 2) Service-account JSON fallback (config/service-account.json, gitignored).
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const serviceAccount = require(path.join(__dirname, 'service-account.json'));
    return adminSdk.credential.cert(serviceAccount);
  } catch (_) {
    return null;
  }
}

/** Initialise once. Safe to call repeatedly. Returns the admin SDK or null. */
function init() {
  if (initTried) return admin;
  initTried = true;
  try {
    // eslint-disable-next-line global-require
    const adminSdk = require('firebase-admin');
    if (!adminSdk.apps.length) {
      const credential = loadCredential(adminSdk);
      if (!credential) {
        logger.warn(
          'Firebase Admin NOT configured (no FIREBASE_* env or service-account.json). ' +
            'Mobile login/register and push will be disabled until credentials are added.'
        );
        return null;
      }
      adminSdk.initializeApp({ credential });
    }
    admin = adminSdk;
    configured = true;
    logger.info('Firebase Admin initialised');
    return admin;
  } catch (err) {
    admin = null;
    configured = false;
    logger.error(`Firebase Admin init failed: ${err.message}`);
    return null;
  }
}

function isConfigured() {
  if (!initTried) init();
  return configured;
}

/** Expose the raw SDK (used by push.service for messaging). Null if unconfigured. */
function getAdmin() {
  if (!initTried) init();
  return admin;
}

/**
 * Verify a Firebase ID token and return its decoded claims (uid, phone_number…).
 * Throws if Firebase isn't configured or the token is invalid/expired, so the
 * caller can only ever proceed with a cryptographically verified identity.
 */
async function verifyIdToken(idToken) {
  const sdk = getAdmin();
  if (!sdk) {
    const err = new Error('Authentication service is not configured');
    err.code = 'FIREBASE_UNCONFIGURED';
    throw err;
  }
  if (!idToken || typeof idToken !== 'string') {
    const err = new Error('Missing authentication token');
    err.code = 'FIREBASE_BAD_TOKEN';
    throw err;
  }
  return sdk.auth().verifyIdToken(idToken);
}

module.exports = { init, isConfigured, getAdmin, verifyIdToken };
