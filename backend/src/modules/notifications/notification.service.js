'use strict';

const Notification = require('./notification.model');
const User = require('../users/models/user.model');
const push = require('./push.service');
const socket = require('../../realtime/socket');
const { SOCKET_EVENTS } = require('../bookings/booking.constants');
const logger = require('../../utils/logger');

/**
 * Notification service.
 *
 * `notify()` is the single entry point used across the booking lifecycle. It:
 *   1. persists a Notification row (the durable in-app feed),
 *   2. emits `notification:new` over Socket.IO to the user's room (live badge),
 *   3. sends an FCM push (out-of-app / backgrounded devices).
 *
 * All three are best-effort — a notification failure must NEVER abort the
 * business transaction that triggered it, so everything is wrapped and errors
 * are logged, not thrown. Mirrors the timeline.service contract.
 */

/**
 * @param {Object} p
 * @param {string|ObjectId} p.userId   recipient
 * @param {string} p.role              recipient role (customer|mechanic|...)
 * @param {string} p.type             machine category (e.g. 'MECHANIC_ASSIGNED')
 * @param {string} p.title
 * @param {string} p.body
 * @param {Object} [p.data]           deep-link meta (bookingId, status, ...)
 * @param {string|ObjectId} [p.bookingId]
 * @param {string} [p.fcmToken]       if already known, skip the extra lookup
 */
async function notify({ userId, role, type, title, body, data = {}, bookingId = null, fcmToken }) {
  if (!userId) return null;

  let doc = null;
  try {
    doc = await Notification.create({
      userId,
      role: role || 'customer',
      type,
      title,
      body,
      data,
      bookingId: bookingId || data.bookingId || null,
    });
  } catch (err) {
    logger.error(`Notification persist failed for user ${userId}: ${err.message}`);
  }

  // Live in-app signal (badge + list prepend). No-op if sockets uninitialised.
  try {
    socket.emitToUser(userId, SOCKET_EVENTS.NOTIFICATION_NEW, {
      _id: doc ? String(doc._id) : undefined,
      type,
      title,
      body,
      data,
      bookingId: bookingId ? String(bookingId) : data.bookingId || null,
      createdAt: doc ? doc.createdAt : new Date(),
      readAt: null,
    });
  } catch (err) {
    logger.error(`Notification socket emit failed: ${err.message}`);
  }

  // Out-of-app push. Look up the fcmToken if the caller didn't supply one.
  try {
    let token = fcmToken;
    if (token === undefined) {
      const u = await User.findById(userId).select('fcmToken');
      token = u && u.fcmToken;
    }
    if (token) {
      await push.send(token, title, body, {
        type,
        bookingId: bookingId ? String(bookingId) : data.bookingId || '',
      });
    }
  } catch (err) {
    logger.error(`Notification push failed: ${err.message}`);
  }

  return doc;
}

/** Paginated feed for a user, newest first. */
async function listForUser(userId, { page = 1, limit = 20 } = {}) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const [items, total, unread] = await Promise.all([
    Notification.find({ userId })
      .sort({ createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .lean(),
    Notification.countDocuments({ userId }),
    Notification.countDocuments({ userId, readAt: null }),
  ]);
  return {
    items,
    unread,
    pagination: { page: p, limit: l, total, pages: Math.ceil(total / l) || 1 },
  };
}

async function unreadCount(userId) {
  return Notification.countDocuments({ userId, readAt: null });
}

/** Mark one notification read (only if it belongs to the user). */
async function markRead(userId, notificationId) {
  return Notification.findOneAndUpdate(
    { _id: notificationId, userId, readAt: null },
    { $set: { readAt: new Date() } },
    { new: true }
  );
}

/** Mark all of a user's notifications read. */
async function markAllRead(userId) {
  const res = await Notification.updateMany(
    { userId, readAt: null },
    { $set: { readAt: new Date() } }
  );
  return res.modifiedCount || 0;
}

module.exports = { notify, listForUser, unreadCount, markRead, markAllRead };
