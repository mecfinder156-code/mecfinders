'use strict';

const Booking = require('../bookings/booking.model');
const BookingPayment = require('./bookingPayment.model');
const Mechanic = require('../users/models/mechanic.model');
const razorpay = require('./razorpay.service');
const walletService = require('../wallet/wallet.service');
const timeline = require('../bookings/timeline.service');
const socket = require('../../realtime/socket');
const config = require('../../config');
const ApiError = require('../../utils/ApiError');
const {
  BOOKING_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  WALLET_TXN_TYPE,
  WALLET_TXN_DIRECTION,
  TIMELINE_EVENT,
  SOCKET_EVENTS,
} = require('../bookings/booking.constants');
const stateMachine = require('../bookings/booking.stateMachine');

function emitPayment(booking) {
  const payload = {
    bookingId: String(booking._id),
    status: booking.status,
    paymentStatus: booking.paymentStatus,
  };
  socket.emitToBooking(booking._id, SOCKET_EVENTS.PAYMENT_UPDATED, payload);
  socket.emitToUser(booking.customerId, SOCKET_EVENTS.PAYMENT_UPDATED, payload);
  if (booking.mechanicId) socket.emitToUser(booking.mechanicId, SOCKET_EVENTS.PAYMENT_UPDATED, payload);
}

/**
 * Idempotently write the wallet ledger entries for a settled booking.
 *
 * Provider always earns the SERVICE PRICE only (CREDIT to balance). For CASH,
 * the mechanic has collected the full amount so they owe the company the
 * GST + platform fee (DEBIT to payableToPlatform). For RAZORPAY the platform
 * collected the money directly, so only the provider earning is credited.
 *
 * Every entry has a booking-scoped idempotencyKey, so repeated calls (duplicate
 * callbacks/webhooks) never double-credit.
 */
async function settleWallet(booking, payment) {
  const providerEarning = booking.bill.providerEarning; // e.g. 70
  const companyAmount = booking.bill.companyAmount; // e.g. 30

  if (payment.method === PAYMENT_METHOD.CASH) {
    // Customer paid the FULL amount in cash to the mechanic. The mechanic keeps
    // their earning as cash-in-hand and now OWES the company its cut. So the
    // wallet balance goes NEGATIVE by the company amount (a due), while lifetime
    // earnings still record what they earned.
    await walletService.recordTransaction({
      mechanicId: booking.mechanicId,
      bookingId: booking._id,
      type: WALLET_TXN_TYPE.SERVICE_EARNING,
      direction: WALLET_TXN_DIRECTION.CREDIT,
      amount: providerEarning,
      affects: 'none', // cash in hand — not added to wallet balance
      reason: 'Service earning (collected as cash)',
      idempotencyKey: `earning:${booking._id}`,
    });
    if (companyAmount > 0) {
      await walletService.recordTransaction({
        mechanicId: booking.mechanicId,
        bookingId: booking._id,
        type: WALLET_TXN_TYPE.PLATFORM_DUE,
        direction: WALLET_TXN_DIRECTION.DEBIT,
        amount: companyAmount,
        affects: 'balance', // balance -= companyAmount (dues, negative)
        reason: 'Company share owed to platform (cash booking)',
        idempotencyKey: `due:${booking._id}`,
      });
    }
  } else if (payment.method === PAYMENT_METHOD.RAZORPAY) {
    // Customer paid online to the platform. The platform keeps its cut and owes
    // the mechanic their earning, so the wallet balance is CREDITED (positive).
    await walletService.recordTransaction({
      mechanicId: booking.mechanicId,
      bookingId: booking._id,
      type: WALLET_TXN_TYPE.SERVICE_EARNING,
      direction: WALLET_TXN_DIRECTION.CREDIT,
      amount: providerEarning,
      affects: 'balance', // balance += providerEarning
      reason: 'Service earning (paid online)',
      reference: payment.razorpayPaymentId,
      idempotencyKey: `earning:${booking._id}`,
    });
  }

  payment.settledAt = payment.settledAt || new Date();
  payment.providerEarning = providerEarning;
  payment.companyAmount = companyAmount;
  await payment.save();
}

/**
 * Finalise a paid booking: transition PAYMENT_PENDING -> PAID -> COMPLETED,
 * settle the wallet, bump the mechanic's completed count, and emit. Idempotent:
 * if already COMPLETED it just returns.
 */
