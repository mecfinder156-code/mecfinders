'use strict';

const Booking = require('./booking.model');
const BookingService = require('./bookingService.model');
const MechanicService = require('../mechanicServices/mechanicService.model');
const MechanicServicePricing = require('../mechanicServicePricing/mechanicServicePricing.model');
const {
  BOOKING_STATUS,
  BOOKING_SERVICE_KIND,
  BOOKING_SERVICE_STATUS,
  SERVICE_SOURCE,
  TIMELINE_EVENT,
  SOCKET_EVENTS,
} = require('./booking.constants');
const timeline = require('./timeline.service');
const socket = require('../../realtime/socket');
const ApiError = require('../../utils/ApiError');

function emitToParticipants(booking, event, payload) {
  socket.emitToBooking(booking._id, event, payload);
  socket.emitToUser(booking.customerId, event, payload);
  if (booking.mechanicId) socket.emitToUser(booking.mechanicId, event, payload);
}

/**
 * Mechanic proposes an additional service from the MechanicService catalogue.
 * Pricing comes from MechanicServicePricing (never a free-typed amount) and is
 * snapshotted onto the line item. Starts in REQUESTED and requires the
 * customer's explicit approval before it becomes billable.
 */
async function addAdditionalService(bookingId, mechanicUser, { mechanicServiceId, reason }) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw ApiError.notFound('Booking not found');
  if (!booking.mechanicId || String(booking.mechanicId) !== String(mechanicUser._id)) {
    throw ApiError.forbidden('This booking is not assigned to you');
  }
  if (booking.status !== BOOKING_STATUS.WORK_STARTED) {
    throw ApiError.conflict('Additional services can only be added while work is in progress');
  }

  const service = await MechanicService.findById(mechanicServiceId);
  if (!service || !service.isActive) throw ApiError.badRequest('Additional service not available');

  const pricing = await MechanicServicePricing.findOne({ mechanicServiceId, isActive: true });
  if (!pricing) throw ApiError.badRequest('This service has no active pricing');

  const item = await BookingService.create({
    bookingId: booking._id,
    kind: BOOKING_SERVICE_KIND.ADDITIONAL,
    serviceSource: SERVICE_SOURCE.MECHANIC_SERVICE,
    serviceRef: service._id,
    name: service.name,
    priceSnapshot: {
      servicePrice: pricing.servicePrice,
      gstPercentage: pricing.gstPercentage,
      gstAmount: pricing.gstAmount,
      platformFee: pricing.platformFee,
      totalPrice: pricing.totalPrice,
      companyAmount: pricing.companyAmount != null ? pricing.companyAmount : pricing.totalPrice - pricing.servicePrice,
      breakdown: pricing.breakdown || [],
    },
    status: BOOKING_SERVICE_STATUS.REQUESTED,
    reason: reason || null,
    requestedBy: mechanicUser._id,
    checklist: (service.checklist || []).map((c) => ({ label: c.label, required: c.required, done: false })),
  });

  await timeline.logEvent({
    bookingId: booking._id,
    event: TIMELINE_EVENT.ADDITIONAL_SERVICE_REQUESTED,
    actor: mechanicUser,
    meta: { bookingServiceId: item._id, name: service.name, price: pricing.totalPrice },
  });

  emitToParticipants(booking, SOCKET_EVENTS.ADDITIONAL_SERVICE_REQUESTED, {
    bookingId: String(booking._id),
    bookingServiceId: String(item._id),
    name: service.name,
    totalPrice: pricing.totalPrice,
  });

  return item;
}

/**
 * Customer accepts or rejects a REQUESTED additional service. Only accepted
 * items become billable; rejected ones never appear on the bill. Cannot be
 * changed once the booking is billing/completed/terminal.
 */
async function respondToAdditionalService(bookingServiceId, customerUser, accept) {
  const item = await BookingService.findById(bookingServiceId);
  if (!item) throw ApiError.notFound('Additional service not found');
  if (item.kind !== BOOKING_SERVICE_KIND.ADDITIONAL) {
    throw ApiError.badRequest('Only additional services can be responded to');
  }

  const booking = await Booking.findById(item.bookingId);
  if (!booking) throw ApiError.notFound('Booking not found');
  if (String(booking.customerId) !== String(customerUser._id)) {
    throw ApiError.forbidden('This booking does not belong to you');
  }
  if (booking.status !== BOOKING_STATUS.WORK_STARTED) {
    throw ApiError.conflict('Additional services can no longer be modified for this booking');
  }
  if (item.status !== BOOKING_SERVICE_STATUS.REQUESTED) {
    throw ApiError.conflict(`This service is already ${item.status}`);
  }

  item.status = accept ? BOOKING_SERVICE_STATUS.ACCEPTED : BOOKING_SERVICE_STATUS.REJECTED;
  item.respondedAt = new Date();
  await item.save();

  await timeline.logEvent({
    bookingId: booking._id,
    event: accept
      ? TIMELINE_EVENT.ADDITIONAL_SERVICE_ACCEPTED
      : TIMELINE_EVENT.ADDITIONAL_SERVICE_REJECTED,
    actor: customerUser,
    meta: { bookingServiceId: item._id, name: item.name },
  });

  emitToParticipants(booking, SOCKET_EVENTS.ADDITIONAL_SERVICE_RESOLVED, {
    bookingId: String(booking._id),
    bookingServiceId: String(item._id),
    status: item.status,
  });

  return item;
}

/**
 * Mechanic marks a checklist item done/undone on a billable line item.
 */
async function updateChecklistItem(bookingServiceId, mechanicUser, itemId, done) {
  const item = await BookingService.findById(bookingServiceId);
  if (!item) throw ApiError.notFound('Service line item not found');

  const booking = await Booking.findById(item.bookingId);
  if (!booking) throw ApiError.notFound('Booking not found');
  if (!booking.mechanicId || String(booking.mechanicId) !== String(mechanicUser._id)) {
    throw ApiError.forbidden('This booking is not assigned to you');
  }
  if (booking.status !== BOOKING_STATUS.WORK_STARTED) {
    throw ApiError.conflict('Checklist can only be updated while work is in progress');
  }
  if (
    ![
      BOOKING_SERVICE_STATUS.ACCEPTED,
      BOOKING_SERVICE_STATUS.IN_PROGRESS,
      BOOKING_SERVICE_STATUS.COMPLETED,
    ].includes(item.status)
  ) {
    throw ApiError.conflict('This service is not active on the booking');
  }

  const checkItem = item.checklist.id(itemId);
  if (!checkItem) throw ApiError.notFound('Checklist item not found');

  checkItem.done = Boolean(done);
  checkItem.completedAt = done ? new Date() : null;
  checkItem.completedBy = done ? mechanicUser._id : null;

  if (item.status === BOOKING_SERVICE_STATUS.ACCEPTED && item.checklist.some((c) => c.done)) {
    item.status = BOOKING_SERVICE_STATUS.IN_PROGRESS;
  }
  await item.save();

  await timeline.logEvent({
    bookingId: booking._id,
    event: TIMELINE_EVENT.CHECKLIST_UPDATED,
    actor: mechanicUser,
    meta: { bookingServiceId: item._id, itemId, done: Boolean(done) },
  });

  emitToParticipants(booking, SOCKET_EVENTS.BOOKING_UPDATED, {
    bookingId: String(booking._id),
    status: booking.status,
  });

  return item;
}

module.exports = {
  addAdditionalService,
  respondToAdditionalService,
  updateChecklistItem,
};
