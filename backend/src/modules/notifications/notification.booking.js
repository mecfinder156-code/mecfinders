'use strict';

const notificationService = require('./notification.service');
const { BOOKING_STATUS } = require('../bookings/booking.constants');
const User = require('../users/models/user.model');
const logger = require('../../utils/logger');

/**
 * Booking lifecycle → notification content.
 *
 * This is the single place that decides, for a given booking status, WHO gets
 * notified and WHAT the notification says. The booking/dispatch/payment services
 * just call `notifyBookingStatus(booking, status, actor)` at each transition;
 * they don't need to know the copy or the recipients.
 *
 * Everything here is best-effort — wrapped so a notification failure can never
 * abort the booking transaction that triggered it.
 */

const CUSTOMER = 'customer';
const MECHANIC = 'mechanic';

/**
 * Build the customer-facing notification for a status, or null to skip.
 * `ctx` carries already-resolved extras (e.g. mechanicName) so we don't re-query.
 */
function customerContent(status, ctx) {
  switch (status) {
    case BOOKING_STATUS.MECHANIC_ASSIGNED:
      return {
        type: 'MECHANIC_ASSIGNED',
        title: 'Mechanic on the way 🔧',
        body: ctx.mechanicName
          ? `${ctx.mechanicName} accepted your booking and is heading to your location.`
          : 'A mechanic accepted your booking and is heading to your location.',
      };
    case BOOKING_STATUS.MECHANIC_ARRIVED:
      return {
        type: 'MECHANIC_ARRIVED',
        title: 'Mechanic has arrived 📍',
        body: 'Your mechanic has reached your location. Share your OTP to start the service.',
      };
    case BOOKING_STATUS.WORK_STARTED:
      return {
        type: 'WORK_STARTED',
        title: 'Service started 🛠️',
        body: 'Your mechanic has started working on your vehicle.',
      };
    case BOOKING_STATUS.READY_FOR_BILLING:
      return {
        type: 'READY_FOR_BILLING',
        title: 'Service completed ✅',
        body: 'The work is done. Review your bill and pay to finish the booking.',
      };
    case BOOKING_STATUS.COMPLETED:
      return {
        type: 'BOOKING_COMPLETED',
        title: 'Booking completed 🎉',
        body: 'Payment received. Thanks for using MecFinders — rate your mechanic!',
      };
    case BOOKING_STATUS.CANCELLED:
      // Only notify the customer if someone ELSE cancelled it.
      if (ctx.actorRole === CUSTOMER) return null;
      return {
        type: 'BOOKING_CANCELLED',
        title: 'Booking cancelled',
        body: 'Your booking was cancelled. Tap for details.',
      };
    case BOOKING_STATUS.EXPIRED:
      return {
        type: 'BOOKING_EXPIRED',
        title: 'No mechanic available 😔',
        body: "We couldn't find a mechanic right now. Please try booking again.",
      };
    default:
      return null;
  }
}

/**
 * Build the mechanic-facing notification for a status, or null to skip.
 */
function mechanicContent(status, ctx) {
  switch (status) {
    case BOOKING_STATUS.COMPLETED:
      return {
        type: 'EARNING_ADDED',
        title: 'Job completed 💰',
        body: 'Payment for this job has been settled to your wallet.',
      };
    case BOOKING_STATUS.CANCELLED:
      // Only notify the mechanic if they didn't cancel it themselves.
      if (ctx.actorRole === MECHANIC) return null;
      if (!ctx.hasMechanic) return null;
      return {
        type: 'BOOKING_CANCELLED',
        title: 'Booking cancelled',
        body: 'A booking assigned to you was cancelled.',
      };
    default:
      return null;
  }
}

/**
 * Notify the relevant parties about a booking status change.
 *
 * @param {Object} booking  the Booking doc (must have _id, customerId, mechanicId, status)
 * @param {string} status   the status just entered
 * @param {Object} [actor]  the user who triggered the change (for cancel attribution)
 */
async function notifyBookingStatus(booking, status, actor = null) {
  try {
    const actorRole = actor && actor.role ? actor.role : null;
    const hasMechanic = !!booking.mechanicId;

    // Resolve the mechanic's name only when the copy needs it.
    let mechanicName = null;
    if (status === BOOKING_STATUS.MECHANIC_ASSIGNED && booking.mechanicId) {
      const m = await User.findById(booking.mechanicId).select('name');
      mechanicName = m && m.name;
    }

    const ctx = { actorRole, hasMechanic, mechanicName };
    const data = {
      bookingId: String(booking._id),
      status,
      bookingType: booking.bookingType,
    };

    const jobs = [];

    const cust = customerContent(status, ctx);
    if (cust) {
      jobs.push(
        notificationService.notify({
          userId: booking.customerId,
          role: CUSTOMER,
          type: cust.type,
          title: cust.title,
          body: cust.body,
          data,
          bookingId: booking._id,
        })
      );
    }

    const mech = mechanicContent(status, ctx);
    if (mech && booking.mechanicId) {
      jobs.push(
        notificationService.notify({
          userId: booking.mechanicId,
          role: MECHANIC,
          type: mech.type,
          title: mech.title,
          body: mech.body,
          data,
          bookingId: booking._id,
        })
      );
    }

    await Promise.all(jobs);
  } catch (err) {
    logger.error(`notifyBookingStatus(${status}) failed: ${err.message}`);
  }
}

module.exports = { notifyBookingStatus };
