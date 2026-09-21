'use strict';

/**
 * Booking lifecycle constants.
 *
 * These are the single source of truth for booking status, request status,
 * booking-service (line item) status, payment, wallet and realtime event
 * names. Both the mobile apps and the admin panel derive their vocabulary
 * from these values, so they must stay stable.
 */

// --- Main booking status (the state machine states) ---
const BOOKING_STATUS = Object.freeze({
  CREATED: 'CREATED',
  SEARCHING_MECHANIC: 'SEARCHING_MECHANIC',
  MECHANIC_ASSIGNED: 'MECHANIC_ASSIGNED',
  MECHANIC_ARRIVED: 'MECHANIC_ARRIVED',
  WORK_STARTED: 'WORK_STARTED',
  READY_FOR_BILLING: 'READY_FOR_BILLING',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  PAID: 'PAID',
  COMPLETED: 'COMPLETED',
  // Terminal / exception states
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED', // no mechanic accepted
});

// Statuses that are terminal (no further transitions allowed).
const TERMINAL_STATUSES = Object.freeze([
  BOOKING_STATUS.COMPLETED,
  BOOKING_STATUS.CANCELLED,
  BOOKING_STATUS.EXPIRED,
]);

const BOOKING_TYPE = Object.freeze({
  INSTANT: 'INSTANT',
  SCHEDULED: 'SCHEDULED',
});

// --- Mechanic request (dispatch offer) status ---
const REQUEST_STATUS = Object.freeze({
  PENDING: 'PENDING', // offered, waiting for mechanic response
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED', // timed out
  CANCELLED: 'CANCELLED', // superseded (e.g. booking assigned to someone else / cancelled)
});

// --- Booking service (line item) ---
const BOOKING_SERVICE_KIND = Object.freeze({
  ORIGINAL: 'ORIGINAL', // the Service the customer booked
  ADDITIONAL: 'ADDITIONAL', // a MechanicService added during execution
});

// Line-item lifecycle. The ORIGINAL service starts ACCEPTED; ADDITIONAL
// services start REQUESTED and require explicit customer approval.
const BOOKING_SERVICE_STATUS = Object.freeze({
  REQUESTED: 'REQUESTED',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
});

// Which service catalogue a line item references.
const SERVICE_SOURCE = Object.freeze({
  SERVICE: 'Service', // original bookable service (standard catalogue)
  MECHANIC_SERVICE: 'MechanicService', // additional services catalogue
});

// --- Payment ---
const PAYMENT_METHOD = Object.freeze({
  CASH: 'CASH',
  RAZORPAY: 'RAZORPAY',
});

const PAYMENT_STATUS = Object.freeze({
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
});

// --- Wallet ledger ---
const WALLET_TXN_DIRECTION = Object.freeze({
  CREDIT: 'CREDIT',
  DEBIT: 'DEBIT',
});

const WALLET_TXN_TYPE = Object.freeze({
  SERVICE_EARNING: 'SERVICE_EARNING', // the mechanic's earning (service price)
  PLATFORM_DUE: 'PLATFORM_DUE', // cash booking: company's cut the mechanic owes -> DEBIT (negative)
  PLATFORM_FEE: 'PLATFORM_FEE', // company platform fee portion (record only)
  GST: 'GST', // company GST portion (record only)
  CASH_COLLECTION: 'CASH_COLLECTION', // provider collected cash on behalf of platform
  PLATFORM_SETTLEMENT: 'PLATFORM_SETTLEMENT', // legacy
  RAZORPAY_SETTLEMENT: 'RAZORPAY_SETTLEMENT', // legacy
  ADJUSTMENT: 'ADJUSTMENT',
  WITHDRAWAL: 'WITHDRAWAL',
});

// --- Timeline event types (audit trail) ---
const TIMELINE_EVENT = Object.freeze({
  BOOKING_CREATED: 'BOOKING_CREATED',
  SEARCHING_MECHANIC: 'SEARCHING_MECHANIC',
  REQUEST_SENT: 'REQUEST_SENT',
  REQUEST_REJECTED: 'REQUEST_REJECTED',
  REQUEST_EXPIRED: 'REQUEST_EXPIRED',
  MECHANIC_ASSIGNED: 'MECHANIC_ASSIGNED',
  MECHANIC_ARRIVED: 'MECHANIC_ARRIVED',
  OTP_VERIFIED: 'OTP_VERIFIED',
  WORK_STARTED: 'WORK_STARTED',
  ADDITIONAL_SERVICE_REQUESTED: 'ADDITIONAL_SERVICE_REQUESTED',
  ADDITIONAL_SERVICE_ACCEPTED: 'ADDITIONAL_SERVICE_ACCEPTED',
  ADDITIONAL_SERVICE_REJECTED: 'ADDITIONAL_SERVICE_REJECTED',
  CHECKLIST_UPDATED: 'CHECKLIST_UPDATED',
  READY_FOR_BILLING: 'READY_FOR_BILLING',
  BILL_GENERATED: 'BILL_GENERATED',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  PAYMENT_COMPLETED: 'PAYMENT_COMPLETED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
  RATING_SUBMITTED: 'RATING_SUBMITTED',
});

// --- Realtime (Socket.IO) event names ---
const SOCKET_EVENTS = Object.freeze({
  // server -> client
  BOOKING_UPDATED: 'booking:updated',
  BOOKING_STATUS_CHANGED: 'booking:status_changed',
  NEW_REQUEST: 'request:new', // mechanic receives a dispatch offer
  REQUEST_CLOSED: 'request:closed', // offer no longer available (assigned/expired)
  ADDITIONAL_SERVICE_REQUESTED: 'additional_service:requested',
  ADDITIONAL_SERVICE_RESOLVED: 'additional_service:resolved',
  BILL_GENERATED: 'bill:generated',
  PAYMENT_UPDATED: 'payment:updated',
  MECHANIC_LOCATION: 'mechanic:location',
  NOTIFICATION_NEW: 'notification:new', // in-app notification pushed to a user's room
  // client -> server
  JOIN_BOOKING: 'booking:join',
  LEAVE_BOOKING: 'booking:leave',
  MECHANIC_LOCATION_UPDATE: 'mechanic:location_update',
});

module.exports = {
  BOOKING_STATUS,
  TERMINAL_STATUSES,
  BOOKING_TYPE,
  REQUEST_STATUS,
  BOOKING_SERVICE_KIND,
  BOOKING_SERVICE_STATUS,
  SERVICE_SOURCE,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  WALLET_TXN_DIRECTION,
  WALLET_TXN_TYPE,
  TIMELINE_EVENT,
  SOCKET_EVENTS,
};
