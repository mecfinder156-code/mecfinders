'use strict';

const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');

const bookingService = require('./booking.service');
const dispatchService = require('./dispatch.service');
const additionalService = require('./additionalService.service');
const paymentService = require('../payments/payment.service');
const locationService = require('./location.service');
const walletService = require('../wallet/wallet.service');
const payoutService = require('../wallet/payout.service');
const ratingService = require('../ratings/rating.service');
const serializer = require('./booking.serializer');

const MechanicRequest = require('./mechanicRequest.model');
const Booking = require('./booking.model');
const User = require('../users/models/user.model');
const { REQUEST_STATUS } = require('./booking.constants');

/** Pending dispatch offers currently addressed to this mechanic. */
const listRequests = catchAsync(async (req, res) => {
  const now = new Date();
  const requests = await MechanicRequest.find({
    mechanicId: req.user._id,
    status: REQUEST_STATUS.PENDING,
    expiresAt: { $gt: now },
  })
    .sort({ sentAt: -1 })
    .lean();

  if (!requests.length) return ApiResponse.success(res, { requests: [] });

  // Batch-load bookings, their services and customers in one query each
  // (previously an N+1 loop that fired 3 queries per pending offer).
  const bookingIds = requests.map((r) => r.bookingId);
  const bookings = await Booking.find({ _id: { $in: bookingIds } }).lean();
  const bookingById = new Map(bookings.map((b) => [String(b._id), b]));

  const customerIds = [...new Set(bookings.map((b) => String(b.customerId)))];
  const [servicesByBooking, customers] = await Promise.all([
    bookingService.loadServicesForBookings(bookingIds),
    User.find({ _id: { $in: customerIds } }).lean(),
  ]);
  const custById = new Map(customers.map((c) => [String(c._id), c]));

  const items = [];
  for (const reqDoc of requests) {
    const booking = bookingById.get(String(reqDoc.bookingId));
    if (!booking) continue;
    items.push({
      requestId: reqDoc._id,
      expiresAt: reqDoc.expiresAt,
      sequence: reqDoc.sequence,
      distanceMeters: reqDoc.distanceMeters,
      booking: serializer.forMechanic(booking, {
        services: servicesByBooking.get(String(booking._id)) || [],
        customer: custById.get(String(booking.customerId)) || null,
      }),
    });
  }
  return ApiResponse.success(res, { requests: items });
});

const acceptRequest = catchAsync(async (req, res) => {
  await dispatchService.acceptRequest(req.params.bookingId, req.user);
  const data = await bookingService.getBookingForUser(req.params.bookingId, req.user);
  return ApiResponse.success(res, { booking: data }, 'Request accepted');
});

const rejectRequest = catchAsync(async (req, res) => {
  await dispatchService.rejectRequest(req.params.bookingId, req.user);
  return ApiResponse.success(res, null, 'Request rejected');
});

const listBookings = catchAsync(async (req, res) => {
  const { status, page, limit } = req.query;
  const result = await bookingService.listMechanicBookings(req.user._id, {
    status,
    page: parseInt(page, 10) || 1,
    limit: parseInt(limit, 10) || 20,
  });
  return ApiResponse.paginated(res, result.items, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    pages: result.pages,
  });
});

const getBooking = catchAsync(async (req, res) => {
  const data = await bookingService.getBookingForUser(req.params.id, req.user, { includeTimeline: true });
  return ApiResponse.success(res, { booking: data });
});

const arrive = catchAsync(async (req, res) => {
  await bookingService.markArrived(req.params.id, req.user);
  const data = await bookingService.getBookingForUser(req.params.id, req.user);
  return ApiResponse.success(res, { booking: data }, 'Marked as arrived');
});

const startWork = catchAsync(async (req, res) => {
  await bookingService.verifyOtpAndStartWork(req.params.id, req.user, req.body.otp);
  const data = await bookingService.getBookingForUser(req.params.id, req.user);
  return ApiResponse.success(res, { booking: data }, 'Work started');
});

const addAdditionalService = catchAsync(async (req, res) => {
  const { mechanicServiceId, reason } = req.body;
  if (!mechanicServiceId) throw ApiError.badRequest('mechanicServiceId is required');
  await additionalService.addAdditionalService(req.params.id, req.user, { mechanicServiceId, reason });
  const data = await bookingService.getBookingForUser(req.params.id, req.user);
  return ApiResponse.created(res, { booking: data }, 'Additional service requested');
});

