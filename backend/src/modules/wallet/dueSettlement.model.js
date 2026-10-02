'use strict';

const mongoose = require('mongoose');
const { PAYMENT_STATUS } = require('../bookings/booking.constants');

/**
 * A mechanic's payment to clear the platform due they accrued from cash
 * bookings (the company's GST + platform-fee share they collected as cash).
 * Paid online via Razorpay. On success a DUE_CLEARED wallet CREDIT moves the
 * wallet balance back toward zero. A unique `razorpayOrderId` plus the
 * booking-scoped idempotencyKey on the ledger keep it settle-once.
 */
const dueSettlementSchema = new mongoose.Schema(
  {
    mechanicId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    amount: { type: Number, required: true, min: 1 }, // rupees the mechanic pays

    status: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.PENDING },

    razorpayOrderId: { type: String, default: null, index: true },
    razorpayPaymentId: { type: String, default: null },
    razorpaySignature: { type: String, default: null },

    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

dueSettlementSchema.index(
  { razorpayPaymentId: 1 },
  { unique: true, partialFilterExpression: { razorpayPaymentId: { $type: 'string' } } }
);

module.exports = mongoose.model('DueSettlement', dueSettlementSchema);
