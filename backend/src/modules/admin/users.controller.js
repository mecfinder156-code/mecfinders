'use strict';

const User = require('../users/models/user.model');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const { ROLES } = require('../../constants/roles');
const push = require('../notifications/push.service');
const userCache = require('../../utils/userCache');

const getUsers = catchAsync(async (req, res) => {
  const { page = 1, limit = 10, role, search = '' } = req.query;

  const query = { role: { $in: [ROLES.CUSTOMER, ROLES.MECHANIC] } };

  if (role && [ROLES.CUSTOMER, ROLES.MECHANIC].includes(role)) {
    query.role = role;
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10)),
    User.countDocuments(query),
  ]);

  const pagination = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    total,
    pages: Math.ceil(total / limit),
  };

  ApiResponse.paginated(res, users, pagination);
});

const Vehicle = require('../vehicles/vehicle.model');
const Address = require('../addresses/address.model');
const MechanicWallet = require('../wallet/wallet.model');

const getUserById = catchAsync(async (req, res) => {
  const user = await User.findOne({
    _id: req.params.id,
    role: { $in: [ROLES.CUSTOMER, ROLES.MECHANIC] },
  });

  if (!user) {
    throw ApiError.notFound('User not found');
  }

  // Fetch associated data
  const vehicles = await Vehicle.find({ customerId: user._id }).populate('vehicleCategoryId');
  const addresses = await Address.find({ customerId: user._id });

  // For mechanics, surface their wallet (balance + outstanding platform due).
  // bankDetails ride along on the user doc (the raw account number is
  // select:false, so only the masked last-4 is exposed).
  let wallet = null;
  if (user.role === ROLES.MECHANIC) {
    const w = await MechanicWallet.findOne({ mechanicId: user._id }).lean();
    if (w) {
      wallet = {
        balance: w.balance,
        due: w.balance < 0 ? Math.abs(w.balance) : 0,
        lifetimeEarnings: w.lifetimeEarnings,
      };
    }
  }

  ApiResponse.success(res, { user, vehicles, addresses, wallet });
});

const updateUserStatus = catchAsync(async (req, res) => {
  const { isActive } = req.body;
  
  if (typeof isActive !== 'boolean') {
    throw ApiError.badRequest('isActive must be a boolean');
  }

  const user = await User.findOne({ 
    _id: req.params.id, 
    role: { $in: [ROLES.CUSTOMER, ROLES.MECHANIC] } 
  }).select('+refreshToken');

  if (!user) {
    throw ApiError.notFound('User not found');
  }

  user.isActive = isActive;

  if (!isActive) {
    user.refreshToken = null;
  }

  await user.save({ validateBeforeSave: false });
  await userCache.invalidate(user._id);

  const message = isActive ? 'User activated' : 'User deactivated';
  ApiResponse.success(res, { user }, message);
});

/**
 * Pause or resume dispatch for a single mechanic. Unlike `updateUserStatus`
 * (a full account ban that also blocks login), this only toggles the
 * `requestsPaused` flag: a paused mechanic stays logged in and can use the app,
 * but dispatch stops offering them new service requests until an admin resumes.
 */
const updateMechanicDispatch = catchAsync(async (req, res) => {
  const { paused } = req.body;

  if (typeof paused !== 'boolean') {
    throw ApiError.badRequest('paused must be a boolean');
  }

  const user = await User.findOne({ _id: req.params.id, role: ROLES.MECHANIC });

  if (!user) {
    throw ApiError.notFound('Mechanic not found');
  }

  user.requestsPaused = paused;
  await user.save({ validateBeforeSave: false });
  await userCache.invalidate(user._id);

  const message = paused
    ? 'Mechanic paused — they will not receive new service requests'
    : 'Mechanic resumed — they can receive service requests again';
  ApiResponse.success(res, { user }, message);
});

// Push notifications go through the shared, env-configured Firebase helper
// (notifications/push.service). It no-ops safely when FCM isn't configured.
const sendPushNotification = (fcmToken, title, body) => push.send(fcmToken, title, body);

const verifyDocument = catchAsync(async (req, res) => {
  const { id, docType } = req.params;

  const user = await User.findOne({
    _id: id,
    role: { $in: [ROLES.CUSTOMER, ROLES.MECHANIC] },
  });

  if (!user) throw ApiError.notFound('User not found');
  if (!user.documents || user.documents.length === 0) throw ApiError.badRequest('User has no documents');

  const doc = user.documents.find(d => d.documentType === docType);
  if (!doc) throw ApiError.notFound(`Document type ${docType} not found`);

  doc.status = 'VERIFIED';
  doc.rejectionReason = null;
  doc.verifiedAt = new Date();
  doc.verifiedBy = req.user._id;

  await user.save({ validateBeforeSave: false });

  // Send Push Notification
  await sendPushNotification(
    user.fcmToken,
    'Document Verified ✅',
    `Your ${docType} has been successfully verified by our team.`
  );

  ApiResponse.success(res, { user }, `${docType} verified successfully`);
});

const rejectDocument = catchAsync(async (req, res) => {
  const { id, docType } = req.params;
  const { reason } = req.body;

  if (!reason || !reason.trim()) throw ApiError.badRequest('Rejection reason is required');

  const user = await User.findOne({
    _id: id,
    role: { $in: [ROLES.CUSTOMER, ROLES.MECHANIC] },
  });

  if (!user) throw ApiError.notFound('User not found');
  if (!user.documents || user.documents.length === 0) throw ApiError.badRequest('User has no documents');

  const doc = user.documents.find(d => d.documentType === docType);
  if (!doc) throw ApiError.notFound(`Document type ${docType} not found`);

  doc.status = 'REJECTED';
  doc.rejectionReason = reason.trim();
  doc.verifiedAt = null;
  doc.verifiedBy = null;

  await user.save({ validateBeforeSave: false });

  // Send Push Notification
  await sendPushNotification(
    user.fcmToken,
    'Document Rejected ❌',
    `Your ${docType} was rejected. Reason: ${reason.trim()}`
  );

  ApiResponse.success(res, { user }, `${docType} rejected`);
});

module.exports = {
  getUsers,
  getUserById,
  updateUserStatus,
  updateMechanicDispatch,
  verifyDocument,
  rejectDocument,
};