const updateChecklistItem = catchAsync(async (req, res) => {
  const { checklistItemId, done } = req.body;
  if (!checklistItemId) throw ApiError.badRequest('checklistItemId is required');
  const item = await additionalService.updateChecklistItem(
    req.params.itemId,
    req.user,
    checklistItemId,
    done === true || done === 'true'
  );
  return ApiResponse.success(res, { service: serializer.serviceItem(item) }, 'Checklist updated');
});

const completeWork = catchAsync(async (req, res) => {
  await bookingService.completeWork(req.params.id, req.user);
  const data = await bookingService.getBookingForUser(req.params.id, req.user);
  return ApiResponse.success(res, { booking: data }, 'Work completed, bill generated');
});

const collectCash = catchAsync(async (req, res) => {
  await paymentService.confirmCashCollection(req.params.id, req.user);
  const data = await bookingService.getBookingForUser(req.params.id, req.user);
  return ApiResponse.success(res, { booking: data }, 'Cash collection confirmed');
});

const setAvailability = catchAsync(async (req, res) => {
  const mechanic = await locationService.setOnlineStatus(req.user._id, req.body.isOnline);
  return ApiResponse.success(res, { isOnline: mechanic.isOnline }, 'Availability updated');
});

const updateLocation = catchAsync(async (req, res) => {
  const { latitude, longitude } = req.body;
  await locationService.updateMechanicLocation(req.user._id, Number(latitude), Number(longitude));
  return ApiResponse.success(res, null, 'Location updated');
});

const getWallet = catchAsync(async (req, res) => {
  const wallet = await walletService.getWallet(req.user._id);
  const due = wallet.balance < 0 ? Math.abs(wallet.balance) : 0;
  // Online earnings are held by the platform and paid out by an admin; expose
  // the payable/paid/outstanding summary so the app can show "pending payout".
  // Optional from/to scopes `summary.earnedInRange` for the wallet's month
  // filter without changing the running (all-time) outstanding figure.
  const { from, to } = req.query;
  const summary = await walletService.getEarningsSummary(req.user._id, { from, to });
  return ApiResponse.success(res, { wallet, due, summary });
});

const getWalletTransactions = catchAsync(async (req, res) => {
  const { page, limit, from, to, type } = req.query;
  const result = await walletService.getTransactions(req.user._id, {
    page: parseInt(page, 10) || 1,
    limit: parseInt(limit, 10) || 20,
    from,
    to,
    type,
  });
  return ApiResponse.paginated(res, result.items, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    pages: result.pages,
  });
});

// --- Payout bank details ---
const getBankDetails = catchAsync(async (req, res) => {
  const bankDetails = await payoutService.getBankDetails(req.user._id);
  return ApiResponse.success(res, { bankDetails });
});

const updateBankDetails = catchAsync(async (req, res) => {
  const bankDetails = await payoutService.updateBankDetails(req.user, req.body);
  return ApiResponse.success(res, { bankDetails }, 'Bank details saved');
});

// --- Platform due settlement (pay off cash-collected dues online) ---
const initiateDueSettlement = catchAsync(async (req, res) => {
  const data = await paymentService.initiateDueSettlement(req.user);
  return ApiResponse.success(res, data);
});

const verifyDueSettlement = catchAsync(async (req, res) => {
  const { orderId, paymentId, signature } = req.body;
  if (!orderId || !paymentId || !signature) {
    throw ApiError.badRequest('orderId, paymentId and signature are required');
  }
  const data = await paymentService.verifyDueSettlement(req.user, { orderId, paymentId, signature });
  return ApiResponse.success(res, data, 'Due cleared');
});

const getRatings = catchAsync(async (req, res) => {
  const summary = await ratingService.getMechanicRatingSummary(req.user._id);
  const reviews = await ratingService.listMechanicReviews(req.user._id, {
    page: parseInt(req.query.page, 10) || 1,
    limit: parseInt(req.query.limit, 10) || 20,
  });
  return ApiResponse.success(res, { summary, reviews });
});

module.exports = {
  listRequests,
  acceptRequest,
  rejectRequest,
  listBookings,
  getBooking,
  arrive,
  startWork,
  addAdditionalService,
  updateChecklistItem,
  completeWork,
  collectCash,
  setAvailability,
  updateLocation,
  getWallet,
  getWalletTransactions,
  getBankDetails,
  updateBankDetails,
  initiateDueSettlement,
  verifyDueSettlement,
  getRatings,
};
