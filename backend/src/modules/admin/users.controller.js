'use strict';

const User = require('../users/models/user.model');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const { ROLES } = require('../../constants/roles');

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

  ApiResponse.success(res, { user, vehicles, addresses });
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

  const message = isActive ? 'User activated' : 'User deactivated';
  ApiResponse.success(res, { user }, message);
});

const admin = require('firebase-admin');

// Ensure firebase is initialized if credentials exist (Mock/Try-catch for now)
try {
  if (!admin.apps.length) {
    const serviceAccount = require('../../config/service-account.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
} catch (e) {
  console.log('Firebase Admin SDK not initialized: service-account.json missing');
}

const sendPushNotification = async (fcmToken, title, body) => {
  if (!fcmToken || !admin.apps.length) return;
  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      android: { priority: 'high' }
    });
    console.log(`Push notification sent to ${fcmToken}`);
  } catch (error) {
    console.error('Error sending push notification:', error.message);
  }
};

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
  verifyDocument,
  rejectDocument,
};
