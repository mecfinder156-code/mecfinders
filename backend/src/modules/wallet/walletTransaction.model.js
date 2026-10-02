'use strict';

const mongoose = require('mongoose');
const {
  WALLET_TXN_TYPE,
  WALLET_TXN_DIRECTION,
  PAYOUT_STATUS,
  SETTLEMENT_STATUS,
} = require('../bookings/booking.constants');

/**
 * Immutable wallet ledger entry. Balances are derived from these records; a
 * row is never updated or deleted once written. A unique `idempotencyKey`
 * guarantees a given business event (e.g. "settle booking X earning") can only
 * ever create one entry, so duplicate payment callbacks cannot double-credit.
 */
const walletTransactionSchema = new mongoose.Schema(
  {
    walletId: { type: mongoose.Schema.Types.ObjectId, ref: 'MechanicWallet', required: true, index: true },
    mechanicId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null, index: true },

    type: { type: String, enum: Object.values(WALLET_TXN_TYPE), required: true },
    direction: { type: String, enum: Object.values(WALLET_TXN_DIRECTION), required: true },
    amount: { type: Number, required: true, min: 0 },

    // Which cached balance this entry moves.
    affects: {
      type: String,
      enum: ['balance', 'payableToPlatform', 'none'],
      default: 'balance',
    },

    reason: { type: String, trim: true, default: null },
    reference: { type: String, trim: true, default: null }, // e.g. razorpay payment id

    // Settlement lifecycle for ONLINE earnings paid out via Razorpay Route.
    // PROCESSING = captured at Razorpay, payout to the mechanic's bank pending;
    // SETTLED = Razorpay settled it to their bank (the "settled" history entry).
    settlementStatus: {
      type: String,
      enum: Object.values(SETTLEMENT_STATUS),
      default: SETTLEMENT_STATUS.NA,
    },
    settledAt: { type: Date, default: null },
    // Razorpay Route transfer id (trf_...) backing this earning, when split.
    transferId: { type: String, default: null },

    // Manual-payout lifecycle for ONLINE earnings. The platform collects the
    // customer's payment, then an admin pays the mechanic their earning
    // out-of-band and marks it PAID — which reduces the mechanic's outstanding
    // payable. Cash earnings / dues stay NA (nothing for the platform to pay).
    payoutStatus: {
      type: String,
      enum: Object.values(PAYOUT_STATUS),
      default: PAYOUT_STATUS.NA,
      index: true,
    },
    // The MechanicPayout that settled this earning, once PAID.
    payoutId: { type: mongoose.Schema.Types.ObjectId, ref: 'MechanicPayout', default: null },
    paidOutAt: { type: Date, default: null },

    // Guards against duplicate ledger writes for the same business event.
    idempotencyKey: { type: String, required: true, unique: true },

    balanceAfter: { type: Number, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

walletTransactionSchema.index({ mechanicId: 1, createdAt: -1 });
// Admin payout aggregation: earnings by mechanic + payout status, newest first.
walletTransactionSchema.index({ type: 1, payoutStatus: 1, mechanicId: 1, createdAt: -1 });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
