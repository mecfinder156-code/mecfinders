'use strict';

const mongoose = require('mongoose');
const WalletTransaction = require('./walletTransaction.model');
const MechanicPayout = require('./payout.model');
const MechanicWallet = require('./wallet.model');
const walletService = require('./wallet.service');
const bankService = require('./payout.service');
const User = require('../users/models/user.model');
const ApiError = require('../../utils/ApiError');
const {
  WALLET_TXN_TYPE,
  WALLET_TXN_DIRECTION,
  PAYOUT_STATUS,
  PAYOUT_METHOD,
} = require('../bookings/booking.constants');

/**
 * Admin-facing mechanic-wallet accounting. The immutable WalletTransaction
 * ledger is the single source of truth: every ONLINE SERVICE_EARNING row is a
 * payable the platform owes the mechanic (payoutStatus UNPAID). An admin pays
 * the mechanic out-of-band and records a MechanicPayout, which flips the covered
 * earnings to PAID. So for any mechanic:
 *
 *   earned (payable) = Σ online earnings            (UNPAID + PAID)
 *   paid             = Σ online earnings PAID
 *   outstanding      = Σ online earnings UNPAID      (= what the admin still owes)
 */

const EARNING_MATCH = {
  type: WALLET_TXN_TYPE.SERVICE_EARNING,
  payoutStatus: { $in: [PAYOUT_STATUS.UNPAID, PAYOUT_STATUS.PAID] },
};

function oid(id) {
  return new mongoose.Types.ObjectId(String(id));
}

const PER_MECHANIC_GROUP = {
  _id: '$mechanicId',
  earned: { $sum: '$amount' },
  outstanding: {
    $sum: { $cond: [{ $eq: ['$payoutStatus', PAYOUT_STATUS.UNPAID] }, '$amount', 0] },
  },
  paid: {
    $sum: { $cond: [{ $eq: ['$payoutStatus', PAYOUT_STATUS.PAID] }, '$amount', 0] },
  },
  unpaidCount: {
    $sum: { $cond: [{ $eq: ['$payoutStatus', PAYOUT_STATUS.UNPAID] }, 1, 0] },
  },
  lastEarningAt: { $max: '$createdAt' },
};

/**
 * Per-mechanic wallet rows (mechanics who have online earnings), sorted by
 * outstanding first. Optional `q` filters by mechanic name/phone.
 */
async function listMechanicWallets({ q, page = 1, limit = 20 } = {}) {
  page = Math.max(1, parseInt(page, 10) || 1);
  limit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const match = { ...EARNING_MATCH };
  if (q && String(q).trim()) {
    const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const users = await User.find({ $or: [{ name: rx }, { phone: rx }] }).select('_id').lean();
    match.mechanicId = { $in: users.map((u) => u._id) };
  }

  const facet = await WalletTransaction.aggregate([
    { $match: match },
    { $group: PER_MECHANIC_GROUP },
    {
      $facet: {
        rows: [
          { $sort: { outstanding: -1, lastEarningAt: -1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ]);

  const rows = facet[0]?.rows || [];
  const total = facet[0]?.total?.[0]?.count || 0;

  const users = await User.find({ _id: { $in: rows.map((r) => r._id) } })
    .select('name phone email bankDetails')
    .lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));

  // Cash dues: a NEGATIVE wallet balance = what the mechanic owes the platform.
  const wallets = await MechanicWallet.find({ mechanicId: { $in: rows.map((r) => r._id) } })
    .select('mechanicId balance')
    .lean();
  const dueById = new Map(wallets.map((w) => [String(w.mechanicId), w.balance < 0 ? Math.abs(w.balance) : 0]));

  const items = rows.map((r) => {
    const u = byId.get(String(r._id));
    const bank = u?.bankDetails;
    return {
      mechanicId: r._id,
      name: u?.name || '—',
      phone: u?.phone || null,
      earned: r.earned,
      paid: r.paid,
      outstanding: r.outstanding,
      unpaidCount: r.unpaidCount,
      due: dueById.get(String(r._id)) || 0,
      lastEarningAt: r.lastEarningAt,
      bankStatus: bank?.status || 'NOT_SUBMITTED',
      bankLast4: bank?.accountLast4 || null,
    };
  });

  return { items, page, limit, total, pages: Math.ceil(total / limit) };
}

/** Platform-wide payout totals for the dashboard cards. */
async function getPlatformStats() {
  const agg = await WalletTransaction.aggregate([
    { $match: EARNING_MATCH },
    {
      $group: {
        _id: null,
        earned: { $sum: '$amount' },
        outstanding: {
          $sum: { $cond: [{ $eq: ['$payoutStatus', PAYOUT_STATUS.UNPAID] }, '$amount', 0] },
        },
        paid: {
          $sum: { $cond: [{ $eq: ['$payoutStatus', PAYOUT_STATUS.PAID] }, '$amount', 0] },
        },
        mechanics: { $addToSet: '$mechanicId' },
      },
    },
  ]);
  const r = agg[0] || { earned: 0, outstanding: 0, paid: 0, mechanics: [] };
  return {
    totalEarned: r.earned,
    totalPaid: r.paid,
    totalOutstanding: r.outstanding,
    mechanicsWithEarnings: (r.mechanics || []).length,
  };
}

/** Paginated earning rows for a mechanic, filtered by date range + payout status. */
async function listEarnings(mechanicId, { from, to, status, page = 1, limit = 20 } = {}) {
  page = Math.max(1, parseInt(page, 10) || 1);
  limit = Math.min(200, Math.max(1, parseInt(limit, 10) || 20));

  const filter = { mechanicId: oid(mechanicId), type: WALLET_TXN_TYPE.SERVICE_EARNING };
  if (status === PAYOUT_STATUS.UNPAID || status === PAYOUT_STATUS.PAID) {
    filter.payoutStatus = status;
  } else {
    filter.payoutStatus = { $in: [PAYOUT_STATUS.UNPAID, PAYOUT_STATUS.PAID] };
  }
  const range = buildDateRange(from, to);
  if (range) filter.createdAt = range;

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    WalletTransaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: 'bookingId', select: 'status bill.totalAmount vehicle.registrationNumber createdAt' })
      .lean(),
    WalletTransaction.countDocuments(filter),
  ]);
  return { items, page, limit, total, pages: Math.ceil(total / limit) };
}

