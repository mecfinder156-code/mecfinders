'use strict';

const logger = require('../../utils/logger');
const firebase = require('../../config/firebase');

/**
 * Thin wrapper around Firebase Cloud Messaging for background push. FCM is used
 * ONLY as an out-of-app notification channel (e.g. waking a backgrounded
 * provider app for a new request); live in-app state sync is handled by
 * Socket.IO. All calls are best-effort and no-op when Firebase isn't
 * configured, so the booking flow never depends on push delivery.
 *
 * Firebase Admin is initialised once in config/firebase.js (shared with mobile
 * auth token verification) — we never init a second app here.
 */

async function send(fcmToken, title, body, data = {}) {
  if (!fcmToken) return false;
  const fb = firebase.getAdmin();
  if (!fb) return false;
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

module.exports = { init: firebase.init, send };
