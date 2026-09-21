'use strict';

const request = require('supertest');
const { app } = require('../setup');
const h = require('../helpers/mobile.helper');

const dispatchService = require('../../src/modules/bookings/dispatch.service');
const walletService = require('../../src/modules/wallet/wallet.service');
const Booking = require('../../src/modules/bookings/booking.model');
const MechanicRequest = require('../../src/modules/bookings/mechanicRequest.model');
const { REQUEST_STATUS, WALLET_TXN_TYPE, WALLET_TXN_DIRECTION } = require('../../src/modules/bookings/booking.constants');

/** Create the standard fixtures for an instant booking. */
async function scaffold({ serviceOpts = {}, mechanics = 1 } = {}) {
  const customer = await h.createCustomer();
  const { category, city, service, pricing } = await h.setupService(serviceOpts);
  const vehicle = await h.createVehicle(customer, category);
  const address = await h.createAddress(customer);
  const mechs = [];
  for (let i = 0; i < mechanics; i++) {
    mechs.push(await h.createMechanic({ ratingAverage: 4 + i * 0.1 }));
  }
  return { customer, category, city, service, pricing, vehicle, address, mechanics: mechs };
}

async function createInstantBooking(customer, service, vehicle, address) {
  const res = await request(app)
    .post('/api/mobile/bookings')
    .set(h.authHeader(customer))
    .send({ serviceId: service._id, vehicleId: vehicle._id, bookingType: 'INSTANT', addressId: address._id });
  return res;
}

