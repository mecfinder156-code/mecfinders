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

module.exports = { getClient, enabled, createOrder, verifyPaymentSignature, verifyWebhookSignature };