/** Paginated payout history for a mechanic. */
async function listPayouts(mechanicId, { page = 1, limit = 20 } = {}) {
  page = Math.max(1, parseInt(page, 10) || 1);
  limit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    MechanicPayout.find({ mechanicId: oid(mechanicId) })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: 'createdBy', select: 'name email' })
      .lean(),
    MechanicPayout.countDocuments({ mechanicId: oid(mechanicId) }),
  ]);
  return { items, page, limit, total, pages: Math.ceil(total / limit) };
}

/** Full wallet detail for one mechanic: profile, summary, bank, earnings, payouts. */
async function getMechanicDetail(mechanicId, { from, to, status, page = 1, limit = 20 } = {}) {
  const mechanic = await User.findById(mechanicId).select('name phone email role').lean();
  if (!mechanic) throw ApiError.notFound('Mechanic not found');

  const [summary, bankDetails, earnings, payouts, due] = await Promise.all([
    walletService.getEarningsSummary(mechanicId, { from, to }),
    bankService.getBankDetails(mechanicId).catch(() => null),
    listEarnings(mechanicId, { from, to, status, page, limit }),
    listPayouts(mechanicId, { page: 1, limit: 20 }),
    walletService.getDueAmount(mechanicId),
  ]);

  return {
    mechanic: { _id: mechanic._id, name: mechanic.name, phone: mechanic.phone, email: mechanic.email },
    summary,
    // Cash due the mechanic owes the platform (GST + platform-fee share they
    // collected as cash). Admin can clear it here or the mechanic pays online.
    due,
    bankDetails,
    earnings,
    payouts,
  };
}

/** Build an inclusive Mongo date-range matcher from optional from/to. */
function buildDateRange(from, to) {
  const range = {};
  if (from) {
    const d = new Date(from);
    if (!Number.isNaN(d.getTime())) range.$gte = d;
  }
  if (to) {
    const d = new Date(to);
    if (!Number.isNaN(d.getTime())) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(to))) d.setHours(23, 59, 59, 999);
      range.$lte = d;
    }
  }
  return Object.keys(range).length ? range : null;
}

/**
 * Record a payout to a mechanic: settle their UNPAID online earnings and reduce
 * their outstanding payable by the paid amount.
 *
 * Pass `settleAll:true` to clear every outstanding earning, or `earningIds` to
 * settle a chosen subset. The flip to PAID is claimed atomically with the new
 * payout's id (updateMany guarded by payoutStatus:UNPAID), so two admins paying
 * at once can never double-count the same earning.
 */
