'use strict';

const Booking = require('../bookings/booking.model');
const BookingPayment = require('./bookingPayment.model');
const Mechanic = require('../users/models/mechanic.model');
const razorpay = require('./razorpay.service');
const walletService = require('../wallet/wallet.service');
const DueSettlement = require('../wallet/dueSettlement.model');
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
  PAYOUT_STATUS,
  SETTLEMENT_STATUS,
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
 * Provider always earns the SERVICE PRICE only. For CASH, the mechanic has
 * collected the full amount so they owe the company the GST + platform fee
 * (DEBIT to balance -> a negative "due"). For RAZORPAY the customer paid the
 * platform online: the full amount is collected into the platform account and
 * the mechanic's earning becomes a PAYABLE the platform holds. We record it as a
 * SERVICE_EARNING with payoutStatus UNPAID (it does NOT touch the cash-due
 * balance); an admin later pays the mechanic out-of-band and marks it PAID,
 * which drops the mechanic's outstanding payable.
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
    // Customer paid ONLINE. The full amount (service + GST + platform fee) is
    // collected into the platform account. The mechanic's earning becomes a
    // PAYABLE the platform holds — recorded as a SERVICE_EARNING with
    // payoutStatus UNPAID (affects:'none', so it never touches the cash-due
    // balance). An admin later pays the mechanic out-of-band and marks it PAID
    // (see wallet admin / payouts), which reduces their outstanding payable.
    // The platform's share simply stays in the platform account.
    if (providerEarning > 0) {
      await walletService.recordTransaction({
        mechanicId: booking.mechanicId,
        bookingId: booking._id,
        type: WALLET_TXN_TYPE.SERVICE_EARNING,
        direction: WALLET_TXN_DIRECTION.CREDIT,
        amount: providerEarning,
        affects: 'none', // held by the platform, paid out manually — not the cash balance
        reason: 'Service earning (paid online) — pending payout',
        reference: payment.razorpayPaymentId,
        payoutStatus: PAYOUT_STATUS.UNPAID,
        idempotencyKey: `earning:${booking._id}`,
      });
    }
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
    bookingNotifications.notifyBookingStatus(booking, BOOKING_STATUS.COMPLETED, actor);
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
 * raw body and dispatches by event type:
 *   - payment.captured  -> settle a booking payment OR a due-settlement order
 *   - transfer.settled  -> flip the mechanic's online earning to SETTLED
 *   - transfer.processed-> backfill the Route transfer id on the earning
 * All handlers are idempotent.
 */
