'use strict';

/**
 * Standalone integration runner (no jest).
 *
 * The jest + mongodb-memory-server harness hangs in this environment (a bare
 * `MongoMemoryServer.create()` jest test also hangs, while the same call runs
 * in <1s under plain node), so this script boots the in-memory MongoDB
 * directly and exercises the booking lifecycle end-to-end via supertest.
 *
 * Run: `node tests/integration.run.js`
 */

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-characters-long';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-characters-long';
process.env.ADMIN_PANEL_URL = 'http://localhost:3000';

const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

const app = require('../src/app');
const h = require('./helpers/mobile.helper');
const dispatchService = require('../src/modules/bookings/dispatch.service');
const walletService = require('../src/modules/wallet/wallet.service');
const adminWalletService = require('../src/modules/wallet/adminWallet.service');
const paymentService = require('../src/modules/payments/payment.service');
const BookingPayment = require('../src/modules/payments/bookingPayment.model');
const WalletTransaction = require('../src/modules/wallet/walletTransaction.model');
const MechanicPayout = require('../src/modules/wallet/payout.model');
const DueSettlement = require('../src/modules/wallet/dueSettlement.model');
const Booking = require('../src/modules/bookings/booking.model');
const MechanicRequest = require('../src/modules/bookings/mechanicRequest.model');
const User = require('../src/modules/users/models/user.model');
const {
  REQUEST_STATUS,
  WALLET_TXN_TYPE,
  WALLET_TXN_DIRECTION,
  PAYOUT_STATUS,
  SETTLEMENT_STATUS,
} = require('../src/modules/bookings/booking.constants');

