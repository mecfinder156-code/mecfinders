'use strict';

const mongoose = require('mongoose');
const User = require('./user.model');
const { BANK_DETAILS_STATUS } = require('../../bookings/booking.constants');

/**
 * GeoJSON Point sub-schema for the mechanic's live location.
 *
 * IMPORTANT: the parent path (`currentLocation`) defaults to `undefined` and
 * `type` has NO default, so the field is completely absent until a real
 * location is set. This is required because a 2dsphere index rejects a Point
 * that has a `type` but no `coordinates` ("Can't extract geo keys"). Combined
 * with a sparse index, mechanics without a location are simply skipped.
 */
const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'] },
    coordinates: { type: [Number] }, // [longitude, latitude]
    updatedAt: { type: Date, default: null },
  },
  { _id: false }
);

/**
 * Payout bank details for the mechanic. For ONLINE bookings the customer's
 * payment is split at source via Razorpay Route — the mechanic's share is
 * transferred to their Route linked account (`razorpayAccountId`) and settled
 * to this bank account on Razorpay's schedule. The raw account number is kept
 * `select: false` so it is never returned unless explicitly requested.
 */
const bankDetailsSchema = new mongoose.Schema(
  {
    // How the mechanic wants to be paid: a bank account OR a UPI id.
    payoutMethod: { type: String, enum: ['bank', 'upi'], default: 'bank' },

    accountHolderName: { type: String, trim: true, default: null },
    accountNumber: { type: String, trim: true, default: null, select: false },
    // Last 4 digits, safe to display anywhere.
    accountLast4: { type: String, trim: true, default: null },
    ifsc: { type: String, trim: true, uppercase: true, default: null },
    bankName: { type: String, trim: true, default: null },

    // UPI id (e.g. name@okhdfc), used when payoutMethod === 'upi'.
    upiId: { type: String, trim: true, default: null },

    // Razorpay Route linked account that receives the mechanic's share.
    razorpayAccountId: { type: String, default: null },

    status: {
      type: String,
      enum: Object.values(BANK_DETAILS_STATUS),
      default: BANK_DETAILS_STATUS.NOT_SUBMITTED,
    },
    // Reason the linked-account setup failed, if any (surfaced to admin).
    statusReason: { type: String, default: null },
    updatedAt: { type: Date, default: null },
  },
  { _id: false }
);

const mechanicSchema = new mongoose.Schema({
  // NOT unique on its own — the base User model's compound {firebaseUid, role}
  // unique index enforces uniqueness PER ROLE, so one phone can be both a
  // customer and a mechanic. A field-level `unique: true` here would create a
  // collection-wide `firebaseUid_1` index and block that.
  firebaseUid: {
    type: String,
    sparse: true,
    default: null,
  },

  // --- Availability / dispatch eligibility (additive) ---
  isOnline: { type: Boolean, default: false },
  lastSeenAt: { type: Date, default: null },

  // Admin-controlled dispatch pause. When true the mechanic is skipped by
  // dispatch (no new service requests are offered) even while online. This is
  // SEPARATE from the account-level `isActive` ban: a paused mechanic can still
  // log in and use the app, they simply receive no new jobs until an admin
  // resumes them.
  requestsPaused: { type: Boolean, default: false },

  // Live location as GeoJSON Point [lng, lat] for proximity dispatch.
  // Absent until set (see pointSchema note above).
  currentLocation: { type: pointSchema, default: undefined },

  // Service area used to shortlist eligible mechanics for a booking.
  serviceCityIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'City' }],
  serviceCategoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'VehicleCategory' }],

  // --- Cached rating aggregate (maintained by rating.service) ---
  ratingAverage: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  ratingSum: { type: Number, default: 0 }, // internal accumulator for O(1) updates
  completedServicesCount: { type: Number, default: 0 },

  // --- Payout bank details (Razorpay Route linked account) ---
  bankDetails: { type: bankDetailsSchema, default: () => ({}) },
});

// Geospatial index for proximity queries. Sparse so mechanics without a
// location set are excluded from $near rather than erroring on index/save.
mechanicSchema.index({ currentLocation: '2dsphere' }, { sparse: true });
mechanicSchema.index({ isOnline: 1 });

const Mechanic = User.discriminator('mechanic', mechanicSchema);

module.exports = Mechanic;

