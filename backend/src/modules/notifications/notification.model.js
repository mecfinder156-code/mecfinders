'use strict';

const mongoose = require('mongoose');

/**
 * In-app notification feed.
 *
 * One row per notification delivered to a single user. Written whenever a
 * booking status changes (and for support-query responses). The same event is
 * also pushed live over Socket.IO (`notification:new`) and, when the app is
 * backgrounded, via FCM — but this collection is the durable feed the
 * Notifications screen reads and marks as read.
 */
const notificationSchema = new mongoose.Schema(
  {
    // Recipient. Indexed so a user's feed query is fast.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Recipient role at time of send — lets us keep customer/provider feeds
    // distinct even though they share the users collection (discriminators).
    role: { type: String, required: true },

    // Machine-readable category (maps to a booking timeline event or a support
    // event). Clients can switch on this for icons / deep-links.
    type: { type: String, required: true },

    title: { type: String, required: true },
    body: { type: String, required: true },

    // Optional deep-link target + arbitrary metadata (bookingId, status, etc.).
    // Kept generic so new notification kinds don't need a schema change.
    data: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Convenience references (also present in `data`) for querying/aggregation.
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },

    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Feed query: a user's notifications, newest first, plus unread filter.
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, readAt: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
