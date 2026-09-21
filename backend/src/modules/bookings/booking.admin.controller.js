'use strict';

const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');

const Booking = require('./booking.model');
const BookingService = require('./bookingService.model');
const BookingPayment = require('../payments/bookingPayment.model');
const Rating = require('../ratings/rating.model');
const User = require('../users/models/user.model');
const timeline = require('./timeline.service');
const serializer = require('./booking.serializer');
const walletService = require('../wallet/wallet.service');
const {
  BOOKING_STATUS,
  BOOKING_TYPE,
  PAYMENT_STATUS,
} = require('./booking.constants');

const listBookings = catchAsync(async (req, res) => {
  const { status, bookingType, paymentStatus, mechanicId, customerId, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (bookingType) filter.bookingType = bookingType;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (mechanicId) filter.mechanicId = mechanicId;
  if (customerId) filter.customerId = customerId;

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [items, total] = await Promise.all([
    Booking.find(filter)
      .populate('customerId', 'name phone')
      .populate('mechanicId', 'name phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean(),
    Booking.countDocuments(filter),
  ]);

  const rows = items.map((b) => ({
    _id: b._id,
    status: b.status,
    bookingType: b.bookingType,
    customer: b.customerId ? { _id: b.customerId._id, name: b.customerId.name, phone: b.customerId.phone } : null,
    mechanic: b.mechanicId ? { _id: b.mechanicId._id, name: b.mechanicId.name, phone: b.mechanicId.phone } : null,
    vehicle: b.vehicle ? `${b.vehicle.make || ''} ${b.vehicle.model || ''} (${b.vehicle.registrationNumber || ''})`.trim() : null,
    city: b.serviceLocation?.city || null,
    paymentMethod: b.paymentMethod,
    paymentStatus: b.paymentStatus,
    totalAmount: b.bill?.totalAmount || 0,
    createdAt: b.createdAt,
    assignedAt: b.assignedAt,
    workStartedAt: b.workStartedAt,
    completedAt: b.completedAt,
  }));

  return ApiResponse.paginated(res, rows, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    total,
    pages: Math.ceil(total / limit),
  });
});

const getBooking = catchAsync(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw ApiError.notFound('Booking not found');
  const [services, tl, mechanic, customer] = await Promise.all([
    BookingService.find({ bookingId: booking._id }).sort({ kind: 1, createdAt: 1 }),
    timeline.getTimeline(booking._id),
    booking.mechanicId ? User.findById(booking.mechanicId) : null,
    User.findById(booking.customerId),
  ]);
  const data = serializer.forAdmin(booking, { services, mechanic, customer, timeline: tl });
  return ApiResponse.success(res, { booking: data });
});

const getStats = catchAsync(async (req, res) => {
  const [byStatus, byType, revenue] = await Promise.all([
    Booking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Booking.aggregate([{ $group: { _id: '$bookingType', count: { $sum: 1 } } }]),
    Booking.aggregate([
      { $match: { status: BOOKING_STATUS.COMPLETED } },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$bill.totalAmount' },
          providerEarnings: { $sum: '$bill.providerEarning' },
          companyAmount: { $sum: '$bill.companyAmount' },
          gst: { $sum: '$bill.gstAmount' },
          platformFee: { $sum: '$bill.platformFee' },
          completed: { $sum: 1 },
        },
      },
    ]),
  ]);

  const statusCounts = {};
  for (const s of Object.values(BOOKING_STATUS)) statusCounts[s] = 0;
  for (const row of byStatus) statusCounts[row._id] = row.count;

  const typeCounts = {};
  for (const t of Object.values(BOOKING_TYPE)) typeCounts[t] = 0;
  for (const row of byType) typeCounts[row._id] = row.count;

  const rev = revenue[0] || {
    revenue: 0,
    providerEarnings: 0,
    companyAmount: 0,
    gst: 0,
    platformFee: 0,
    completed: 0,
  };

  const totalBookings = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  return ApiResponse.success(res, {
    totalBookings,
    statusCounts,
    typeCounts,
    revenue: rev.revenue,
    providerEarnings: rev.providerEarnings,
    companyAmount: rev.companyAmount,
    gst: rev.gst,
    platformFee: rev.platformFee,
    completed: rev.completed,
  });
});

const listPayments = catchAsync(async (req, res) => {
  const { status, method, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (method) filter.method = method;
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [items, total] = await Promise.all([
    BookingPayment.find(filter)
      .populate('customerId', 'name')
      .populate('mechanicId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean(),
    BookingPayment.countDocuments(filter),
  ]);
  return ApiResponse.paginated(res, items, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    total,
    pages: Math.ceil(total / limit),
  });
});

const listRatings = catchAsync(async (req, res) => {
  const { mechanicId, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (mechanicId) filter.mechanicId = mechanicId;
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [items, total] = await Promise.all([
    Rating.find(filter)
      .populate('customerId', 'name')
      .populate('mechanicId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean(),
    Rating.countDocuments(filter),
  ]);
  return ApiResponse.paginated(res, items, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    total,
    pages: Math.ceil(total / limit),
  });
});

const getMechanicWallet = catchAsync(async (req, res) => {
  const wallet = await walletService.getWallet(req.params.mechanicId);
  const txns = await walletService.getTransactions(req.params.mechanicId, {
    page: parseInt(req.query.page, 10) || 1,
    limit: parseInt(req.query.limit, 10) || 20,
  });
  return ApiResponse.success(res, { wallet, transactions: txns });
});

module.exports = {
  listBookings,
  getBooking,
  getStats,
  listPayments,
  listRatings,
  getMechanicWallet,
};
