'use strict';

const mongoose = require('mongoose');
const MechanicWallet = require('./wallet.model');
const WalletTransaction = require('./walletTransaction.model');
const {
  WALLET_TXN_DIRECTION,
  WALLET_TXN_TYPE,
  PAYOUT_STATUS,
  SETTLEMENT_STATUS,
} = require('../bookings/booking.constants');
const logger = require('../../utils/logger');

/**
 * Wallet is an immutable ledger with a cached balance. Every mutation appends a
 * WalletTransaction guarded by a unique `idempotencyKey`, so a business event
 * (e.g. settling a booking's earning) can only ever be recorded once — repeated
 * payment callbacks/webhooks cannot double-credit.
 *
 * NOTE: mongodb-memory-server (used in tests) is a standalone node and does not
 * support multi-document transactions, so we deliberately do NOT wrap the
 * ledger insert + balance $inc in a session transaction. The unique
 * idempotencyKey provides the safety guarantee, and `recomputeBalance` can
 * rebuild the cached balance from the ledger for reconciliation.
 */

async function getOrCreateWallet(mechanicId) {
  let wallet = await MechanicWallet.findOne({ mechanicId });
  if (!wallet) {
    try {
      wallet = await MechanicWallet.create({ mechanicId });
    } catch (err) {
      // Race: another request created it first.
      wallet = await MechanicWallet.findOne({ mechanicId });
      if (!wallet) throw err;
    }
  }
  return wallet;
}

const FIELD_FOR_AFFECTS = {
  balance: 'balance',
};

/**
 * Append a single ledger entry idempotently and move the cached balance.
 * Returns { transaction, duplicate }. If the idempotencyKey already exists,
 * no balance change is applied and `duplicate` is true.
 */
async function recordTransaction({
  mechanicId,
  bookingId = null,
  type,
  direction,
  amount,
  affects = 'balance',
  reason = null,
  reference = null,
  settlementStatus = undefined,
  transferId = undefined,
  payoutStatus = undefined,
  payoutId = undefined,
  paidOutAt = undefined,
  idempotencyKey,
}) {
  if (!idempotencyKey) throw new Error('idempotencyKey is required for wallet writes');
  if (typeof amount !== 'number' || amount < 0) throw new Error('amount must be a non-negative number');

  const wallet = await getOrCreateWallet(mechanicId);

  let transaction;
  try {
    transaction = await WalletTransaction.create({
      walletId: wallet._id,
      mechanicId,
      bookingId,
      type,
      direction,
      amount,
      affects,
      reason,
      reference,
      ...(settlementStatus !== undefined ? { settlementStatus } : {}),
      ...(transferId !== undefined ? { transferId } : {}),
      ...(payoutStatus !== undefined ? { payoutStatus } : {}),
      ...(payoutId !== undefined ? { payoutId } : {}),
      ...(paidOutAt !== undefined ? { paidOutAt } : {}),
      idempotencyKey,
    });
  } catch (err) {
    if (err && err.code === 11000) {
      // Already recorded — idempotent no-op.
      const existing = await WalletTransaction.findOne({ idempotencyKey });
      return { transaction: existing, duplicate: true };
    }
    throw err;
  }

  // Apply cached-balance delta (skip for informational 'none' entries) and
  // track lifetime earnings for any service-earning credit (cash or online).
  const field = FIELD_FOR_AFFECTS[affects];
  const inc = {};
  if (field) inc[field] = direction === WALLET_TXN_DIRECTION.CREDIT ? amount : -amount;
  if (type === WALLET_TXN_TYPE.SERVICE_EARNING && direction === WALLET_TXN_DIRECTION.CREDIT) {
    inc.lifetimeEarnings = (inc.lifetimeEarnings || 0) + amount;
  }
  if (Object.keys(inc).length) {
    const updated = await MechanicWallet.findByIdAndUpdate(wallet._id, { $inc: inc }, { new: true });
    if (field === 'balance') {
      transaction.balanceAfter = updated.balance;
      await transaction.save();
    }
  }

  return { transaction, duplicate: false };
}

/**
 * Append several ledger entries as one logical settlement. Each entry carries
 * its own idempotencyKey so partial retries are safe.
 */
async function recordMany(entries) {
  const results = [];
  for (const entry of entries) {
    results.push(await recordTransaction(entry));
  }
  return results;
}

async function getWallet(mechanicId) {
  return getOrCreateWallet(mechanicId);
}

async function getTransactions(mechanicId, { page = 1, limit = 20, from, to, type } = {}) {
  const skip = (page - 1) * limit;
  const filter = { mechanicId };
  if (type) filter.type = type;
  const range = dateRange(from, to);
  if (range) filter.createdAt = range;
  const [items, total] = await Promise.all([
    WalletTransaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    WalletTransaction.countDocuments(filter),
  ]);
  return { items, total, page, limit, pages: Math.ceil(total / limit) };
}

/** Build a Mongo date-range matcher from optional from/to (inclusive day bounds). */
function dateRange(from, to) {
  const range = {};
  if (from) {
    const d = new Date(from);
    if (!Number.isNaN(d.getTime())) range.$gte = d;
  }
  if (to) {
    const d = new Date(to);
    if (!Number.isNaN(d.getTime())) {
      // If a bare date (no time) was passed, include the whole day.
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(to))) d.setHours(23, 59, 59, 999);
      range.$lte = d;
    }
  }
  return Object.keys(range).length ? range : null;
}

