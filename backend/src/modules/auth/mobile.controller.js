'use strict';

const User = require('../users/models/user.model');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const config = require('../../config');
const { uploadBase64 } = require('../../config/cloudinary');
const {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  getCookieOptions,
  parseDurationToMs,
} = require('../../utils/token');

// Helper to set cookies
const setAuthCookies = (res, accessToken, refreshToken) => {
  const accessMaxAge = parseDurationToMs(config.jwt.accessExpiry);
  const refreshMaxAge = parseDurationToMs(config.jwt.refreshExpiry);

  res.cookie('accessToken', accessToken, getCookieOptions(accessMaxAge));
  res.cookie('refreshToken', refreshToken, getCookieOptions(refreshMaxAge));
};

const login = catchAsync(async (req, res) => {
  const { firebaseUid, phone, role } = req.body;

  const user = await User.findOne({ firebaseUid, role });

  if (user) {
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = hashToken(refreshToken);
    await user.save({ validateBeforeSave: false });

    setAuthCookies(res, accessToken, refreshToken);

    return ApiResponse.success(res, { exists: true, user, accessToken, refreshToken });
  }

  return ApiResponse.success(res, { exists: false });
});

const register = catchAsync(async (req, res) => {
  const { firebaseUid, phone, name, email, role, age, gender, profileImage } = req.body;

  // If profileImage is a base64 data URL, upload to Cloudinary
  let profileImageUrl = null;
  if (profileImage && profileImage.startsWith('data:')) {
    profileImageUrl = await uploadBase64(profileImage, 'mecfinders/profiles');
  } else if (req.file) {
    // If sent as multipart file
    profileImageUrl = req.file.path;
  }

  const user = await User.create({
    firebaseUid,
    phone,
    name,
    email,
    role,
    age: age ? parseInt(age) : null,
    gender: gender || null,
    profileImage: profileImageUrl,
  });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  user.refreshToken = hashToken(refreshToken);
  await user.save({ validateBeforeSave: false });

  setAuthCookies(res, accessToken, refreshToken);

  return ApiResponse.created(res, { user, accessToken, refreshToken });
});

const uploadDocument = catchAsync(async (req, res) => {
  const { documentType, documentUrl } = req.body;
  const user = req.user;

  if (!user) {
    throw ApiError.unauthorized('User not authenticated');
  }

  if (!documentType || !['AADHAAR', 'PAN'].includes(documentType)) {
    throw ApiError.badRequest('Invalid document type. Must be AADHAAR or PAN.');
  }

  // Determine the image URL
  let imageUrl = null;

  if (req.file) {
    // Multer file upload (multipart)
    imageUrl = req.file.path;
  } else if (documentUrl && documentUrl.startsWith('data:')) {
    // Base64 data URL — upload to Cloudinary
    imageUrl = await uploadBase64(documentUrl, 'mecfinders/documents');
  } else if (documentUrl) {
    // Already a URL
    imageUrl = documentUrl;
  } else {
    throw ApiError.badRequest('No document image provided.');
  }

  if (!user.documents) {
    user.documents = [];
  }

  // Check if document already exists
  const existingDocIndex = user.documents.findIndex(d => d.documentType === documentType);

  if (existingDocIndex >= 0) {
    user.documents[existingDocIndex].documentUrl = imageUrl;
    user.documents[existingDocIndex].status = 'PENDING';
    user.documents[existingDocIndex].rejectionReason = null;
    user.documents[existingDocIndex].submittedAt = new Date();
    user.documents[existingDocIndex].verifiedAt = null;
    user.documents[existingDocIndex].verifiedBy = null;
  } else {
    user.documents.push({
      documentType,
      documentUrl: imageUrl,
      status: 'PENDING',
      submittedAt: new Date(),
    });
  }

  await user.save({ validateBeforeSave: false });

  return ApiResponse.success(res, { user }, 'Document uploaded successfully');
});

const updateProfileImage = catchAsync(async (req, res) => {
  const { profileImage } = req.body;
  const user = req.user;

  if (!user) {
    throw ApiError.unauthorized('User not authenticated');
  }

  let imageUrl = null;

  if (req.file) {
    imageUrl = req.file.path;
  } else if (profileImage && profileImage.startsWith('data:')) {
    imageUrl = await uploadBase64(profileImage, 'mecfinders/profiles');
  } else if (profileImage) {
    imageUrl = profileImage;
  } else {
    throw ApiError.badRequest('No image provided.');
  }

  user.profileImage = imageUrl;
  await user.save({ validateBeforeSave: false });

  return ApiResponse.success(res, { user }, 'Profile image updated successfully');
});

const updateFcmToken = catchAsync(async (req, res) => {
  const { token } = req.body;
  const user = req.user;

  if (!user) {
    throw ApiError.unauthorized('User not authenticated');
  }

  user.fcmToken = token;
  await user.save({ validateBeforeSave: false });

  return ApiResponse.success(res, { user }, 'FCM token updated successfully');
});

// Update editable account details (name, email, age, gender). Phone is
// immutable here since it is bound to the Firebase identity.
const updateProfile = catchAsync(async (req, res) => {
  const user = req.user;

  if (!user) {
    throw ApiError.unauthorized('User not authenticated');
  }

  const { name, email, age, gender } = req.body;

  if (typeof name === 'string' && name.trim()) {
    user.name = name.trim();
  }
  if (typeof email === 'string') {
    user.email = email.trim();
  }
  if (age !== undefined && age !== null && age !== '') {
    user.age = parseInt(age, 10);
  }
  if (gender !== undefined) {
    user.gender = gender || null;
  }

  await user.save({ validateBeforeSave: false });

  return ApiResponse.success(res, { user }, 'Profile updated successfully');
});

module.exports = {
  login,
  register,
  uploadDocument,
  updateProfileImage,
  updateFcmToken,
  updateProfile,
};
