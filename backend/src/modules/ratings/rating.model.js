'use strict';

const mongoose = require('mongoose');

/**
 * A customer's rating of a mechanic for a specific completed booking.
 * One rating per booking (enforced by the unique bookingId index). Submitting
 * a rating updates the mechanic's cached aggregate (see rating.service).
 */
const ratingSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mechanicId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    rating: { type: Number, required: true, min: 1, max: 5 },
    feedback: { type: String, trim: true, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Rating', ratingSchema);
