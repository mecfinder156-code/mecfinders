'use strict';

const logger = require('../../utils/logger');

/**
 * Thin wrapper around Firebase Cloud Messaging for background push. FCM is used
 * ONLY as an out-of-app notification channel (e.g. waking a backgrounded
 * provider app for a new request); live in-app state sync is handled by
 * Socket.IO. All calls are best-effort and no-op when Firebase isn't
 * configured, so the booking flow never depends on push delivery.
 */

let admin = null;
let initialized = false;

function init() {
  if (initialized) return admin;
  initialized = true;
  try {
    admin = require('firebase-admin');
    if (!admin.apps.length) {
      // eslint-disable-next-line import/no-unresolved, global-require
      const serviceAccount = require('../../config/service-account.json');
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      logger.info('Firebase Admin initialised for push notifications');
    }
  } catch (err) {
    admin = null;
    logger.warn(`Push notifications disabled: ${err.message}`);
  }
  return admin;
}

async function send(fcmToken, title, body, data = {}) {
  if (!fcmToken) return false;
  const fb = init();
  if (!fb || !fb.apps.length) return false;
  try {
    // FCM data values must be strings.
    const stringData = {};
    for (const [k, v] of Object.entries(data)) stringData[k] = String(v);
    await fb.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data: stringData,
      android: { priority: 'high' },
    });
    return true;
  } catch (err) {
    logger.error(`FCM send failed: ${err.message}`);
    return false;
  }
}

module.exports = { init, send };