async function handleWebhook(rawBody, signature) {
  if (!razorpay.verifyWebhookSignature(rawBody, signature)) {
    throw ApiError.badRequest('Invalid webhook signature');
  }
  const event = JSON.parse(rawBody);
  const type = event?.event;

  if (type === 'payment.captured') {
    const entity = event?.payload?.payment?.entity;
    if (!entity) return { handled: false };

    // A booking payment?
    const payment = await BookingPayment.findOne({ razorpayOrderId: entity.order_id });
    if (payment) {
      if (payment.status !== PAYMENT_STATUS.PAID) {
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

    // A mechanic clearing their platform due?
    const settlement = await DueSettlement.findOne({ razorpayOrderId: entity.order_id });
    if (settlement) {
      await finalizeDueSettlement(settlement, { paymentId: entity.id });
      return { handled: true };
    }

    return { handled: false };
  }

  if (type === 'transfer.settled' || type === 'transfer.processed') {
    // Route transfer to the mechanic's linked account. `transfer.settled` is the
    // "your payout reached your bank" moment the mechanic sees in their history.
    const entity = event?.payload?.transfer?.entity;
    if (!entity) return { handled: false };
    const status =
      type === 'transfer.settled' ? SETTLEMENT_STATUS.SETTLED : SETTLEMENT_STATUS.PROCESSING;
    const bookingId = entity?.notes?.bookingId;
    const match = bookingId ? { idempotencyKey: `earning:${bookingId}` } : { transferId: entity.id };
    const txn = await walletService.markEarningSettlement(match, status, {
      transferId: entity.id,
      settledAt: type === 'transfer.settled' ? new Date() : undefined,
    });
    if (txn && txn.bookingId) emitEarningSettled(txn);
    return { handled: Boolean(txn) };
  }

  return { handled: false };
}

// --- Platform due settlement (mechanic pays off their cash-collected dues) ---

/**
 * Mechanic starts clearing their outstanding platform due. Creates a Razorpay
 * order for the current due amount and returns the checkout params. Reuses a
 * live pending order when the amount is unchanged.
 */
async function initiateDueSettlement(mechanicUser) {
  const due = await walletService.getDueAmount(mechanicUser._id);
  if (due <= 0) throw ApiError.badRequest('You have no pending platform due');
  if (!razorpay.enabled()) {
    throw ApiError.badRequest('Online payment is not configured');
  }

  const pending = await DueSettlement.findOne({
    mechanicId: mechanicUser._id,
    status: PAYMENT_STATUS.PENDING,
  }).sort({ createdAt: -1 });

  if (pending && pending.razorpayOrderId && pending.amount === due) {
    return {
      settlementId: pending._id,
      orderId: pending.razorpayOrderId,
      amount: due,
      keyId: config.razorpay.keyId,
    };
  }

  const order = await razorpay.createOrder(due, `due-${mechanicUser._id}`);
  const settlement = await DueSettlement.create({
    mechanicId: mechanicUser._id,
    amount: due,
    status: PAYMENT_STATUS.PENDING,
    razorpayOrderId: order.id,
  });
  return {
    settlementId: settlement._id,
    orderId: order.id,
    amount: due,
    keyId: config.razorpay.keyId,
  };
}

/**
 * Verify a due-settlement checkout callback server-side and clear the due.
 */
async function verifyDueSettlement(mechanicUser, { orderId, paymentId, signature }) {
  const settlement = await DueSettlement.findOne({
    mechanicId: mechanicUser._id,
    razorpayOrderId: orderId,
  });
  if (!settlement) throw ApiError.notFound('Due settlement order not found');
  if (settlement.status === PAYMENT_STATUS.PAID) {
    return { cleared: true, amount: settlement.amount }; // idempotent
  }

  const valid = razorpay.verifyPaymentSignature(orderId, paymentId, signature);
  if (!valid) {
    settlement.status = PAYMENT_STATUS.FAILED;
    await settlement.save();
    throw ApiError.badRequest('Payment verification failed');
  }

  await finalizeDueSettlement(settlement, { paymentId, signature });
  return { cleared: true, amount: settlement.amount };
}

/**
 * Mark a due settlement PAID and credit the wallet so the negative balance
 * moves back toward zero. Idempotent: keyed by the order id, so a duplicate
 * callback + webhook can only ever clear the due once.
 */
async function finalizeDueSettlement(settlement, { paymentId, signature } = {}) {
  if (settlement.status !== PAYMENT_STATUS.PAID) {
    settlement.status = PAYMENT_STATUS.PAID;
    settlement.razorpayPaymentId = paymentId || settlement.razorpayPaymentId;
    settlement.razorpaySignature = signature || settlement.razorpaySignature;
    settlement.paidAt = new Date();
    await settlement.save();
  }

  await walletService.recordTransaction({
    mechanicId: settlement.mechanicId,
    type: WALLET_TXN_TYPE.DUE_CLEARED,
    direction: WALLET_TXN_DIRECTION.CREDIT,
    amount: settlement.amount,
    affects: 'balance', // balance += amount (clears the negative due)
    reason: 'Platform due cleared (paid online)',
    reference: settlement.razorpayPaymentId,
    idempotencyKey: `due-clear:${settlement.razorpayOrderId}`,
  });
  return settlement;
}

function emitEarningSettled(txn) {
  socket.emitToUser(txn.mechanicId, SOCKET_EVENTS.PAYMENT_UPDATED, {
    bookingId: String(txn.bookingId),
    settlement: txn.settlementStatus,
  });
}

module.exports = {
  initiatePayment,
  confirmCashCollection,
  verifyRazorpayPayment,
  handleWebhook,
  settleWallet,
  finalizePaidBooking,
  initiateDueSettlement,
  verifyDueSettlement,
  finalizeDueSettlement,
};
