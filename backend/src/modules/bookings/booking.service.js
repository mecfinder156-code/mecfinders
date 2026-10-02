'use strict';

const crypto = require('crypto');

const Booking = require('./booking.model');
const BookingService = require('./bookingService.model');
const {
  BOOKING_STATUS,
  BOOKING_TYPE,
  BOOKING_SERVICE_KIND,
  BOOKING_SERVICE_STATUS,
  SERVICE_SOURCE,
  TIMELINE_EVENT,
  SOCKET_EVENTS,
} = require('./booking.constants');
const stateMachine = require('./booking.stateMachine');
const timeline = require('./timeline.service');
const billing = require('./billing.service');
const serializer = require('./booking.serializer');
const socket = require('../../realtime/socket');
const config = require('../../config');
const ApiError = require('../../utils/ApiError');

const Service = require('../services/service.model');
const PriceModel = require('../pricing/price.model');
const Vehicle = require('../vehicles/vehicle.model');
const Address = require('../addresses/address.model');
const User = require('../users/models/user.model');

// Timestamp field written when the booking enters a given status.
const STATUS_TIMESTAMP = {
  [BOOKING_STATUS.MECHANIC_ASSIGNED]: 'assignedAt',
  [BOOKING_STATUS.MECHANIC_ARRIVED]: 'arrivedAt',
  [BOOKING_STATUS.WORK_STARTED]: 'workStartedAt',
  [BOOKING_STATUS.READY_FOR_BILLING]: 'readyForBillingAt',
  [BOOKING_STATUS.COMPLETED]: 'completedAt',
  [BOOKING_STATUS.CANCELLED]: 'cancelledAt',
};

function generateOtp() {
  const len = config.dispatch.otpLength || 4;
  const max = 10 ** len;
  const n = crypto.randomInt(0, max);
  return String(n).padStart(len, '0');
}

/**
 * Emit a lightweight realtime signal. The payload intentionally carries just
 * enough for clients to react/refetch; REST remains the source of truth.
 */
function emitUpdate(booking, event = SOCKET_EVENTS.BOOKING_UPDATED, extra = {}) {
  const payload = { bookingId: String(booking._id), status: booking.status, ...extra };
  socket.emitToBooking(booking._id, event, payload);
  socket.emitToUser(booking.customerId, event, payload);
  if (booking.mechanicId) socket.emitToUser(booking.mechanicId, event, payload);
}

/**
 * Apply a validated state-machine transition: assert legality, set the status +
 * its server-side timestamp, persist, append the timeline record, and emit.
 */
async function applyTransition(booking, toStatus, { actor = null, event = null, message = null, meta = null } = {}) {
  const from = booking.status;
  stateMachine.assertTransition(from, toStatus);
  booking.status = toStatus;
  const tsField = STATUS_TIMESTAMP[toStatus];
  if (tsField && !booking[tsField]) booking[tsField] = new Date();
  await booking.save();

  await timeline.logEvent({
    bookingId: booking._id,
    event: event || toStatus,
    actor,
    fromStatus: from,
    toStatus,
    message,
    meta,
  });

  emitUpdate(booking, SOCKET_EVENTS.BOOKING_STATUS_CHANGED, { previousStatus: from });

  // Fire in-app / push notifications for this transition (best-effort).
  const bookingNotifications = require('../notifications/notification.booking');
  bookingNotifications.notifyBookingStatus(booking, toStatus, actor);

  return booking;
}

async function loadServices(bookingId) {
  return BookingService.find({ bookingId }).sort({ kind: 1, createdAt: 1 });
}

/** Batch-load services for many bookings at once → Map(String(bookingId) -> [services]). */
async function loadServicesForBookings(bookingIds) {
  const rows = await BookingService.find({ bookingId: { $in: bookingIds } })
    .sort({ kind: 1, createdAt: 1 })
    .lean();
  const map = new Map();
  for (const row of rows) {
    const k = String(row.bookingId);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(row);
  }
  return map;
}

// --- Authorization helpers ---
function assertCustomerOwns(booking, user) {
  if (String(booking.customerId) !== String(user._id)) {
    throw ApiError.forbidden('This booking does not belong to you');
  }
}
function assertMechanicAssigned(booking, user) {
  if (!booking.mechanicId || String(booking.mechanicId) !== String(user._id)) {
    throw ApiError.forbidden('This booking is not assigned to you');
  }
}

/**
 * Create a booking from the customer app.
 */
