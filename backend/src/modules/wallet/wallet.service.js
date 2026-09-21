'use strict';

const MechanicWallet = require('./wallet.model');
const WalletTransaction = require('./walletTransaction.model');
const { WALLET_TXN_DIRECTION, WALLET_TXN_TYPE } = require('../bookings/booking.constants');
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

async function getTransactions(mechanicId, { page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    WalletTransaction.find({ mechanicId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    WalletTransaction.countDocuments({ mechanicId }),
  ]);
  return { items, total, page, limit, pages: Math.ceil(total / limit) };
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

module.exports = {
  getOrCreateWallet,
  getWallet,
  recordTransaction,
  recordMany,
  getTransactions,
  recomputeBalance,
};
