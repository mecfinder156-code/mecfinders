'use strict';

const BookingTimeline = require('./bookingTimeline.model');
const logger = require('../../utils/logger');

/**
 * Append an immutable timeline/audit record for a booking. Timeline writes are
 * best-effort: a failure to log must never abort the business transaction, so
 * errors are swallowed and logged.
 */
async function logEvent({
  bookingId,
  event,
  actor = null,
  fromStatus = null,
  toStatus = null,
  message = null,
  meta = null,
}) {
  try {
    return await BookingTimeline.create({
      bookingId,
      event,
      actorId: actor ? actor._id || actor.id || actor : null,
      actorRole: actor && actor.role ? actor.role : null,
      fromStatus,
      toStatus,
      message,
      meta,
    });
  } catch (err) {
    logger.error(`Timeline log failed for booking ${bookingId}: ${err.message}`);
    return null;
  }
}

async function getTimeline(bookingId) {
  return BookingTimeline.find({ bookingId }).sort({ createdAt: 1 }).lean();
}

module.exports = { logEvent, getTimeline };
