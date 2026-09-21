'use strict';

const mongoose = require('mongoose');
const {
  BOOKING_SERVICE_KIND,
  BOOKING_SERVICE_STATUS,
  SERVICE_SOURCE,
} = require('./booking.constants');

/**
 * A single checklist item snapshot attached to a booking service line item.
 * Templates are copied from the Service / MechanicService catalogue at the
 * time the line item is created so later template edits don't rewrite history.
 */
const checklistItemSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    required: { type: Boolean, default: true },
    done: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: true }
);

/**
 * Immutable price snapshot captured when a service is added to a booking.
 * Historical bills MUST use this snapshot, never the live pricing models.
 */
const priceSnapshotSchema = new mongoose.Schema(
  {
    servicePrice: { type: Number, required: true }, // mechanic's earning
    gstPercentage: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    platformFee: { type: Number, default: 0 },
    totalPrice: { type: Number, required: true }, // customer pays
    companyAmount: { type: Number, default: 0 }, // totalPrice - servicePrice
    // Generic, admin-configurable breakdown so bills render whatever taxes/
    // fees/discounts existed at booking time (historical stability).
    breakdown: {
      type: [
        new mongoose.Schema(
          { label: String, kind: String, amount: Number },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { _id: false }
);

/**
 * BookingService = one billable line item on a booking.
 * - ORIGINAL: the Service the customer booked (auto-accepted).
 * - ADDITIONAL: a MechanicService the mechanic proposes during execution,
 *   which the customer must explicitly accept before it becomes billable.
 */
const bookingServiceSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },

    kind: { type: String, enum: Object.values(BOOKING_SERVICE_KIND), required: true },

    // Polymorphic reference into the correct catalogue.
    serviceSource: { type: String, enum: Object.values(SERVICE_SOURCE), required: true },
    serviceRef: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'serviceSource' },

    name: { type: String, required: true, trim: true }, // snapshot of service name
    priceSnapshot: { type: priceSnapshotSchema, required: true },

    status: {
      type: String,
      enum: Object.values(BOOKING_SERVICE_STATUS),
      required: true,
    },

    reason: { type: String, trim: true, default: null }, // mechanic's justification for ADDITIONAL

    checklist: { type: [checklistItemSchema], default: [] },

    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    respondedAt: { type: Date, default: null }, // when customer accepted/rejected
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

bookingServiceSchema.index({ bookingId: 1, kind: 1 });

module.exports = mongoose.model('BookingService', bookingServiceSchema);