describe('Booking lifecycle', () => {
  test('creates an instant booking and dispatches to an eligible mechanic', async () => {
    const { customer, service, vehicle, address, mechanics } = await scaffold();
    const res = await createInstantBooking(customer, service, vehicle, address);

    expect(res.status).toBe(201);
    expect(res.body.data.booking.status).toBe('SEARCHING_MECHANIC');
    expect(res.body.data.booking.otp).toBeTruthy();

    const pending = await MechanicRequest.find({ status: REQUEST_STATUS.PENDING });
    expect(pending).toHaveLength(1);
    expect(String(pending[0].mechanicId)).toBe(String(mechanics[0]._id));
  });

  test('rejects a booking when vehicle category does not match the service', async () => {
    const customer = await h.createCustomer();
    const { service } = await h.setupService();
    // Vehicle in a DIFFERENT category
    const otherCat = (await h.setupService()).category;
    const vehicle = await h.createVehicle(customer, otherCat);
    const address = await h.createAddress(customer);

    const res = await createInstantBooking(customer, service, vehicle, address);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not compatible/i);
  });

  test('mechanic accepts -> booking assigned atomically (only one winner)', async () => {
    const { customer, service, vehicle, address, mechanics } = await scaffold({ mechanics: 2 });
    const createRes = await createInstantBooking(customer, service, vehicle, address);
    const bookingId = createRes.body.data.booking._id;

    // Give a second mechanic a concurrent offer to simulate a race.
    await MechanicRequest.create({
      bookingId,
      mechanicId: mechanics[1]._id,
      status: REQUEST_STATUS.PENDING,
      sequence: 1,
      expiresAt: new Date(Date.now() + 60000),
    });

    const results = await Promise.allSettled([
      dispatchService.acceptRequest(bookingId, mechanics[0]),
      dispatchService.acceptRequest(bookingId, mechanics[1]),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const booking = await Booking.findById(bookingId);
    expect(booking.status).toBe('MECHANIC_ASSIGNED');
    expect(booking.mechanicId).toBeTruthy();
    const accepted = await MechanicRequest.find({ bookingId, status: REQUEST_STATUS.ACCEPTED });
    expect(accepted).toHaveLength(1);
  });

  test('mechanic rejects -> request moves to the next eligible mechanic', async () => {
    const { customer, service, vehicle, address, mechanics } = await scaffold({ mechanics: 2 });
    const createRes = await createInstantBooking(customer, service, vehicle, address);
    const bookingId = createRes.body.data.booking._id;

    const firstOffer = await MechanicRequest.findOne({ bookingId, status: REQUEST_STATUS.PENDING });
    const firstMech = mechanics.find((m) => String(m._id) === String(firstOffer.mechanicId));

    await request(app)
      .post(`/api/mobile/mechanic/requests/${bookingId}/reject`)
      .set(h.authHeader(firstMech))
      .expect(200);

    const pending = await MechanicRequest.find({ bookingId, status: REQUEST_STATUS.PENDING });
    expect(pending).toHaveLength(1);
    expect(String(pending[0].mechanicId)).not.toBe(String(firstOffer.mechanicId));
  });

  test('offer timeout -> sweeper expires it and dispatches next mechanic', async () => {
    const { customer, service, vehicle, address } = await scaffold({ mechanics: 2 });
    const createRes = await createInstantBooking(customer, service, vehicle, address);
    const bookingId = createRes.body.data.booking._id;

    const offer = await MechanicRequest.findOne({ bookingId, status: REQUEST_STATUS.PENDING });
    offer.expiresAt = new Date(Date.now() - 1000);
    await offer.save();

    await dispatchService.sweepExpired();

    const expired = await MechanicRequest.findById(offer._id);
    expect(expired.status).toBe(REQUEST_STATUS.EXPIRED);
    const pending = await MechanicRequest.find({ bookingId, status: REQUEST_STATUS.PENDING });
    expect(pending).toHaveLength(1);
    expect(String(pending[0].mechanicId)).not.toBe(String(offer.mechanicId));
  });

  test('no eligible mechanics -> booking expires', async () => {
    const customer = await h.createCustomer();
    const { category, service } = await h.setupService();
    const vehicle = await h.createVehicle(customer, category);
    const address = await h.createAddress(customer);
    // No online mechanics created.
    const res = await createInstantBooking(customer, service, vehicle, address);
    const booking = await Booking.findById(res.body.data.booking._id);
    expect(booking.status).toBe('EXPIRED');
  });
});

describe('OTP-gated work start', () => {
  async function assignedBooking(opts = {}) {
    const s = await scaffold(opts);
    const createRes = await createInstantBooking(s.customer, s.service, s.vehicle, s.address);
    const bookingId = createRes.body.data.booking._id;
    await dispatchService.acceptRequest(bookingId, s.mechanics[0]);
    return { ...s, bookingId };
  }

  test('wrong OTP is rejected, correct OTP starts work', async () => {
    const { customer, mechanics, bookingId } = await assignedBooking();
    const mech = mechanics[0];

    await request(app).post(`/api/mobile/mechanic/bookings/${bookingId}/arrive`).set(h.authHeader(mech)).expect(200);

    // Wrong OTP
    await request(app)
      .post(`/api/mobile/mechanic/bookings/${bookingId}/start`)
      .set(h.authHeader(mech))
      .send({ otp: '0000' })
      .expect(400);

    // Fetch the real OTP as the customer
    const custView = await request(app)
      .get(`/api/mobile/bookings/${bookingId}`)
      .set(h.authHeader(customer))
      .expect(200);
    const otp = custView.body.data.booking.otp;
    expect(otp).toBeTruthy();

    // Mechanic view must NOT expose the OTP
    const mechView = await request(app)
      .get(`/api/mobile/mechanic/bookings/${bookingId}`)
      .set(h.authHeader(mech))
      .expect(200);
    expect(mechView.body.data.booking.otp).toBeUndefined();

    const startRes = await request(app)
      .post(`/api/mobile/mechanic/bookings/${bookingId}/start`)
      .set(h.authHeader(mech))
      .send({ otp })
      .expect(200);
    expect(startRes.body.data.booking.status).toBe('WORK_STARTED');
  });
});

describe('Additional services & billing', () => {
  async function workStarted(opts = {}) {
    const s = await scaffold(opts);
    const createRes = await createInstantBooking(s.customer, s.service, s.vehicle, s.address);
    const bookingId = createRes.body.data.booking._id;
    const mech = s.mechanics[0];
    await dispatchService.acceptRequest(bookingId, mech);
    await request(app).post(`/api/mobile/mechanic/bookings/${bookingId}/arrive`).set(h.authHeader(mech));
    const custView = await request(app).get(`/api/mobile/bookings/${bookingId}`).set(h.authHeader(s.customer));
    const otp = custView.body.data.booking.otp;
    await request(app).post(`/api/mobile/mechanic/bookings/${bookingId}/start`).set(h.authHeader(mech)).send({ otp });
    return { ...s, bookingId, mech };
  }

  test('rejected additional service is NOT billed; accepted one IS', async () => {
    const { customer, category, city, service, pricing, bookingId, mech } = await workStarted();
    const addl = await h.setupMechanicService({ category, city, servicePrice: 800, gstPercentage: 18, platformFee: 20 });

    // Mechanic proposes an additional service
    const addRes = await request(app)
      .post(`/api/mobile/mechanic/bookings/${bookingId}/additional-services`)
      .set(h.authHeader(mech))
      .send({ mechanicServiceId: addl.service._id, reason: 'Brake pads worn' })
      .expect(201);
    const addItem = addRes.body.data.booking.services.find((s) => s.kind === 'ADDITIONAL');
    expect(addItem.status).toBe('REQUESTED');

    // Customer REJECTS
    await request(app)
      .post(`/api/mobile/bookings/${bookingId}/additional-services/${addItem._id}/respond`)
      .set(h.authHeader(customer))
      .send({ accept: false })
      .expect(200);

    await request(app).post(`/api/mobile/mechanic/bookings/${bookingId}/complete`).set(h.authHeader(mech)).expect(200);
    let booking = await Booking.findById(bookingId);
    expect(booking.bill.totalAmount).toBe(pricing.totalPrice); // only original
    expect(booking.bill.providerEarning).toBe(pricing.servicePrice);
  });

  test('accepted additional service is included in the bill', async () => {
    const { customer, category, city, pricing, bookingId, mech } = await workStarted();
    const addl = await h.setupMechanicService({ category, city, servicePrice: 800, gstPercentage: 18, platformFee: 20 });

    const addRes = await request(app)
      .post(`/api/mobile/mechanic/bookings/${bookingId}/additional-services`)
      .set(h.authHeader(mech))
      .send({ mechanicServiceId: addl.service._id, reason: 'Oil change' });
    const addItem = addRes.body.data.booking.services.find((s) => s.kind === 'ADDITIONAL');

    await request(app)
      .post(`/api/mobile/bookings/${bookingId}/additional-services/${addItem._id}/respond`)
      .set(h.authHeader(customer))
      .send({ accept: true })
      .expect(200);

    await request(app).post(`/api/mobile/mechanic/bookings/${bookingId}/complete`).set(h.authHeader(mech)).expect(200);
    const booking = await Booking.findById(bookingId);
    expect(booking.bill.totalAmount).toBe(pricing.totalPrice + addl.pricing.totalPrice);
    expect(booking.bill.providerEarning).toBe(pricing.servicePrice + addl.pricing.servicePrice);
    expect(booking.bill.companyAmount).toBe(
      pricing.gstAmount + pricing.platformFee + addl.pricing.gstAmount + addl.pricing.platformFee
    );
  });

  test('incomplete required checklist blocks completion', async () => {
    const { bookingId, mech } = await workStarted({
      serviceOpts: { checklist: [{ label: 'Exterior wash', required: true }] },
    });

    // Cannot complete with the required item undone
    await request(app).post(`/api/mobile/mechanic/bookings/${bookingId}/complete`).set(h.authHeader(mech)).expect(400);

    // Mark the checklist item done, then completion succeeds
    const view = await request(app).get(`/api/mobile/mechanic/bookings/${bookingId}`).set(h.authHeader(mech));
    const original = view.body.data.booking.services.find((s) => s.kind === 'ORIGINAL');
    const itemId = original.checklist[0]._id;

    await request(app)
      .patch(`/api/mobile/mechanic/booking-services/${original._id}/checklist`)
      .set(h.authHeader(mech))
      .send({ checklistItemId: itemId, done: true })
      .expect(200);

    await request(app).post(`/api/mobile/mechanic/bookings/${bookingId}/complete`).set(h.authHeader(mech)).expect(200);
    const booking = await Booking.findById(bookingId);
    expect(booking.status).toBe('READY_FOR_BILLING');
  });
});

describe('Payment, wallet ledger & rating', () => {
  async function readyForBilling(opts = {}) {
    const s = await scaffold(opts);
    const createRes = await createInstantBooking(s.customer, s.service, s.vehicle, s.address);
    const bookingId = createRes.body.data.booking._id;
    const mech = s.mechanics[0];
    await dispatchService.acceptRequest(bookingId, mech);
    await request(app).post(`/api/mobile/mechanic/bookings/${bookingId}/arrive`).set(h.authHeader(mech));
    const custView = await request(app).get(`/api/mobile/bookings/${bookingId}`).set(h.authHeader(s.customer));
    const otp = custView.body.data.booking.otp;
    await request(app).post(`/api/mobile/mechanic/bookings/${bookingId}/start`).set(h.authHeader(mech)).send({ otp });
    await request(app).post(`/api/mobile/mechanic/bookings/${bookingId}/complete`).set(h.authHeader(mech));
    return { ...s, bookingId, mech };
  }

  test('cash payment settles the wallet with correct split', async () => {
    const { customer, mech, bookingId, pricing } = await readyForBilling();

    // Customer chooses cash
    await request(app)
      .post(`/api/mobile/bookings/${bookingId}/pay`)
      .set(h.authHeader(customer))
      .send({ method: 'CASH' })
      .expect(200);

    // Mechanic confirms collection
    await request(app)
      .post(`/api/mobile/mechanic/bookings/${bookingId}/collect-cash`)
      .set(h.authHeader(mech))
      .expect(200);

    const booking = await Booking.findById(bookingId);
    expect(booking.status).toBe('COMPLETED');
    expect(booking.paymentStatus).toBe('PAID');

    const walletRes = await request(app).get('/api/mobile/mechanic/wallet').set(h.authHeader(mech)).expect(200);
    const wallet = walletRes.body.data.wallet;
    // Cash: mechanic keeps their earning as cash and owes the company its cut,
    // so the wallet balance is negative by the company amount.
    expect(wallet.balance).toBe(-(pricing.gstAmount + pricing.platformFee));
    expect(wallet.lifetimeEarnings).toBe(pricing.servicePrice);
  });

  test('rating updates the mechanic aggregate and is one-per-booking', async () => {
    const { customer, mech, bookingId } = await readyForBilling();
    await request(app).post(`/api/mobile/bookings/${bookingId}/pay`).set(h.authHeader(customer)).send({ method: 'CASH' });
    await request(app).post(`/api/mobile/mechanic/bookings/${bookingId}/collect-cash`).set(h.authHeader(mech));

    await request(app)
      .post(`/api/mobile/bookings/${bookingId}/rating`)
      .set(h.authHeader(customer))
      .send({ rating: 5, feedback: 'Great!' })
      .expect(201);

    // Second attempt is rejected
    await request(app)
      .post(`/api/mobile/bookings/${bookingId}/rating`)
      .set(h.authHeader(customer))
      .send({ rating: 3 })
      .expect(409);

    const ratingsRes = await request(app).get('/api/mobile/mechanic/ratings').set(h.authHeader(mech)).expect(200);
    expect(ratingsRes.body.data.summary.count).toBe(1);
    expect(ratingsRes.body.data.summary.average).toBe(5);
  });
});

describe('Wallet ledger idempotency', () => {
  test('duplicate settlement with the same idempotencyKey credits only once', async () => {
    const mech = await h.createMechanic();
    const entry = {
      mechanicId: mech._id,
      type: WALLET_TXN_TYPE.SERVICE_EARNING,
      direction: WALLET_TXN_DIRECTION.CREDIT,
      amount: 1000,
      affects: 'balance',
      idempotencyKey: `earning:test-booking-1`,
    };

    const first = await walletService.recordTransaction(entry);
    const second = await walletService.recordTransaction(entry);

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);

    const wallet = await walletService.getWallet(mech._id);
    expect(wallet.balance).toBe(1000); // not 2000
  });
});
