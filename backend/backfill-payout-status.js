'use strict';

/**
 * One-off migration: give existing ONLINE service earnings a payout status.
 *
 * The payout model (per-mechanic earned / paid / outstanding, settled manually
 * by an admin) keys off `payoutStatus` on each SERVICE_EARNING ledger row. Rows
 * written before this field existed default to NA, so they would not appear as
 * payable in the admin wallet. This backfills them from the old Route-era
 * `settlementStatus`:
 *
 *   settlementStatus PROCESSING -> payoutStatus UNPAID  (platform still owes it)
 *   settlementStatus SETTLED    -> payoutStatus PAID    (already reached the bank)
 *
 * Cash earnings (settlementStatus NA) stay NA — the mechanic already took the
 * cash, there is nothing to pay out. Idempotent: only touches rows still at NA.
 */

const mongoose = require('mongoose');
require('dotenv').config();

const WalletTransaction = require('./src/modules/wallet/walletTransaction.model');
const {
  WALLET_TXN_TYPE,
  PAYOUT_STATUS,
  SETTLEMENT_STATUS,
} = require('./src/modules/bookings/booking.constants');

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri);
  console.log('Connected. Backfilling payoutStatus on legacy online earnings…');

  const unpaid = await WalletTransaction.updateMany(
    {
      type: WALLET_TXN_TYPE.SERVICE_EARNING,
      payoutStatus: PAYOUT_STATUS.NA,
      settlementStatus: SETTLEMENT_STATUS.PROCESSING,
    },
    { $set: { payoutStatus: PAYOUT_STATUS.UNPAID } }
  );

  const settled = await WalletTransaction.find({
    type: WALLET_TXN_TYPE.SERVICE_EARNING,
    payoutStatus: PAYOUT_STATUS.NA,
    settlementStatus: SETTLEMENT_STATUS.SETTLED,
  }).select('_id settledAt');
  for (const t of settled) {
    t.payoutStatus = PAYOUT_STATUS.PAID;
    t.paidOutAt = t.settledAt || t.paidOutAt || new Date();
    await t.save();
  }

  console.log(`  -> ${unpaid.modifiedCount} earnings marked UNPAID (pending payout)`);
  console.log(`  -> ${settled.length} earnings marked PAID (already settled to bank)`);
  await mongoose.disconnect();
  console.log('Done.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
