'use strict';

const mongoose = require('mongoose');
const User = require('./user.model');

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

const mechanicSchema = new mongoose.Schema({
  firebaseUid: {
    type: String,
    unique: true,
    sparse: true,
    default: null,
  },

  // --- Availability / dispatch eligibility (additive) ---
  isOnline: { type: Boolean, default: false },
  lastSeenAt: { type: Date, default: null },

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
});

// Geospatial index for proximity queries. Sparse so mechanics without a
// location set are excluded from $near rather than erroring on index/save.
mechanicSchema.index({ currentLocation: '2dsphere' }, { sparse: true });
mechanicSchema.index({ isOnline: 1 });

const Mechanic = User.discriminator('mechanic', mechanicSchema);

module.exports = Mechanic;

