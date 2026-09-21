'use strict';

const mongoose = require('mongoose');
const { PAYMENT_METHOD, PAYMENT_STATUS } = require('../bookings/booking.constants');

/**
 * A payment attempt/record for a booking. For Razorpay we persist the order id
 * and, on verification, the payment id + signature. A unique index on
 * `razorpayPaymentId` plus the booking-level payment status makes webhook /
 * callback processing idempotent (a repeated callback cannot be recorded or
 * settled twice).
 */
const bookingPaymentSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    mechanicId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    method: { type: String, enum: Object.values(PAYMENT_METHOD), required: true },
    status: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.PENDING },

    amount: { type: Number, required: true }, // total customer amount (in rupees)

    // Split snapshot (for reporting/settlement).
    providerEarning: { type: Number, default: 0 },
    companyAmount: { type: Number, default: 0 },

    // Razorpay fields
    razorpayOrderId: { type: String, default: null, index: true },
    razorpayPaymentId: { type: String, default: null },
    razorpaySignature: { type: String, default: null },

    // Cash fields
    cashCollectedAt: { type: Date, default: null },
    cashConfirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    settledAt: { type: Date, default: null }, // when wallet ledger entries were written
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Idempotency: a given Razorpay payment id can be recorded at most once.
bookingPaymentSchema.index(
  { razorpayPaymentId: 1 },
  { unique: true, partialFilterExpression: { razorpayPaymentId: { $type: 'string' } } }
);

module.exports = mongoose.model('BookingPayment', bookingPaymentSchema);