async function createBooking(customer, payload) {
  const { serviceId, vehicleId, bookingType, scheduledAt, addressId, liveLocation } = payload;

  if (!Object.values(BOOKING_TYPE).includes(bookingType)) {
    throw ApiError.badRequest('Invalid booking type');
  }
  if (bookingType === BOOKING_TYPE.SCHEDULED) {
    if (!scheduledAt || Number.isNaN(Date.parse(scheduledAt))) {
      throw ApiError.badRequest('scheduledAt is required for scheduled bookings');
    }
    if (new Date(scheduledAt).getTime() < Date.now() - 60_000) {
      throw ApiError.badRequest('scheduledAt must be in the future');
    }
  }

  // Vehicle must belong to the customer; its category drives service eligibility.
  const vehicle = await Vehicle.findOne({ _id: vehicleId, customerId: customer._id }).populate(
    'vehicleCategoryId',
    'name'
  );
  if (!vehicle) throw ApiError.badRequest('Invalid vehicle');

  const service = await Service.findById(serviceId);
  if (!service || !service.isActive) throw ApiError.badRequest('Service not available');

  // The service's vehicle category MUST match the selected vehicle's category.
  if (String(service.vehicleCategoryId) !== String(vehicle.vehicleCategoryId._id || vehicle.vehicleCategoryId)) {
    throw ApiError.badRequest('This service is not compatible with the selected vehicle');
  }

  const price = await PriceModel.findOne({ serviceId, isActive: true });
  if (!price) throw ApiError.badRequest('This service has no active pricing');

  // Resolve service location: either a saved address or a live location.
  let serviceLocation;
  if (addressId) {
    const address = await Address.findOne({ _id: addressId, customerId: customer._id });
    if (!address) throw ApiError.badRequest('Invalid address');
    serviceLocation = {
      addressId: address._id,
      label: address.label,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      landmark: address.landmark,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      formattedAddress: address.formattedAddress,
      latitude: address.latitude,
      longitude: address.longitude,
    };
  } else if (liveLocation && (liveLocation.latitude != null || liveLocation.addressLine1)) {
    serviceLocation = {
      addressId: null,
      label: 'LIVE',
      addressLine1: liveLocation.addressLine1 || liveLocation.formattedAddress || 'Current location',
      city: liveLocation.city,
      state: liveLocation.state,
      postalCode: liveLocation.postalCode,
      formattedAddress: liveLocation.formattedAddress,
      latitude: liveLocation.latitude ?? null,
      longitude: liveLocation.longitude ?? null,
    };
  } else {
    throw ApiError.badRequest('A service location (saved address or live location) is required');
  }

  const booking = await Booking.create({
    customerId: customer._id,
    originalServiceId: service._id,
    vehicle: {
      vehicleId: vehicle._id,
      vehicleCategoryId: vehicle.vehicleCategoryId._id || vehicle.vehicleCategoryId,
      categoryName: vehicle.vehicleCategoryId.name,
      make: vehicle.make,
      model: vehicle.model,
      registrationNumber: vehicle.registrationNumber,
      fuelType: vehicle.fuelType,
      nickname: vehicle.nickname,
    },
    serviceLocation,
    bookingType,
    scheduledAt: bookingType === BOOKING_TYPE.SCHEDULED ? new Date(scheduledAt) : null,
    status: BOOKING_STATUS.CREATED,
    otp: generateOtp(),
    paymentStatus: 'PENDING',
  });

  // Snapshot the original service as the first (auto-accepted) line item.
  await BookingService.create({
    bookingId: booking._id,
    kind: BOOKING_SERVICE_KIND.ORIGINAL,
    serviceSource: SERVICE_SOURCE.SERVICE,
    serviceRef: service._id,
    name: service.name,
    priceSnapshot: {
      servicePrice: price.servicePrice,
      gstPercentage: price.gstPercentage,
      gstAmount: price.gstAmount,
      platformFee: price.platformFee,
      totalPrice: price.totalPrice,
      companyAmount: price.companyAmount != null ? price.companyAmount : price.totalPrice - price.servicePrice,
      breakdown: price.breakdown || [],
    },
    status: BOOKING_SERVICE_STATUS.ACCEPTED,
    checklist: (service.checklist || []).map((c) => ({ label: c.label, required: c.required, done: false })),
  });

  await timeline.logEvent({
    bookingId: booking._id,
    event: TIMELINE_EVENT.BOOKING_CREATED,
    actor: customer,
    toStatus: BOOKING_STATUS.CREATED,
    message: `Booking created (${bookingType})`,
  });

  // Move into searching and kick backend-controlled dispatch.
  await applyTransition(booking, BOOKING_STATUS.SEARCHING_MECHANIC, {
    actor: customer,
    event: TIMELINE_EVENT.SEARCHING_MECHANIC,
  });

  const dispatch = require('./dispatch.service');
  await dispatch.startDispatch(booking);

  return booking;
}

/**
 * Fetch a booking with authorization + audience-appropriate serialization.
 */
