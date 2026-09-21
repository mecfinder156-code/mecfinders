'use strict';

const mongoose = require('mongoose');
const {
  BOOKING_STATUS,
  BOOKING_TYPE,
  PAYMENT_STATUS,
  PAYMENT_METHOD,
} = require('./booking.constants');

/**
 * Snapshot of the service location at booking time. We copy the resolved
 * address rather than only referencing the Address document so that later
 * edits/deletes of the saved address never mutate historical bookings.
 */
const serviceLocationSchema = new mongoose.Schema(
  {
    addressId: { type: mongoose.Schema.Types.ObjectId, ref: 'Address', default: null },
    label: { type: String, trim: true }, // HOME / WORK / OTHER / LIVE
    addressLine1: { type: String, trim: true },
    addressLine2: { type: String, trim: true },
    landmark: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    formattedAddress: { type: String, trim: true },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
  },
  { _id: false }
);

/** Snapshot of the vehicle so historical bookings are stable. */
const vehicleSnapshotSchema = new mongoose.Schema(
  {
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', default: null },
    vehicleCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'VehicleCategory', default: null },
    categoryName: { type: String, trim: true },
    make: { type: String, trim: true },
    model: { type: String, trim: true },
    registrationNumber: { type: String, trim: true },
    fuelType: { type: String, trim: true },
    nickname: { type: String, trim: true },
  },
  { _id: false }
);

/**
 * Money totals for the whole booking. Recomputed from the accepted/completed
 * BookingService line items (each of which carries its own price snapshot) at
 * billing time and stored here. Provider earning = sum of service prices only.
 */
const billSchema = new mongoose.Schema(
  {
    serviceCharges: { type: Number, default: 0 }, // sum of servicePrice (provider earning)
    gstAmount: { type: Number, default: 0 },
    platformFee: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 }, // what the customer pays
    providerEarning: { type: Number, default: 0 }, // == serviceCharges
    companyAmount: { type: Number, default: 0 }, // == totalAmount - serviceCharges
    // Generic breakdown (GST, platform fee, extra taxes/fees/discounts) merged
    // across line items, so bills render whatever charges were configured.
    breakdown: {
      type: [
        new mongoose.Schema({ label: String, kind: String, amount: Number }, { _id: false }),
      ],
      default: [],
    },
    generatedAt: { type: Date, default: null },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mechanicId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    originalServiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    vehicle: { type: vehicleSnapshotSchema, required: true },
    serviceLocation: { type: serviceLocationSchema, required: true },

    bookingType: { type: String, enum: Object.values(BOOKING_TYPE), required: true },
    scheduledAt: { type: Date, default: null }, // required for SCHEDULED
    scheduledEndAt: { type: Date, default: null },

    status: {
      type: String,
      enum: Object.values(BOOKING_STATUS),
      default: BOOKING_STATUS.CREATED,
      index: true,
    },

    // Service-start OTP. Plaintext is exposed only to the customer via the
    // customer serializer; mechanic-facing responses never include `otp`.
    otp: { type: String, default: null, select: false },
    otpAttempts: { type: Number, default: 0, select: false },
    otpVerifiedAt: { type: Date, default: null },

    // Payment
    paymentMethod: { type: String, enum: Object.values(PAYMENT_METHOD), default: null },
    paymentStatus: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.PENDING },

    bill: { type: billSchema, default: () => ({}) },

    ratingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Rating', default: null },

    // Server-side lifecycle timestamps (never trust client timestamps).
    assignedAt: { type: Date, default: null },
    arrivedAt: { type: Date, default: null },
    workStartedAt: { type: Date, default: null },
    readyForBillingAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },

    cancellation: {
      by: { type: String, enum: ['customer', 'mechanic', 'admin', 'system', null], default: null },
      reason: { type: String, trim: true, default: null },
    },
  },
  { timestamps: true }
);

bookingSchema.index({ customerId: 1, status: 1, createdAt: -1 });
bookingSchema.index({ mechanicId: 1, status: 1, createdAt: -1 });
bookingSchema.index({ status: 1, bookingType: 1, createdAt: -1 });

module.exports = mongoose.model('Booking', bookingSchema);