async function createPayout(mechanicId, { earningIds, settleAll, method, reference, note } = {}, adminUser) {
  const mechanic = await User.findById(mechanicId).select('_id');
  if (!mechanic) throw ApiError.notFound('Mechanic not found');

  const payoutMethod = Object.values(PAYOUT_METHOD).includes(method) ? method : PAYOUT_METHOD.BANK_TRANSFER;

  const claim = { mechanicId: oid(mechanicId), type: WALLET_TXN_TYPE.SERVICE_EARNING, payoutStatus: PAYOUT_STATUS.UNPAID };
  if (!settleAll) {
    if (!Array.isArray(earningIds) || earningIds.length === 0) {
      throw ApiError.badRequest('Select at least one earning to pay, or settle all');
    }
    claim._id = { $in: earningIds.map(oid) };
  }

  // Pre-check there is something to settle (friendly error before claiming).
  const pendingCount = await WalletTransaction.countDocuments(claim);
  if (pendingCount === 0) throw ApiError.badRequest('No unpaid earnings to settle');

  const payoutId = new mongoose.Types.ObjectId();
  const now = new Date();

  // Atomically claim the still-unpaid earnings for THIS payout.
  await WalletTransaction.updateMany(claim, {
    $set: { payoutStatus: PAYOUT_STATUS.PAID, payoutId, paidOutAt: now },
  });

  const claimed = await WalletTransaction.find({ payoutId }).select('_id amount').lean();
  if (claimed.length === 0) throw ApiError.conflict('These earnings were just settled by someone else');

  const amount = claimed.reduce((s, e) => s + (e.amount || 0), 0);
  const ids = claimed.map((e) => e._id);

  const payout = await MechanicPayout.create({
    _id: payoutId,
    mechanicId,
    amount,
    earningsCount: claimed.length,
    earningIds: ids,
    method: payoutMethod,
    reference: reference ? String(reference).trim() : null,
    note: note ? String(note).trim() : null,
    createdBy: adminUser?._id || null,
    paidAt: now,
  });

  // Informational ledger entry for the payout (does not move the cash balance).
  await walletService.recordTransaction({
    mechanicId,
    type: WALLET_TXN_TYPE.PAYOUT,
    direction: WALLET_TXN_DIRECTION.DEBIT,
    amount,
    affects: 'none',
    reason: `Payout to mechanic · ${claimed.length} earning${claimed.length > 1 ? 's' : ''} (${payoutMethod})`,
    reference: payout.reference,
    idempotencyKey: `payout:${payoutId}`,
  });

  const summary = await walletService.getEarningsSummary(mechanicId);
  payout.outstandingAfter = summary.outstanding;
  await payout.save();

  return { payout: payout.toObject(), summary };
}

/**
 * Admin records that a mechanic cleared (part of) their cash platform due
 * out-of-band. Credits the wallet (balance moves toward 0) by the amount,
 * CLAMPED to the current due so it can never over-clear / flip the balance
 * positive. Returns the remaining due.
 */
async function createDueClearance(mechanicId, { amount, method, reference, note } = {}, adminUser) {
  const mechanic = await User.findById(mechanicId).select('_id');
  if (!mechanic) throw ApiError.notFound('Mechanic not found');

  const due = await walletService.getDueAmount(mechanicId);
  if (due <= 0) throw ApiError.badRequest('This mechanic has no outstanding due');

  let amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) amt = due; // default: clear the whole due
  amt = Math.min(Math.round(amt), due); // never clear more than what's owed

  const payMethod = Object.values(PAYOUT_METHOD).includes(method) ? method : PAYOUT_METHOD.CASH;
  const clearId = new mongoose.Types.ObjectId();

  await walletService.recordTransaction({
    mechanicId,
    type: WALLET_TXN_TYPE.DUE_CLEARED,
    direction: WALLET_TXN_DIRECTION.CREDIT,
    amount: amt,
    affects: 'balance', // balance += amt → due shrinks toward 0
    reason: `Due cleared by admin (${payMethod})${note ? ` · ${note}` : ''}`,
    reference: reference ? String(reference).trim() : null,
    idempotencyKey: `admin-due-clear:${clearId}`,
  });

  const remainingDue = await walletService.getDueAmount(mechanicId);
  return { cleared: amt, remainingDue };
}

module.exports = {
  listMechanicWallets,
  getPlatformStats,
  getMechanicDetail,
  listEarnings,
  listPayouts,
  createPayout,
  createDueClearance,
};