async function getBookingForUser(bookingId, user, { includeTimeline = false } = {}) {
  const booking = await Booking.findById(bookingId).select('+otp');
  if (!booking) throw ApiError.notFound('Booking not found');

  const role = user.role;
  const isCustomer = String(booking.customerId) === String(user._id);
  const isMechanic = booking.mechanicId && String(booking.mechanicId) === String(user._id);
  const isAdmin = role === 'admin' || role === 'superadmin';
  if (!isCustomer && !isMechanic && !isAdmin) throw ApiError.forbidden('Not allowed');

  const services = await loadServices(bookingId);
  const tl = includeTimeline ? await timeline.getTimeline(bookingId) : null;

  if (isCustomer) {
    const mechanic = booking.mechanicId ? await User.findById(booking.mechanicId) : null;
    return serializer.forCustomer(booking, { services, mechanic, timeline: tl });
  }
  if (isMechanic) {
    const customer = await User.findById(booking.customerId);
    return serializer.forMechanic(booking, { services, customer, timeline: tl });
  }
  const [mechanic, customer] = await Promise.all([
    booking.mechanicId ? User.findById(booking.mechanicId) : null,
    User.findById(booking.customerId),
  ]);
  return serializer.forAdmin(booking, { services, mechanic, customer, timeline: tl });
}

async function listCustomerBookings(customerId, { status, page = 1, limit = 20 } = {}) {
  const filter = { customerId };
  if (status) filter.status = status;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Booking.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Booking.countDocuments(filter),
  ]);
  if (!items.length) return { items: [], total, page, limit, pages: Math.ceil(total / limit) };

  // Batch-load services + mechanics in ONE query each (avoids N+1 per booking).
  const bookingIds = items.map((b) => b._id);
  const mechanicIds = [...new Set(items.filter((b) => b.mechanicId).map((b) => String(b.mechanicId)))];
  const [allServices, mechanics] = await Promise.all([
    BookingService.find({ bookingId: { $in: bookingIds } }).sort({ kind: 1, createdAt: 1 }).lean(),
    mechanicIds.length ? User.find({ _id: { $in: mechanicIds } }).lean() : [],
  ]);
  const servicesByBooking = groupBy(allServices, 'bookingId');
  const mechById = new Map(mechanics.map((m) => [String(m._id), m]));

  const withServices = items.map((b) =>
    serializer.forCustomer(b, {
      services: servicesByBooking.get(String(b._id)) || [],
      mechanic: b.mechanicId ? mechById.get(String(b.mechanicId)) || null : null,
    })
  );
  return { items: withServices, total, page, limit, pages: Math.ceil(total / limit) };
}

async function listMechanicBookings(mechanicId, { status, page = 1, limit = 20 } = {}) {
  const filter = { mechanicId };
  if (status) filter.status = status;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Booking.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Booking.countDocuments(filter),
  ]);
  if (!items.length) return { items: [], total, page, limit, pages: Math.ceil(total / limit) };

  const bookingIds = items.map((b) => b._id);
  const customerIds = [...new Set(items.map((b) => String(b.customerId)))];
  const [allServices, customers] = await Promise.all([
    BookingService.find({ bookingId: { $in: bookingIds } }).sort({ kind: 1, createdAt: 1 }).lean(),
    User.find({ _id: { $in: customerIds } }).lean(),
  ]);
  const servicesByBooking = groupBy(allServices, 'bookingId');
  const custById = new Map(customers.map((c) => [String(c._id), c]));

  const withServices = items.map((b) =>
    serializer.forMechanic(b, {
      services: servicesByBooking.get(String(b._id)) || [],
      customer: custById.get(String(b.customerId)) || null,
    })
  );
  return { items: withServices, total, page, limit, pages: Math.ceil(total / limit) };
}

/** Group an array of docs into a Map keyed by String(doc[field]). */
function groupBy(rows, field) {
  const map = new Map();
  for (const row of rows) {
    const k = String(row[field]);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(row);
  }
  return map;
}

/**
 * Mechanic marks arrival at the customer location.
 */
async function markArrived(bookingId, mechanicUser) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw ApiError.notFound('Booking not found');
  assertMechanicAssigned(booking, mechanicUser);
  await applyTransition(booking, BOOKING_STATUS.MECHANIC_ARRIVED, {
    actor: mechanicUser,
    event: TIMELINE_EVENT.MECHANIC_ARRIVED,
  });
  return booking;
}

/**
 * Mechanic verifies the customer-provided OTP; on success work starts.
 */
