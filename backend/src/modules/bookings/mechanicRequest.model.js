'use strict';

const mongoose = require('mongoose');
const { REQUEST_STATUS } = require('./booking.constants');

/**
 * A dispatch offer of a booking to a single mechanic.
 *
 * Dispatch is backend-controlled: for each eligible mechanic we create one
 * PENDING MechanicRequest with an `expiresAt`. The mechanic can ACCEPT or
 * REJECT; a background sweeper marks PENDING requests EXPIRED once past
 * `expiresAt` and advances the dispatch to the next mechanic. Exactly one
 * request per booking can move to ACCEPTED (enforced atomically at the
 * Booking level, see dispatch.service).
 */
const mechanicRequestSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    mechanicId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    status: {
      type: String,
      enum: Object.values(REQUEST_STATUS),
      default: REQUEST_STATUS.PENDING,
      index: true,
    },

    sequence: { type: Number, default: 0 }, // dispatch order within the booking
    distanceMeters: { type: Number, default: null },

    sentAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// A mechanic can only have one live offer per booking.
mechanicRequestSchema.index({ bookingId: 1, mechanicId: 1 }, { unique: true });
// Sweeper query: find PENDING offers that are past expiry.
mechanicRequestSchema.index({ status: 1, expiresAt: 1 });

module.exports = mongoose.model('MechanicRequest', mechanicRequestSchema);