let passed = 0;
let failed = 0;
async function clearDb() {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}
async function scenario(name, fn) {
  try {
    await clearDb(); // isolate each scenario (mimics jest afterEach)
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}\n      ${err.message}`);
  }
}

async function scaffold({ serviceOpts = {}, mechanics = 1 } = {}) {
  const customer = await h.createCustomer();
  const { category, city, service, pricing } = await h.setupService(serviceOpts);
  const vehicle = await h.createVehicle(customer, category);
  const address = await h.createAddress(customer);
  const mechs = [];
  for (let i = 0; i < mechanics; i++) mechs.push(await h.createMechanic({ ratingAverage: 4 + i * 0.1 }));
  return { customer, category, city, service, pricing, vehicle, address, mechanics: mechs };
}

const createInstant = (customer, service, vehicle, address) =>
  request(app)
    .post('/api/mobile/bookings')
    .set(h.authHeader(customer))
    .send({ serviceId: service._id, vehicleId: vehicle._id, bookingType: 'INSTANT', addressId: address._id });

async function toWorkStarted(s) {
  const createRes = await createInstant(s.customer, s.service, s.vehicle, s.address);
  const bookingId = createRes.body.data.booking._id;
  const mech = s.mechanics[0];
  await dispatchService.acceptRequest(bookingId, mech);
  await request(app).post(`/api/mobile/mechanic/bookings/${bookingId}/arrive`).set(h.authHeader(mech));
  const cust = await request(app).get(`/api/mobile/bookings/${bookingId}`).set(h.authHeader(s.customer));
  const otp = cust.body.data.booking.otp;
  await request(app).post(`/api/mobile/mechanic/bookings/${bookingId}/start`).set(h.authHeader(mech)).send({ otp });
  return { bookingId, mech, otp };
}

async function main() {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  console.log('Integration run started\n');

  await scenario('login-style re-save of a mechanic does not throw geo errors', async () => {
    const mech = await h.createMechanic();
    const reloaded = await User.findById(mech._id);
    await reloaded.save({ validateBeforeSave: false }); // mimics /auth/mobile/login
    assert.ok(reloaded.currentLocation === undefined || !reloaded.currentLocation.coordinates);
  });

  await scenario('instant booking dispatches to one online mechanic', async () => {
    const s = await scaffold();
    const res = await createInstant(s.customer, s.service, s.vehicle, s.address);
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.data.booking.status, 'SEARCHING_MECHANIC');
    assert.ok(res.body.data.booking.otp);
    const pending = await MechanicRequest.find({ bookingId: res.body.data.booking._id, status: REQUEST_STATUS.PENDING });
    assert.strictEqual(pending.length, 1);
  });

  await scenario('vehicle/service category mismatch is rejected', async () => {
    const customer = await h.createCustomer();
    const { service } = await h.setupService();
    const otherCat = (await h.setupService()).category;
    const vehicle = await h.createVehicle(customer, otherCat);
    const address = await h.createAddress(customer);
    const res = await createInstant(customer, service, vehicle, address);
    assert.strictEqual(res.status, 400);
  });

  await scenario('atomic accept: only one mechanic wins a race', async () => {
    const s = await scaffold({ mechanics: 2 });
    const res = await createInstant(s.customer, s.service, s.vehicle, s.address);
    const bookingId = res.body.data.booking._id;
    // Whichever mechanic got the auto-offer, give the OTHER a competing offer.
    const autoOffer = await MechanicRequest.findOne({ bookingId, status: REQUEST_STATUS.PENDING });
    const other = s.mechanics.find((m) => String(m._id) !== String(autoOffer.mechanicId));
    const winnerA = s.mechanics.find((m) => String(m._id) === String(autoOffer.mechanicId));
    await MechanicRequest.create({
      bookingId,
      mechanicId: other._id,
      status: REQUEST_STATUS.PENDING,
      sequence: 1,
      expiresAt: new Date(Date.now() + 60000),
    });
    const results = await Promise.allSettled([
      dispatchService.acceptRequest(bookingId, winnerA),
      dispatchService.acceptRequest(bookingId, other),
    ]);
    assert.strictEqual(results.filter((r) => r.status === 'fulfilled').length, 1);
    assert.strictEqual(results.filter((r) => r.status === 'rejected').length, 1);
    const accepted = await MechanicRequest.find({ bookingId, status: REQUEST_STATUS.ACCEPTED });
    assert.strictEqual(accepted.length, 1);
    const booking = await Booking.findById(bookingId);
    assert.strictEqual(booking.status, 'MECHANIC_ASSIGNED');
  });

  await scenario('reject moves the offer to the next mechanic', async () => {
    const s = await scaffold({ mechanics: 2 });
    const res = await createInstant(s.customer, s.service, s.vehicle, s.address);
    const bookingId = res.body.data.booking._id;
    const firstOffer = await MechanicRequest.findOne({ bookingId, status: REQUEST_STATUS.PENDING });
    const firstMech = s.mechanics.find((m) => String(m._id) === String(firstOffer.mechanicId));
    await request(app).post(`/api/mobile/mechanic/requests/${bookingId}/reject`).set(h.authHeader(firstMech)).expect(200);
    const pending = await MechanicRequest.find({ bookingId, status: REQUEST_STATUS.PENDING });
    assert.strictEqual(pending.length, 1);
    assert.notStrictEqual(String(pending[0].mechanicId), String(firstOffer.mechanicId));
  });

  await scenario('timeout sweeper expires an offer and dispatches next', async () => {
    const s = await scaffold({ mechanics: 2 });
    const res = await createInstant(s.customer, s.service, s.vehicle, s.address);
    const bookingId = res.body.data.booking._id;
    const offer = await MechanicRequest.findOne({ bookingId, status: REQUEST_STATUS.PENDING });
    offer.expiresAt = new Date(Date.now() - 1000);
    await offer.save();
    await dispatchService.sweepExpired();
    const expired = await MechanicRequest.findById(offer._id);
    assert.strictEqual(expired.status, REQUEST_STATUS.EXPIRED);
    const pending = await MechanicRequest.find({ bookingId, status: REQUEST_STATUS.PENDING });
    assert.strictEqual(pending.length, 1);
  });

  await scenario('no eligible mechanics -> booking expires', async () => {
    const customer = await h.createCustomer();
    const { category, service } = await h.setupService();
    const vehicle = await h.createVehicle(customer, category);
    const address = await h.createAddress(customer);
    const res = await createInstant(customer, service, vehicle, address);
    const booking = await Booking.findById(res.body.data.booking._id);
    assert.strictEqual(booking.status, 'EXPIRED');
  });

  await scenario('wrong OTP rejected; mechanic view hides OTP; correct OTP starts work', async () => {
    const s = await scaffold();
    const createRes = await createInstant(s.customer, s.service, s.vehicle, s.address);
    const bookingId = createRes.body.data.booking._id;
    const mech = s.mechanics[0];
    await dispatchService.acceptRequest(bookingId, mech);
    await request(app).post(`/api/mobile/mechanic/bookings/${bookingId}/arrive`).set(h.authHeader(mech)).expect(200);
    await request(app).post(`/api/mobile/mechanic/bookings/${bookingId}/start`).set(h.authHeader(mech)).send({ otp: '0000' }).expect(400);
    const cust = await request(app).get(`/api/mobile/bookings/${bookingId}`).set(h.authHeader(s.customer));
    const mechView = await request(app).get(`/api/mobile/mechanic/bookings/${bookingId}`).set(h.authHeader(mech));
    assert.strictEqual(mechView.body.data.booking.otp, undefined);
    const startRes = await request(app).post(`/api/mobile/mechanic/bookings/${bookingId}/start`).set(h.authHeader(mech)).send({ otp: cust.body.data.booking.otp }).expect(200);
    assert.strictEqual(startRes.body.data.booking.status, 'WORK_STARTED');
  });

  await scenario('rejected additional service is NOT billed', async () => {
    const s = await scaffold();
    const { bookingId, mech } = await toWorkStarted(s);
    const addl = await h.setupMechanicService({ category: s.category, city: s.city, servicePrice: 800, platformFee: 20 });
    const addRes = await request(app).post(`/api/mobile/mechanic/bookings/${bookingId}/additional-services`).set(h.authHeader(mech)).send({ mechanicServiceId: addl.service._id, reason: 'x' });
    const item = addRes.body.data.booking.services.find((x) => x.kind === 'ADDITIONAL');
    await request(app).post(`/api/mobile/bookings/${bookingId}/additional-services/${item._id}/respond`).set(h.authHeader(s.customer)).send({ accept: false }).expect(200);
    await request(app).post(`/api/mobile/mechanic/bookings/${bookingId}/complete`).set(h.authHeader(mech)).expect(200);
    const booking = await Booking.findById(bookingId);
    assert.strictEqual(booking.bill.totalAmount, s.pricing.totalPrice);
  });

  await scenario('accepted additional service IS billed with correct split', async () => {
    const s = await scaffold();
    const { bookingId, mech } = await toWorkStarted(s);
    const addl = await h.setupMechanicService({ category: s.category, city: s.city, servicePrice: 800, platformFee: 20 });
    const addRes = await request(app).post(`/api/mobile/mechanic/bookings/${bookingId}/additional-services`).set(h.authHeader(mech)).send({ mechanicServiceId: addl.service._id, reason: 'x' });
    const item = addRes.body.data.booking.services.find((x) => x.kind === 'ADDITIONAL');
    await request(app).post(`/api/mobile/bookings/${bookingId}/additional-services/${item._id}/respond`).set(h.authHeader(s.customer)).send({ accept: true }).expect(200);
    await request(app).post(`/api/mobile/mechanic/bookings/${bookingId}/complete`).set(h.authHeader(mech)).expect(200);
    const booking = await Booking.findById(bookingId);
    assert.strictEqual(booking.bill.totalAmount, s.pricing.totalPrice + addl.pricing.totalPrice);
    assert.strictEqual(booking.bill.providerEarning, s.pricing.servicePrice + addl.pricing.servicePrice);
    assert.strictEqual(booking.bill.companyAmount, s.pricing.gstAmount + s.pricing.platformFee + addl.pricing.gstAmount + addl.pricing.platformFee);
  });

  await scenario('incomplete required checklist blocks completion', async () => {
    const s = await scaffold({ serviceOpts: { checklist: [{ label: 'Wash', required: true }] } });
    const { bookingId, mech } = await toWorkStarted(s);
    await request(app).post(`/api/mobile/mechanic/bookings/${bookingId}/complete`).set(h.authHeader(mech)).expect(400);
    const view = await request(app).get(`/api/mobile/mechanic/bookings/${bookingId}`).set(h.authHeader(mech));
    const original = view.body.data.booking.services.find((x) => x.kind === 'ORIGINAL');
    await request(app).patch(`/api/mobile/mechanic/booking-services/${original._id}/checklist`).set(h.authHeader(mech)).send({ checklistItemId: original.checklist[0]._id, done: true }).expect(200);
    await request(app).post(`/api/mobile/mechanic/bookings/${bookingId}/complete`).set(h.authHeader(mech)).expect(200);
    const booking = await Booking.findById(bookingId);
    assert.strictEqual(booking.status, 'READY_FOR_BILLING');
  });

  await scenario('cash payment settles wallet with provider/company split + completes', async () => {
    const s = await scaffold();
    const { bookingId, mech } = await toWorkStarted(s);
    await request(app).post(`/api/mobile/mechanic/bookings/${bookingId}/complete`).set(h.authHeader(mech)).expect(200);
    await request(app).post(`/api/mobile/bookings/${bookingId}/pay`).set(h.authHeader(s.customer)).send({ method: 'CASH' }).expect(200);
    await request(app).post(`/api/mobile/mechanic/bookings/${bookingId}/collect-cash`).set(h.authHeader(mech)).expect(200);
    const booking = await Booking.findById(bookingId);
    assert.strictEqual(booking.status, 'COMPLETED');
    assert.strictEqual(booking.paymentStatus, 'PAID');
    const company = s.pricing.gstAmount + s.pricing.platformFee;
    const wallet = await walletService.getWallet(mech._id);
    // Cash: keeps earning as cash, owes company its cut -> negative balance.
    assert.strictEqual(wallet.balance, -company);
    assert.strictEqual(wallet.lifetimeEarnings, s.pricing.servicePrice);
  });

  await scenario('online (razorpay) payment records an UNPAID payable earning, cash balance untouched', async () => {
    const s = await scaffold();
    const { bookingId, mech } = await toWorkStarted(s);
    await request(app).post(`/api/mobile/mechanic/bookings/${bookingId}/complete`).set(h.authHeader(mech));
    // Simulate a verified online payment settlement directly (no live gateway).
    const booking = await Booking.findById(bookingId);
    booking.status = 'PAYMENT_PENDING';
    booking.paymentMethod = 'RAZORPAY';
    await booking.save();
    const payment = await BookingPayment.create({
      bookingId: booking._id,
      customerId: booking.customerId,
      mechanicId: booking.mechanicId,
      method: 'RAZORPAY',
      status: 'PAID',
      amount: booking.bill.totalAmount,
      razorpayPaymentId: `pay_test_${bookingId}`,
    });
    await paymentService.finalizePaidBooking(booking, payment, null);
    const after = await Booking.findById(bookingId);
    assert.strictEqual(after.status, 'COMPLETED');

    // Platform holds the money; the cash-due balance is untouched.
    const wallet = await walletService.getWallet(mech._id);
    assert.strictEqual(wallet.balance, 0);
    // The earning is recorded as an UNPAID payable (admin pays it out later).
    const earning = await WalletTransaction.findOne({ idempotencyKey: `earning:${bookingId}` });
    assert.ok(earning, 'earning ledger entry exists');
    assert.strictEqual(earning.affects, 'none');
    assert.strictEqual(earning.amount, s.pricing.servicePrice);
    assert.strictEqual(earning.payoutStatus, PAYOUT_STATUS.UNPAID);
    assert.strictEqual(wallet.lifetimeEarnings, s.pricing.servicePrice);
    // Summary reflects the outstanding payable.
    const summary = await walletService.getEarningsSummary(mech._id);
    assert.strictEqual(summary.payableEarnings, s.pricing.servicePrice);
    assert.strictEqual(summary.outstanding, s.pricing.servicePrice);
    assert.strictEqual(summary.paidOut, 0);
  });

  await scenario('admin payout settles the online earning -> outstanding drops to zero', async () => {
    const s = await scaffold();
    const { bookingId, mech } = await toWorkStarted(s);
    await request(app).post(`/api/mobile/mechanic/bookings/${bookingId}/complete`).set(h.authHeader(mech));
    const booking = await Booking.findById(bookingId);
    booking.status = 'PAYMENT_PENDING';
    booking.paymentMethod = 'RAZORPAY';
    await booking.save();
    const payment = await BookingPayment.create({
      bookingId: booking._id,
      customerId: booking.customerId,
      mechanicId: booking.mechanicId,
      method: 'RAZORPAY',
      status: 'PAID',
      amount: booking.bill.totalAmount,
      razorpayPaymentId: `pay_test_${bookingId}`,
    });
    await paymentService.finalizePaidBooking(booking, payment, null);

    // Admin settles all outstanding earnings for this mechanic.
    const { payout, summary } = await adminWalletService.createPayout(
      mech._id,
      { settleAll: true, method: 'BANK_TRANSFER', reference: 'UTR123', note: 'weekly payout' },
      null
    );
    assert.strictEqual(payout.amount, s.pricing.servicePrice);
    assert.strictEqual(payout.earningsCount, 1);
    assert.strictEqual(summary.outstanding, 0);
    assert.strictEqual(summary.paidOut, s.pricing.servicePrice);

    // The earning is now PAID and linked to the payout.
    const earning = await WalletTransaction.findOne({ idempotencyKey: `earning:${bookingId}` });
    assert.strictEqual(earning.payoutStatus, PAYOUT_STATUS.PAID);
    assert.ok(earning.payoutId, 'earning linked to payout');
    assert.ok(earning.paidOutAt, 'paidOutAt stamped');
    // A PAYOUT ledger entry was appended for the audit trail.
    const payoutTxn = await WalletTransaction.findOne({ idempotencyKey: `payout:${payout._id}` });
    assert.ok(payoutTxn, 'payout ledger entry exists');
    assert.strictEqual(payoutTxn.type, WALLET_TXN_TYPE.PAYOUT);

    // Nothing left to settle: a second settle-all is rejected.
    let threw = false;
    try {
      await adminWalletService.createPayout(mech._id, { settleAll: true }, null);
    } catch (e) {
      threw = true;
    }
    assert.ok(threw, 'second settle-all with nothing outstanding is rejected');
    assert.strictEqual(await MechanicPayout.countDocuments({ mechanicId: mech._id }), 1);
  });

  await scenario('cash due can be cleared online -> balance returns to zero', async () => {
    const s = await scaffold();
    const { bookingId, mech } = await toWorkStarted(s);
    await request(app).post(`/api/mobile/mechanic/bookings/${bookingId}/complete`).set(h.authHeader(mech));
    await request(app).post(`/api/mobile/bookings/${bookingId}/pay`).set(h.authHeader(s.customer)).send({ method: 'CASH' }).expect(200);
    await request(app).post(`/api/mobile/mechanic/bookings/${bookingId}/collect-cash`).set(h.authHeader(mech)).expect(200);
    const company = s.pricing.gstAmount + s.pricing.platformFee;
    let wallet = await walletService.getWallet(mech._id);
    assert.strictEqual(wallet.balance, -company);
    assert.strictEqual(await walletService.getDueAmount(mech._id), company);

    // Mechanic pays their due online. Simulate the DueSettlement + finalize.
    const settlement = await DueSettlement.create({
      mechanicId: mech._id,
      amount: company,
      status: 'PENDING',
      razorpayOrderId: `order_due_${mech._id}`,
    });
    await paymentService.finalizeDueSettlement(settlement, { paymentId: `pay_due_${mech._id}` });
    wallet = await walletService.getWallet(mech._id);
    assert.strictEqual(wallet.balance, 0);
    assert.strictEqual(await walletService.getDueAmount(mech._id), 0);
    // Idempotent: replaying the settlement doesn't double-credit.
    await paymentService.finalizeDueSettlement(settlement, { paymentId: `pay_due_${mech._id}` });
    wallet = await walletService.getWallet(mech._id);
    assert.strictEqual(wallet.balance, 0);
  });

  await scenario('flexible charges: extra tax + discount reflected in bill & split', async () => {
    // GST 18 on 1000 = 180, platform 30, +50 flat "Convenience", -100 discount
    const s = await scaffold({
      serviceOpts: {
        servicePrice: 1000,
        gstPercentage: 18,
        platformFee: 30,
        charges: [
          { name: 'Convenience Fee', mode: 'FLAT', value: 50 },
          { name: 'Festive Discount', mode: 'FLAT', value: 100, isDiscount: true },
        ],
      },
    });
    const { bookingId, mech } = await toWorkStarted(s);
    await request(app).post(`/api/mobile/mechanic/bookings/${bookingId}/complete`).set(h.authHeader(mech)).expect(200);
    const booking = await Booking.findById(bookingId);
    // total = 1000 + 180 + 30 + 50 - 100 = 1160
    assert.strictEqual(booking.bill.totalAmount, 1160);
    assert.strictEqual(booking.bill.providerEarning, 1000); // mechanic still earns only servicePrice
    assert.strictEqual(booking.bill.companyAmount, 160); // total - servicePrice
    assert.ok(booking.bill.breakdown.length >= 4);
  });

  await scenario('rating updates aggregate; only one rating per booking', async () => {
    const s = await scaffold();
    const { bookingId, mech } = await toWorkStarted(s);
    await request(app).post(`/api/mobile/mechanic/bookings/${bookingId}/complete`).set(h.authHeader(mech));
    await request(app).post(`/api/mobile/bookings/${bookingId}/pay`).set(h.authHeader(s.customer)).send({ method: 'CASH' });
    await request(app).post(`/api/mobile/mechanic/bookings/${bookingId}/collect-cash`).set(h.authHeader(mech));
    await request(app).post(`/api/mobile/bookings/${bookingId}/rating`).set(h.authHeader(s.customer)).send({ rating: 5, feedback: 'Great' }).expect(201);
    await request(app).post(`/api/mobile/bookings/${bookingId}/rating`).set(h.authHeader(s.customer)).send({ rating: 3 }).expect(409);
    const ratings = await request(app).get('/api/mobile/mechanic/ratings').set(h.authHeader(mech));
    assert.strictEqual(ratings.body.data.summary.count, 1);
    assert.strictEqual(ratings.body.data.summary.average, 5);
  });

  await scenario('wallet ledger idempotency: duplicate key credits once', async () => {
    const mech = await h.createMechanic();
    const entry = {
      mechanicId: mech._id,
      type: WALLET_TXN_TYPE.SERVICE_EARNING,
      direction: WALLET_TXN_DIRECTION.CREDIT,
      amount: 1000,
      affects: 'balance',
      idempotencyKey: `earning:idem-test`,
    };
    const first = await walletService.recordTransaction(entry);
    const second = await walletService.recordTransaction(entry);
    assert.strictEqual(first.duplicate, false);
    assert.strictEqual(second.duplicate, true);
    const wallet = await walletService.getWallet(mech._id);
    assert.strictEqual(wallet.balance, 1000);
  });

  await scenario('SECURITY: mobile register cannot self-provision a privileged role', async () => {
    for (const role of ['superadmin', 'admin']) {
      const res = await request(app)
        .post('/api/auth/mobile/register')
        .send({ idToken: 'x.y.z', role, name: 'Attacker', phone: '+910000000000' });
      assert.strictEqual(res.status, 400, `role=${role} must be rejected by validation`);
    }
    const privileged = await User.countDocuments({ role: { $in: ['admin', 'superadmin'] } });
    assert.strictEqual(privileged, 0, 'no privileged account may be created via mobile register');
  });

  await scenario('SECURITY: mobile login blocks operator-injection, missing token, and fails closed', async () => {
    // $-operator payload is stripped by the sanitizer; an invalid role is rejected.
    const inj = await request(app)
      .post('/api/auth/mobile/login')
      .send({ firebaseUid: { $ne: null }, role: 'superadmin' });
    assert.strictEqual(inj.status, 400);
    assert.ok(!inj.body?.data?.accessToken, 'no token may be issued');

    // A missing idToken is rejected — the server never trusts a bare uid.
    const noToken = await request(app).post('/api/auth/mobile/login').send({ role: 'customer' });
    assert.strictEqual(noToken.status, 400);

    // An unverifiable token fails closed (no session minted) rather than open.
    const failClosed = await request(app)
      .post('/api/auth/mobile/login')
      .send({ idToken: 'not-a-real-token', role: 'customer' });
    assert.strictEqual(failClosed.body.success, false);
    assert.ok(!failClosed.body?.data?.accessToken);
  });

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  await mongod.stop();
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('Runner crashed:', err);
  process.exit(1);
});
