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

  const items = [];
  for (const reqDoc of requests) {
    const booking = await Booking.findById(reqDoc.bookingId);
    if (!booking) continue;
    const services = await bookingService.loadServices(booking._id);
    const customer = await User.findById(booking.customerId);
    items.push({
      requestId: reqDoc._id,
      expiresAt: reqDoc.expiresAt,
      sequence: reqDoc.sequence,
      distanceMeters: reqDoc.distanceMeters,
      booking: serializer.forMechanic(booking, { services, customer }),
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
  return ApiResponse.success(res, { wallet });
});

const getWalletTransactions = catchAsync(async (req, res) => {
  const { page, limit } = req.query;
  const result = await walletService.getTransactions(req.user._id, {
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
  getRatings,
};
