'use strict';

/**
 * Serializers control exactly what each audience sees. The service-start OTP is
 * only ever exposed to the customer; the mechanic-facing serializer omits it.
 */

function baseBooking(booking) {
  const b = booking.toObject ? booking.toObject() : booking;
  return {
    _id: b._id,
    status: b.status,
    bookingType: b.bookingType,
    scheduledAt: b.scheduledAt,
    scheduledEndAt: b.scheduledEndAt,
    originalServiceId: b.originalServiceId,
    vehicle: b.vehicle,
    serviceLocation: b.serviceLocation,
    paymentMethod: b.paymentMethod,
    paymentStatus: b.paymentStatus,
    bill: b.bill,
    ratingId: b.ratingId,
    assignedAt: b.assignedAt,
    arrivedAt: b.arrivedAt,
    workStartedAt: b.workStartedAt,
    readyForBillingAt: b.readyForBillingAt,
    completedAt: b.completedAt,
    cancelledAt: b.cancelledAt,
    cancellation: b.cancellation,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

function publicMechanic(mechanic) {
  if (!mechanic) return null;
  const m = mechanic.toObject ? mechanic.toObject() : mechanic;
  return {
    _id: m._id,
    name: m.name,
    profileImage: m.profileImage || null,
    ratingAverage: m.ratingAverage || 0,
    ratingCount: m.ratingCount || 0,
    phone: m.phone || null,
    currentLocation:
      m.currentLocation && Array.isArray(m.currentLocation.coordinates)
        ? {
            latitude: m.currentLocation.coordinates[1],
            longitude: m.currentLocation.coordinates[0],
            updatedAt: m.currentLocation.updatedAt,
          }
        : null,
  };
}

function publicCustomer(customer) {
  if (!customer) return null;
  const c = customer.toObject ? customer.toObject() : customer;
  return {
    _id: c._id,
    name: c.name,
    profileImage: c.profileImage || null,
    phone: c.phone || null,
  };
}

function serviceItem(item) {
  const it = item.toObject ? item.toObject() : item;
  return {
    _id: it._id,
    kind: it.kind,
    name: it.name,
    status: it.status,
    reason: it.reason,
    priceSnapshot: it.priceSnapshot,
    checklist: it.checklist,
    serviceSource: it.serviceSource,
    serviceRef: it.serviceRef,
    respondedAt: it.respondedAt,
    completedAt: it.completedAt,
  };
}

/**
 * Customer view — includes the OTP (which the customer reads out to the
 * mechanic on arrival) and the assigned mechanic's public profile.
 */
function forCustomer(booking, { services = [], mechanic = null, timeline = null } = {}) {
  const out = baseBooking(booking);
  out.otp = booking.otp || null; // requires the caller to have selected +otp
  out.mechanic = publicMechanic(mechanic);
  out.services = services.map(serviceItem);
  if (timeline) out.timeline = timeline;
  return out;
}

/**
 * Mechanic view — NEVER includes the OTP. Includes the customer's public
 * profile so the mechanic can contact/identify them.
 */
function forMechanic(booking, { services = [], customer = null, timeline = null } = {}) {
  const out = baseBooking(booking);
  out.customer = publicCustomer(customer);
  out.services = services.map(serviceItem);
  if (timeline) out.timeline = timeline;
  return out;
}

/** Admin view — full visibility (still no plaintext OTP by default). */
function forAdmin(booking, { services = [], mechanic = null, customer = null, timeline = null } = {}) {
  const out = baseBooking(booking);
  out.mechanic = publicMechanic(mechanic);
  out.customer = publicCustomer(customer);
  out.services = services.map(serviceItem);
  if (timeline) out.timeline = timeline;
  return out;
}

module.exports = { forCustomer, forMechanic, forAdmin, publicMechanic, publicCustomer, serviceItem };
