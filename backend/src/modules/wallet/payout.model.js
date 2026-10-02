'use strict';

const mongoose = require('mongoose');
const { PAYOUT_METHOD } = require('../bookings/booking.constants');

/**
 * A payout the admin made to a mechanic to settle their ONLINE service earnings.
 *
 * Online bookings are collected into the platform account; the admin pays the
 * mechanic their earning out-of-band (bank transfer / UPI / cash) and records it
 * here. Creating a payout flips the covered SERVICE_EARNING ledger rows from
 * UNPAID -> PAID (so the mechanic's outstanding payable drops by `amount`) and
 * appends one informational PAYOUT entry to the immutable wallet ledger.
 *
 * `amount` always equals the sum of the covered earnings, so the per-earning
 * ledger stays the single source of truth for "earned / paid / outstanding".
 */
const mechanicPayoutSchema = new mongoose.Schema(
  {
    mechanicId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    amount: { type: Number, required: true, min: 1 }, // rupees paid to the mechanic
    earningsCount: { type: Number, required: true, min: 1 },
    // The SERVICE_EARNING ledger rows this payout settled.
    earningIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'WalletTransaction', default: [] },

    method: { type: String, enum: Object.values(PAYOUT_METHOD), default: PAYOUT_METHOD.BANK_TRANSFER },
    reference: { type: String, trim: true, default: null }, // UTR / UPI ref / cheque no
    note: { type: String, trim: true, default: null },

    paidAt: { type: Date, default: () => new Date() },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // admin

    // Snapshot of the mechanic's payable position after this payout, for display.
    outstandingAfter: { type: Number, default: null },
  },
  { timestamps: true }
);

mechanicPayoutSchema.index({ mechanicId: 1, createdAt: -1 });

module.exports = mongoose.model('MechanicPayout', mechanicPayoutSchema);