async function finalizePaidBooking(booking, payment, actor) {
  if (booking.status === BOOKING_STATUS.COMPLETED) {
    return booking;
  }

  booking.paymentStatus = PAYMENT_STATUS.PAID;

  if (stateMachine.canTransition(booking.status, BOOKING_STATUS.PAID)) {
    booking.status = BOOKING_STATUS.PAID;
    await booking.save();
    await timeline.logEvent({
      bookingId: booking._id,
      event: TIMELINE_EVENT.PAYMENT_COMPLETED,
      actor,
      toStatus: BOOKING_STATUS.PAID,
      meta: { method: payment.method },
    });
  }

  await settleWallet(booking, payment);

  // Complete the booking.
  if (stateMachine.canTransition(booking.status, BOOKING_STATUS.COMPLETED)) {
    booking.status = BOOKING_STATUS.COMPLETED;
    booking.completedAt = booking.completedAt || new Date();
    await booking.save();
    await Mechanic.findByIdAndUpdate(booking.mechanicId, { $inc: { completedServicesCount: 1 } });
    await timeline.logEvent({
      bookingId: booking._id,
      event: TIMELINE_EVENT.COMPLETED,
      actor,
      toStatus: BOOKING_STATUS.COMPLETED,
    });

    // Completion bypasses applyTransition — notify both parties (customer:
    // "completed, rate us"; mechanic: "earning settled"). Fires once thanks to
    // the COMPLETED short-circuit at the top of this function.
    const bookingNotifications = require('../notifications/notification.booking');
    await bookingNotifications.notifyBookingStatus(booking, BOOKING_STATUS.COMPLETED, actor);
  }

  emitPayment(booking);
  return booking;
}

// --- Public API ---

/**
 * Customer initiates payment for a billed booking. Returns cash confirmation
 * instructions or a Razorpay order to hand to checkout.
 */
async function initiatePayment(bookingId, customerUser, method) {
  if (!Object.values(PAYMENT_METHOD).includes(method)) {
    throw ApiError.badRequest('Invalid payment method');
  }
  const booking = await Booking.findById(bookingId);
  if (!booking) throw ApiError.notFound('Booking not found');
  if (String(booking.customerId) !== String(customerUser._id)) {
    throw ApiError.forbidden('This booking does not belong to you');
  }
  if (![BOOKING_STATUS.READY_FOR_BILLING, BOOKING_STATUS.PAYMENT_PENDING].includes(booking.status)) {
    throw ApiError.conflict('Booking is not ready for payment');
  }
  if (!booking.bill || !booking.bill.generatedAt || booking.bill.totalAmount <= 0) {
    throw ApiError.conflict('No bill has been generated for this booking');
  }

  booking.paymentMethod = method;
  if (booking.status === BOOKING_STATUS.READY_FOR_BILLING) {
    booking.status = BOOKING_STATUS.PAYMENT_PENDING;
    await booking.save();
    await timeline.logEvent({
      bookingId: booking._id,
      event: TIMELINE_EVENT.PAYMENT_PENDING,
      actor: customerUser,
      toStatus: BOOKING_STATUS.PAYMENT_PENDING,
    });
  } else {
    await booking.save();
  }

  // Reuse an existing pending payment record where possible (idempotency).
  let payment = await BookingPayment.findOne({
    bookingId,
    method,
    status: PAYMENT_STATUS.PENDING,
  });

  if (method === PAYMENT_METHOD.CASH) {
    if (!payment) {
      payment = await BookingPayment.create({
        bookingId,
        customerId: booking.customerId,
        mechanicId: booking.mechanicId,
        method,
        status: PAYMENT_STATUS.PENDING,
        amount: booking.bill.totalAmount,
        providerEarning: booking.bill.providerEarning,
        companyAmount: booking.bill.companyAmount,
      });
    }
    emitPayment(booking);
    return { method, amount: booking.bill.totalAmount, paymentId: payment._id, status: 'AWAITING_CASH' };
  }

  // RAZORPAY
  if (payment && payment.razorpayOrderId) {
    return {
      method,
      amount: booking.bill.totalAmount,
      orderId: payment.razorpayOrderId,
      keyId: config.razorpay.keyId,
      paymentId: payment._id,
    };
  }
  const order = await razorpay.createOrder(booking.bill.totalAmount, bookingId);
  payment = await BookingPayment.create({
    bookingId,
    customerId: booking.customerId,
    mechanicId: booking.mechanicId,
    method,
    status: PAYMENT_STATUS.PENDING,
    amount: booking.bill.totalAmount,
    providerEarning: booking.bill.providerEarning,
    companyAmount: booking.bill.companyAmount,
    razorpayOrderId: order.id,
  });
  emitPayment(booking);
  return {
    method,
    amount: booking.bill.totalAmount,
    orderId: order.id,
    keyId: config.razorpay.keyId,
    paymentId: payment._id,
  };
}

