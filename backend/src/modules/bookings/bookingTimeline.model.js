'use strict';

const mongoose = require('mongoose');
const { TIMELINE_EVENT } = require('./booking.constants');

/**
 * Immutable audit record of a single important booking event. One document
 * per transition, with a server-side timestamp. Never updated after creation.
 */
const bookingTimelineSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    event: { type: String, enum: Object.values(TIMELINE_EVENT), required: true },

    // Actor who caused the event (may be null for system events).
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorRole: { type: String, default: null },

    fromStatus: { type: String, default: null },
    toStatus: { type: String, default: null },

    message: { type: String, trim: true, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

bookingTimelineSchema.index({ bookingId: 1, createdAt: 1 });

module.exports = mongoose.model('BookingTimeline', bookingTimelineSchema);
