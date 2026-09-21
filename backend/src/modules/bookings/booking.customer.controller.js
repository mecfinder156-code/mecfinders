'use strict';

const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const bookingService = require('./booking.service');
const additionalService = require('./additionalService.service');
const paymentService = require('../payments/payment.service');
const ratingService = require('../ratings/rating.service');

const createBooking = catchAsync(async (req, res) => {
  const booking = await bookingService.createBooking(req.user, req.body);
  const data = await bookingService.getBookingForUser(booking._id, req.user);
  return ApiResponse.created(res, { booking: data }, 'Booking created');
});

const listBookings = catchAsync(async (req, res) => {
  const { status, page, limit } = req.query;
  const result = await bookingService.listCustomerBookings(req.user._id, {
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
  const data = await bookingService.getBookingForUser(req.params.id, req.user, {
    includeTimeline: true,
  });
  return ApiResponse.success(res, { booking: data });
});

const cancelBooking = catchAsync(async (req, res) => {
  await bookingService.cancelBooking(req.params.id, req.user, req.body.reason);
  const data = await bookingService.getBookingForUser(req.params.id, req.user);
  return ApiResponse.success(res, { booking: data }, 'Booking cancelled');
});

const respondAdditionalService = catchAsync(async (req, res) => {
  const accept = req.body.accept === true || req.body.accept === 'true';
  await additionalService.respondToAdditionalService(req.params.itemId, req.user, accept);
  const data = await bookingService.getBookingForUser(req.params.id, req.user);
  return ApiResponse.success(res, { booking: data }, accept ? 'Additional service accepted' : 'Additional service rejected');
});

const initiatePayment = catchAsync(async (req, res) => {
  const result = await paymentService.initiatePayment(req.params.id, req.user, req.body.method);
  return ApiResponse.success(res, result, 'Payment initiated');
});

const verifyRazorpay = catchAsync(async (req, res) => {
  const { orderId, paymentId, signature } = req.body;
  await paymentService.verifyRazorpayPayment(req.params.id, req.user, { orderId, paymentId, signature });
  const data = await bookingService.getBookingForUser(req.params.id, req.user);
  return ApiResponse.success(res, { booking: data }, 'Payment verified');
});

const submitRating = catchAsync(async (req, res) => {
  const rating = await ratingService.submitRating(req.params.id, req.user, {
    rating: Number(req.body.rating),
    feedback: req.body.feedback,
  });
  return ApiResponse.created(res, { rating }, 'Thanks for your feedback');
});

module.exports = {
  createBooking,
  listBookings,
  getBooking,
  cancelBooking,
  respondAdditionalService,
  initiatePayment,
  verifyRazorpay,
  submitRating,
};