/**
 * Mechanic confirms they collected cash. Settles the wallet and completes.
 */
async function confirmCashCollection(bookingId, mechanicUser) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw ApiError.notFound('Booking not found');
  if (!booking.mechanicId || String(booking.mechanicId) !== String(mechanicUser._id)) {
    throw ApiError.forbidden('This booking is not assigned to you');
  }
  if (booking.paymentMethod !== PAYMENT_METHOD.CASH) {
    throw ApiError.conflict('This booking is not a cash payment');
  }
  if (booking.status === BOOKING_STATUS.COMPLETED) return booking; // idempotent

  const payment = await BookingPayment.findOne({ bookingId, method: PAYMENT_METHOD.CASH });
  if (!payment) throw ApiError.conflict('No cash payment initiated by the customer yet');
  if (payment.status !== PAYMENT_STATUS.PAID) {
    payment.status = PAYMENT_STATUS.PAID;
    payment.cashCollectedAt = new Date();
    payment.cashConfirmedBy = mechanicUser._id;
    payment.paidAt = new Date();
    await payment.save();
  }

  return finalizePaidBooking(booking, payment, mechanicUser);
}

/**
 * Verify a Razorpay checkout callback server-side and finalise on success.
 */
async function verifyRazorpayPayment(bookingId, customerUser, { orderId, paymentId, signature }) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw ApiError.notFound('Booking not found');
  if (String(booking.customerId) !== String(customerUser._id)) {
    throw ApiError.forbidden('This booking does not belong to you');
  }

  const payment = await BookingPayment.findOne({ bookingId, razorpayOrderId: orderId });
  if (!payment) throw ApiError.notFound('Payment order not found');

  if (payment.status === PAYMENT_STATUS.PAID) {
    return finalizePaidBooking(booking, payment, customerUser); // idempotent
  }

  const valid = razorpay.verifyPaymentSignature(orderId, paymentId, signature);
  if (!valid) {
    payment.status = PAYMENT_STATUS.FAILED;
    await payment.save();
    throw ApiError.badRequest('Payment verification failed');
  }

  payment.razorpayPaymentId = paymentId;
  payment.razorpaySignature = signature;
  payment.status = PAYMENT_STATUS.PAID;
  payment.paidAt = new Date();
  await payment.save();

  booking.paymentStatus = PAYMENT_STATUS.PAID;
  await booking.save();

  return finalizePaidBooking(booking, payment, customerUser);
}

/**
 * Razorpay webhook handler (server-trusted). Verifies the signature over the
 * raw body and settles the matching payment idempotently.
 */
async function handleWebhook(rawBody, signature) {
  if (!razorpay.verifyWebhookSignature(rawBody, signature)) {
    throw ApiError.badRequest('Invalid webhook signature');
  }
  const event = JSON.parse(rawBody);
  const entity = event?.payload?.payment?.entity;
  if (!entity) return { handled: false };

  const payment = await BookingPayment.findOne({ razorpayOrderId: entity.order_id });
  if (!payment) return { handled: false };

  if (event.event === 'payment.captured' && payment.status !== PAYMENT_STATUS.PAID) {
    payment.razorpayPaymentId = entity.id;
    payment.status = PAYMENT_STATUS.PAID;
    payment.paidAt = new Date();
    await payment.save();

    const booking = await Booking.findById(payment.bookingId);
    if (booking) {
      booking.paymentStatus = PAYMENT_STATUS.PAID;
      await booking.save();
      await finalizePaidBooking(booking, payment, null);
    }
  }
  return { handled: true };
}

module.exports = {
  initiatePayment,
  confirmCashCollection,
  verifyRazorpayPayment,
  handleWebhook,
  settleWallet,
  finalizePaidBooking,
};
