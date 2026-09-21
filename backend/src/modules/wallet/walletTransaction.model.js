'use strict';

const mongoose = require('mongoose');
const { WALLET_TXN_TYPE, WALLET_TXN_DIRECTION } = require('../bookings/booking.constants');

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

    // Guards against duplicate ledger writes for the same business event.
    idempotencyKey: { type: String, required: true, unique: true },

    balanceAfter: { type: Number, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

walletTransactionSchema.index({ mechanicId: 1, createdAt: -1 });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
