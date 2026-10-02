'use strict';

const crypto = require('crypto');
const Razorpay = require('razorpay');
const config = require('../../config');
const ApiError = require('../../utils/ApiError');
const logger = require('../../utils/logger');

/**
 * Razorpay integration. Keys are read from env (RAZORPAY_KEY_ID/SECRET); when
 * absent the module reports `enabled === false` and order creation is rejected
 * with a clear error, while signature verification simply fails closed. This
 * lets the rest of the payment flow (and the cash path) work end-to-end before
 * real test keys are dropped in.
 *
 * SECURITY: payment success is NEVER trusted from the client. We always verify
 * the Razorpay signature server-side (checkout callback) and additionally
 * support webhook verification.
 */

let client = null;
function getClient() {
  if (!config.razorpay.enabled) return null;
  if (!client) {
    client = new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret,
    });
  }
  return client;
}

const enabled = () => config.razorpay.enabled;

/**
 * Create a Razorpay order for the given rupee amount. Amount is converted to
 * paise. `receipt` is typically the bookingId.
 */
async function createOrder(amountRupees, receipt) {
  const rz = getClient();
  if (!rz) throw ApiError.badRequest('Online payment is not configured. Please pay by cash.');
  const amountPaise = Math.round(Number(amountRupees) * 100);
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
    throw ApiError.badRequest('Invalid payment amount');
  }
  const order = await rz.orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt: String(receipt),
    payment_capture: 1,
  });
  return order;
}

/**
 * Verify the checkout callback signature: HMAC_SHA256(order_id|payment_id).
 * Uses a timing-safe comparison. Fails closed if the secret is missing.
 */
function verifyPaymentSignature(orderId, paymentId, signature) {
  if (!config.razorpay.keySecret || !orderId || !paymentId || !signature) return false;
  const expected = crypto
    .createHmac('sha256', config.razorpay.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)));
  } catch (_) {
    return false;
  }
}

/**
 * Verify a Razorpay webhook signature over the raw request body.
 */
function verifyWebhookSignature(rawBody, signature) {
  const secret = config.razorpay.webhookSecret;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)));
  } catch (_) {
    return false;
  }
}

// ── Razorpay Route (split payments) ─────────────────────────────────────────
// ONLINE bookings are split at source: the customer pays the platform, then the
// mechanic's share is transferred to their Route "linked account" and settled
// to their bank on Razorpay's schedule. The platform's share simply stays in
// the platform account and settles to the owner's bank normally.
//
// Route requires the "Route" product to be enabled on the account and a
// KYC-approved linked account per mechanic. Every call here is BEST-EFFORT and
// fails soft (returns {ok:false,...}) so the payment flow never breaks when
// Route/KYC is not yet set up — the earning is still recorded as PROCESSING and
// an admin can settle/transfer manually.

/**
 * Create a Route linked account for a mechanic from their bank details.
 * Returns { ok, accountId, error }.
 */
async function createLinkedAccount({ name, email, phone, bank }) {
  const rz = getClient();
  if (!rz) return { ok: false, error: 'Razorpay not configured' };
  try {
    const payload = {
      email: email || undefined,
      phone: phone || undefined,
      type: 'route',
      legal_business_name: name,
      business_type: 'individual',
      contact_name: name,
      profile: { category: 'services', subcategory: 'repair' },
      legal_info: {},
    };
    // The linked-account + bank-account onboarding shape varies by Route
    // generation and requires KYC; we attempt creation and let it fail soft.
    const account = await rz.accounts.create(payload);
    return { ok: true, accountId: account.id, account };
  } catch (err) {
    return { ok: false, error: err?.error?.description || err.message };
  }
}

/**
 * Transfer the mechanic's share of a captured payment to their linked account.
 * Returns { ok, transferId, error }.
 */
async function createTransferForPayment(paymentId, linkedAccountId, amountRupees, notes = {}) {
  const rz = getClient();
  if (!rz) return { ok: false, error: 'Razorpay not configured' };
  if (!paymentId || !linkedAccountId) return { ok: false, error: 'Missing payment or account id' };
  const amountPaise = Math.round(Number(amountRupees) * 100);
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
    return { ok: false, error: 'Invalid transfer amount' };
  }
  try {
    const result = await rz.payments.transfer(paymentId, {
      transfers: [
        {
          account: linkedAccountId,
          amount: amountPaise,
          currency: 'INR',
          notes,
          on_hold: false,
        },
      ],
    });
    // The SDK may return the collection ({items:[...]}) or the array itself.
    const items = Array.isArray(result) ? result : result?.items || [];
    const transferId = items[0]?.id || null;
    return { ok: true, transferId, result };
  } catch (err) {
    return { ok: false, error: err?.error?.description || err.message };
  }
}

module.exports = {
  getClient,
  enabled,
  createOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  createLinkedAccount,
  createTransferForPayment,
};
