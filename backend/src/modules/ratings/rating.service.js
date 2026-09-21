'use strict';

const Rating = require('./rating.model');
const Booking = require('../bookings/booking.model');
const Mechanic = require('../users/models/mechanic.model');
const { BOOKING_STATUS, TIMELINE_EVENT } = require('../bookings/booking.constants');
const timeline = require('../bookings/timeline.service');
const ApiError = require('../../utils/ApiError');

/**
 * Submit a customer's rating for a completed booking. One rating per booking
 * (enforced by the unique bookingId index + the booking.ratingId guard). The
 * mechanic's aggregate is updated in O(1) via a running sum/count rather than
 * recomputing the full history.
 */
async function submitRating(bookingId, customerUser, { rating, feedback }) {
  if (typeof rating !== 'number' || rating < 1 || rating > 5) {
    throw ApiError.badRequest('Rating must be between 1 and 5');
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) throw ApiError.notFound('Booking not found');
  if (String(booking.customerId) !== String(customerUser._id)) {
    throw ApiError.forbidden('This booking does not belong to you');
  }
  if (booking.status !== BOOKING_STATUS.COMPLETED) {
    throw ApiError.conflict('You can only rate completed bookings');
  }
  if (booking.ratingId) {
    throw ApiError.conflict('You have already rated this booking');
  }

  let ratingDoc;
  try {
    ratingDoc = await Rating.create({
      bookingId,
      customerId: booking.customerId,
      mechanicId: booking.mechanicId,
      rating,
      feedback: feedback || null,
    });
  } catch (err) {
    if (err && err.code === 11000) throw ApiError.conflict('You have already rated this booking');
    throw err;
  }

  // O(1) aggregate update.
  const updated = await Mechanic.findByIdAndUpdate(
    booking.mechanicId,
    { $inc: { ratingCount: 1, ratingSum: rating } },
    { new: true }
  );
  if (updated) {
    updated.ratingAverage = updated.ratingCount
      ? Math.round((updated.ratingSum / updated.ratingCount) * 10) / 10
      : 0;
    await updated.save();
  }

  booking.ratingId = ratingDoc._id;
  await booking.save();

  await timeline.logEvent({
    bookingId,
    event: TIMELINE_EVENT.RATING_SUBMITTED,
    actor: customerUser,
    meta: { rating },
  });

  return ratingDoc;
}

/**
 * Aggregate rating summary for a mechanic, including a 1–5 distribution. Uses
 * the cached average/count from the mechanic doc plus an aggregation for the
 * distribution (only computed on demand, e.g. for admin/profile views).
 */
async function getMechanicRatingSummary(mechanicId) {
  const mechanic = await Mechanic.findById(mechanicId).select(
    'ratingAverage ratingCount completedServicesCount'
  );
  if (!mechanic) throw ApiError.notFound('Mechanic not found');

  const dist = await Rating.aggregate([
    { $match: { mechanicId: mechanic._id } },
    { $group: { _id: '$rating', count: { $sum: 1 } } },
  ]);
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const d of dist) distribution[d._id] = d.count;

  return {
    average: mechanic.ratingAverage,
    count: mechanic.ratingCount,
    completedServices: mechanic.completedServicesCount,
    distribution,
  };
}

async function listMechanicReviews(mechanicId, { page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Rating.find({ mechanicId })
      .populate('customerId', 'name profileImage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Rating.countDocuments({ mechanicId }),
  ]);
  return { items, total, page, limit, pages: Math.ceil(total / limit) };
}

module.exports = { submitRating, getMechanicRatingSummary, listMechanicReviews };
