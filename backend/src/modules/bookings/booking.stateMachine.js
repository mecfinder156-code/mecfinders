'use strict';

const { BOOKING_STATUS, TERMINAL_STATUSES } = require('./booking.constants');
const ApiError = require('../../utils/ApiError');

/**
 * Booking state machine.
 *
 * The backend is the ONLY authority on booking status. Clients never set a
 * status directly; they call intent endpoints (accept, arrive, start-work,
 * generate-bill, pay, complete...) and the service layer transitions the
 * booking through this map. Any transition not listed here is rejected.
 */
const TRANSITIONS = Object.freeze({
  [BOOKING_STATUS.CREATED]: [
    BOOKING_STATUS.SEARCHING_MECHANIC,
    BOOKING_STATUS.MECHANIC_ASSIGNED, // scheduled bookings can be assigned directly
    BOOKING_STATUS.CANCELLED,
  ],
  [BOOKING_STATUS.SEARCHING_MECHANIC]: [
    BOOKING_STATUS.MECHANIC_ASSIGNED,
    BOOKING_STATUS.EXPIRED,
    BOOKING_STATUS.CANCELLED,
  ],
  [BOOKING_STATUS.MECHANIC_ASSIGNED]: [
    BOOKING_STATUS.MECHANIC_ARRIVED,
    BOOKING_STATUS.CANCELLED,
  ],
  [BOOKING_STATUS.MECHANIC_ARRIVED]: [
    BOOKING_STATUS.WORK_STARTED,
    BOOKING_STATUS.CANCELLED,
  ],
  [BOOKING_STATUS.WORK_STARTED]: [
    BOOKING_STATUS.READY_FOR_BILLING,
    BOOKING_STATUS.CANCELLED,
  ],
  [BOOKING_STATUS.READY_FOR_BILLING]: [
    BOOKING_STATUS.PAYMENT_PENDING,
  ],
  [BOOKING_STATUS.PAYMENT_PENDING]: [
    BOOKING_STATUS.PAID,
    BOOKING_STATUS.READY_FOR_BILLING, // payment failed -> back to billing
  ],
  [BOOKING_STATUS.PAID]: [
    BOOKING_STATUS.COMPLETED,
  ],
  // Terminal states have no outgoing transitions.
  [BOOKING_STATUS.COMPLETED]: [],
  [BOOKING_STATUS.CANCELLED]: [],
  [BOOKING_STATUS.EXPIRED]: [],
});

function canTransition(from, to) {
  const allowed = TRANSITIONS[from] || [];
  return allowed.includes(to);
}

function isTerminal(status) {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Assert a transition is legal, throwing a 409 otherwise. Used by the service
 * layer before persisting a status change.
 */
function assertTransition(from, to) {
  if (from === to) return; // idempotent no-op
  if (!canTransition(from, to)) {
    throw ApiError.conflict(`Invalid booking transition: ${from} -> ${to}`);
  }
}

module.exports = { TRANSITIONS, canTransition, isTerminal, assertTransition };