async function verifyOtpAndStartWork(bookingId, mechanicUser, otp) {
  const booking = await Booking.findById(bookingId).select('+otp +otpAttempts');
  if (!booking) throw ApiError.notFound('Booking not found');
  assertMechanicAssigned(booking, mechanicUser);

  if (booking.status === BOOKING_STATUS.WORK_STARTED) {
    return booking; // idempotent
  }
  if (booking.status !== BOOKING_STATUS.MECHANIC_ARRIVED) {
    throw ApiError.conflict('You must mark arrival before starting work');
  }
  if (booking.otpVerifiedAt) {
    throw ApiError.conflict('OTP already used');
  }
  if (booking.otpAttempts >= (config.dispatch.otpMaxAttempts || 5)) {
    throw ApiError.badRequest('Too many incorrect attempts. Contact support.');
  }
  if (!otp || String(otp).trim() !== booking.otp) {
    booking.otpAttempts += 1;
    await booking.save();
    throw ApiError.badRequest('Incorrect OTP');
  }

  booking.otpVerifiedAt = new Date();
  await booking.save();
  await timeline.logEvent({
    bookingId: booking._id,
    event: TIMELINE_EVENT.OTP_VERIFIED,
    actor: mechanicUser,
  });

  await applyTransition(booking, BOOKING_STATUS.WORK_STARTED, {
    actor: mechanicUser,
    event: TIMELINE_EVENT.WORK_STARTED,
  });
  return booking;
}

/**
 * Mechanic completes work. All REQUIRED checklist items across billable line
 * items must be done. On success the booking moves to READY_FOR_BILLING and the
 * bill is generated from price snapshots.
 */
async function completeWork(bookingId, mechanicUser) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw ApiError.notFound('Booking not found');
  assertMechanicAssigned(booking, mechanicUser);

  if (booking.status === BOOKING_STATUS.READY_FOR_BILLING) {
    return booking; // idempotent
  }
  if (booking.status !== BOOKING_STATUS.WORK_STARTED) {
    throw ApiError.conflict('Work has not started');
  }

  const services = await loadServices(bookingId);
  const billable = services.filter((s) =>
    billing.BILLABLE_STATUSES.includes(s.status)
  );
  for (const item of billable) {
    const incomplete = (item.checklist || []).filter((c) => c.required && !c.done);
    if (incomplete.length > 0) {
      throw ApiError.badRequest('Complete all required checklist items before ending service.');
    }
  }

  // Mark billable services completed.
  for (const item of billable) {
    if (item.status !== BOOKING_SERVICE_STATUS.COMPLETED) {
      item.status = BOOKING_SERVICE_STATUS.COMPLETED;
      item.completedAt = new Date();
      await item.save();
    }
  }

  await billing.generateBill(booking);
  await applyTransition(booking, BOOKING_STATUS.READY_FOR_BILLING, {
    actor: mechanicUser,
    event: TIMELINE_EVENT.READY_FOR_BILLING,
  });
  await timeline.logEvent({
    bookingId: booking._id,
    event: TIMELINE_EVENT.BILL_GENERATED,
    actor: mechanicUser,
    meta: booking.bill,
  });
  emitUpdate(booking, SOCKET_EVENTS.BILL_GENERATED, { bill: booking.bill });
  return booking;
}

/**
 * Cancel a booking (customer/mechanic/admin) if it is not already terminal or
 * past the point where cancellation is allowed.
 */
async function cancelBooking(bookingId, actorUser, reason) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw ApiError.notFound('Booking not found');

  const role = actorUser.role;
  const isCustomer = String(booking.customerId) === String(actorUser._id);
  const isMechanic = booking.mechanicId && String(booking.mechanicId) === String(actorUser._id);
  const isAdmin = role === 'admin' || role === 'superadmin';
  if (!isCustomer && !isMechanic && !isAdmin) throw ApiError.forbidden('Not allowed');

  if (stateMachine.isTerminal(booking.status)) {
    throw ApiError.conflict(`Booking already ${booking.status}`);
  }
  // Cannot cancel once payment/billing is underway.
  if (
    [BOOKING_STATUS.READY_FOR_BILLING, BOOKING_STATUS.PAYMENT_PENDING, BOOKING_STATUS.PAID].includes(
      booking.status
    )
  ) {
    throw ApiError.conflict('Booking cannot be cancelled at this stage');
  }

  booking.cancellation = {
    by: isCustomer ? 'customer' : isMechanic ? 'mechanic' : 'admin',
    reason: reason || null,
  };
  await applyTransition(booking, BOOKING_STATUS.CANCELLED, {
    actor: actorUser,
    event: TIMELINE_EVENT.CANCELLED,
    message: reason || null,
  });

  // Close any open dispatch offers.
  const dispatch = require('./dispatch.service');
  await dispatch.closeOffers(booking._id, 'Booking cancelled');
  return booking;
}

module.exports = {
  generateOtp,
  emitUpdate,
  applyTransition,
  loadServices,
  loadServicesForBookings,
  createBooking,
  getBookingForUser,
  listCustomerBookings,
  listMechanicBookings,
  markArrived,
  verifyOtpAndStartWork,
  completeWork,
  cancelBooking,
  assertCustomerOwns,
  assertMechanicAssigned,
};
