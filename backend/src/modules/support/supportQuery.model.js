'use strict';

const mongoose = require('mongoose');

/**
 * A support query ("Ask a question" / chat) raised by a mobile user.
 *
 * The user submits a subject + message; it's stored here and surfaced in the
 * admin panel where staff can reply. `replies` is an embedded thread so a simple
 * back-and-forth works today and a richer chat can be layered on later without a
 * schema change. `status` drives the admin inbox (OPEN → answered/closed).
 */
const replySchema = new mongoose.Schema(
  {
    // 'user' = the customer/mechanic who opened it; 'admin' = support staff.
    author: { type: String, enum: ['user', 'admin'], required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    message: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const supportQuerySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Snapshot of who raised it — survives even if the user is later changed.
    role: { type: String, required: true }, // customer | mechanic
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true },

    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },

    // Optional context: the booking the question is about.
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },

    status: {
      type: String,
      enum: ['OPEN', 'ANSWERED', 'CLOSED'],
      default: 'OPEN',
      index: true,
    },
    replies: { type: [replySchema], default: [] },

    // Set when an admin first replies / resolves.
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

// Admin inbox: newest open queries first.
supportQuerySchema.index({ status: 1, createdAt: -1 });
// A user's own ticket list.
supportQuerySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('SupportQuery', supportQuerySchema);
