'use strict';

const mongoose = require('mongoose');

/**
 * MechanicWallet holds cached aggregate balances for a mechanic. The balances
 * are derived from the immutable WalletTransaction ledger; this document is a
 * performance cache that is only ever mutated inside the same atomic operation
 * that appends the corresponding ledger entry (see wallet.service).
 */
const walletSchema = new mongoose.Schema(
  {
    mechanicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    // Provider earnings available/settled to the mechanic.
    balance: { type: Number, default: 0 },

    // Cash the mechanic has collected on the platform's behalf and still owes
    // to the company (GST + platform fee portion of cash bookings).
    payableToPlatform: { type: Number, default: 0 },

    lifetimeEarnings: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MechanicWallet', walletSchema);
