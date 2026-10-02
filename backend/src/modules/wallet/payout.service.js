'use strict';

const Mechanic = require('../users/models/mechanic.model');
const ApiError = require('../../utils/ApiError');
const { BANK_DETAILS_STATUS } = require('../bookings/booking.constants');

/**
 * Mechanic payout bank details. For ONLINE bookings the customer's payment is
 * split at source via Razorpay Route — the mechanic's share is transferred to
 * their Route "linked account" and settled to the bank account stored here.
 *
 * The raw account number is `select:false` on the schema and is NEVER returned;
 * callers only ever see the masked last-4. Creating the Route linked account is
 * BEST-EFFORT: if Route/KYC is not ready the details are saved as PENDING and an
 * admin can complete onboarding later — payouts then fall back to manual.
 */

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const UPI_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

/** Strip the raw account number before returning bank details to a client. */
function sanitize(bank) {
  if (!bank) return null;
  const b = typeof bank.toObject === 'function' ? bank.toObject() : { ...bank };
  delete b.accountNumber;
  return b;
}

const EMPTY = () => ({
  payoutMethod: 'bank',
  status: BANK_DETAILS_STATUS.NOT_SUBMITTED,
  accountHolderName: null,
  accountLast4: null,
  ifsc: null,
  bankName: null,
  upiId: null,
  razorpayAccountId: null,
  statusReason: null,
  updatedAt: null,
});

async function getBankDetails(mechanicId) {
  const mechanic = await Mechanic.findById(mechanicId).select('bankDetails');
  if (!mechanic) throw ApiError.notFound('Mechanic not found');
  const bank = sanitize(mechanic.bankDetails);
  if (!bank || (!bank.accountLast4 && !bank.upiId)) return EMPTY();
  return bank;
}

/**
 * Save the mechanic's payout destination — either a bank account or a UPI id.
 * Payouts are settled manually by an admin, so valid details are marked ACTIVE
 * (no Razorpay Route onboarding needed).
 */
async function updateBankDetails(mechanicUser, payload = {}) {
  const method = payload.payoutMethod === 'upi' ? 'upi' : 'bank';
  const mechanic = await Mechanic.findById(mechanicUser._id).select('name email phone bankDetails');
  if (!mechanic) throw ApiError.notFound('Mechanic not found');

  if (method === 'upi') {
    const upiId = String(payload.upiId || '').trim();
    const accountHolderName = String(payload.accountHolderName || '').trim();
    if (!UPI_RE.test(upiId)) throw ApiError.badRequest('Enter a valid UPI ID (e.g. name@okhdfc)');
    mechanic.bankDetails = {
      payoutMethod: 'upi',
      upiId,
      accountHolderName: accountHolderName || null,
      accountNumber: null,
      accountLast4: null,
      ifsc: null,
      bankName: null,
      razorpayAccountId: null,
      status: BANK_DETAILS_STATUS.ACTIVE,
      statusReason: null,
      updatedAt: new Date(),
    };
    await mechanic.save({ validateBeforeSave: false });
    return sanitize(mechanic.bankDetails);
  }

  const accountHolderName = String(payload.accountHolderName || '').trim();
  const accountNumber = String(payload.accountNumber || '').replace(/\s+/g, '');
  const ifsc = String(payload.ifsc || '').trim().toUpperCase();
  const bankName = String(payload.bankName || '').trim();

  if (!accountHolderName) throw ApiError.badRequest('Account holder name is required');
  if (!/^\d{9,18}$/.test(accountNumber)) throw ApiError.badRequest('Enter a valid bank account number');
  if (!IFSC_RE.test(ifsc)) throw ApiError.badRequest('Enter a valid IFSC code (e.g. HDFC0001234)');

  mechanic.bankDetails = {
    payoutMethod: 'bank',
    accountHolderName,
    accountNumber, // stored, never returned (select:false)
    accountLast4: accountNumber.slice(-4),
    ifsc,
    bankName: bankName || null,
    upiId: null,
    razorpayAccountId: null,
    status: BANK_DETAILS_STATUS.ACTIVE,
    statusReason: null,
    updatedAt: new Date(),
  };

  await mechanic.save({ validateBeforeSave: false });
  return sanitize(mechanic.bankDetails);
}

module.exports = { getBankDetails, updateBankDetails };