/**
 * Earnings/payout summary for a mechanic, derived from the immutable ledger so
 * it never drifts. `lifetimeEarnings` counts every service earning (cash +
 * online); the payable figures count only ONLINE earnings (payoutStatus set),
 * which are the ones the platform holds and must pay out.
 *
 *   payableEarnings = online earnings total (UNPAID + PAID)
 *   paidOut         = online earnings already settled to the mechanic
 *   outstanding     = payableEarnings - paidOut   (what the admin still owes)
 *
 * An optional from/to scopes `earnedInRange` (by earning date) without changing
 * the running outstanding figure.
 */
async function getEarningsSummary(mechanicId, { from, to } = {}) {
  const byStatus = await WalletTransaction.aggregate([
    {
      $match: {
        mechanicId: new mongoose.Types.ObjectId(String(mechanicId)),
        type: WALLET_TXN_TYPE.SERVICE_EARNING,
      },
    },
    {
      $group: {
        _id: '$payoutStatus',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);

  let lifetimeEarnings = 0;
  let payableEarnings = 0;
  let paidOut = 0;
  let outstanding = 0;
  let unpaidCount = 0;
  for (const row of byStatus) {
    lifetimeEarnings += row.total;
    if (row._id === PAYOUT_STATUS.UNPAID) {
      payableEarnings += row.total;
      outstanding += row.total;
      unpaidCount += row.count;
    } else if (row._id === PAYOUT_STATUS.PAID) {
      payableEarnings += row.total;
      paidOut += row.total;
    }
  }

  let earnedInRange = null;
  const range = dateRange(from, to);
  if (range) {
    const scoped = await WalletTransaction.aggregate([
      {
        $match: {
          mechanicId: new mongoose.Types.ObjectId(String(mechanicId)),
          type: WALLET_TXN_TYPE.SERVICE_EARNING,
          createdAt: range,
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);
    earnedInRange = { total: scoped[0]?.total || 0, count: scoped[0]?.count || 0 };
  }

  return { lifetimeEarnings, payableEarnings, paidOut, outstanding, unpaidCount, earnedInRange };
}

/**
 * Reconcile the cached balances from the immutable ledger. Admin/maintenance
 * use only.
 */
async function recomputeBalance(mechanicId) {
  const wallet = await getOrCreateWallet(mechanicId);
  const txns = await WalletTransaction.find({ mechanicId }).lean();
  let balance = 0;
  let lifetimeEarnings = 0;
  for (const t of txns) {
    const signed = t.direction === WALLET_TXN_DIRECTION.CREDIT ? t.amount : -t.amount;
    if (t.affects === 'balance') balance += signed;
    if (t.type === WALLET_TXN_TYPE.SERVICE_EARNING && t.direction === WALLET_TXN_DIRECTION.CREDIT) {
      lifetimeEarnings += t.amount;
    }
  }
  wallet.balance = balance;
  wallet.payableToPlatform = 0;
  wallet.lifetimeEarnings = lifetimeEarnings;
  await wallet.save();
  logger.info(`Recomputed wallet for mechanic ${mechanicId}: balance=${balance}`);
  return wallet;
}

/**
 * Flip an ONLINE earning's settlement status (idempotent-ish: only advances a
 * PROCESSING entry). SETTLED is the "your payout reached your bank" moment the
 * mechanic sees in their wallet history. Matched by the earning's
 * idempotencyKey (`earning:<bookingId>`) or by its Route transfer id.
 */
async function markEarningSettlement(match, status, { settledAt, transferId, reference } = {}) {
  const query = match.idempotencyKey
    ? { idempotencyKey: match.idempotencyKey }
    : match.transferId
    ? { transferId: match.transferId }
    : null;
  if (!query) return null;

  const txn = await WalletTransaction.findOne(query);
  if (!txn) return null;
  // Only PROCESSING online earnings settle; never touch balance-affecting rows.
  if (txn.settlementStatus === SETTLEMENT_STATUS.NA) return txn;
  if (txn.settlementStatus === SETTLEMENT_STATUS.SETTLED) return txn; // already done

  txn.settlementStatus = status;
  if (status === SETTLEMENT_STATUS.SETTLED) {
    txn.settledAt = settledAt || new Date();
    txn.reason = 'Service earning settled to your bank';
  }
  if (transferId) txn.transferId = transferId;
  if (reference) txn.reference = reference;
  await txn.save();
  return txn;
}

/**
 * Net platform due (rupees) the mechanic currently owes — the magnitude of a
 * negative wallet balance, or 0 when the balance is non-negative.
 */
async function getDueAmount(mechanicId) {
  const wallet = await getOrCreateWallet(mechanicId);
  return wallet.balance < 0 ? Math.abs(wallet.balance) : 0;
}

module.exports = {
  getOrCreateWallet,
  getWallet,
  recordTransaction,
  recordMany,
  getTransactions,
  getEarningsSummary,
  recomputeBalance,
  markEarningSettlement,
  getDueAmount,
};
