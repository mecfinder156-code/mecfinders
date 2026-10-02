'use strict';

const User = require('../users/models/user.model');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const config = require('../../config');
const firebase = require('../../config/firebase');
const userCache = require('../../utils/userCache');
const { uploadBase64 } = require('../../config/cloudinary');
const { ROLES } = require('../../constants/roles');
const {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  getCookieOptions,
  parseDurationToMs,
} = require('../../utils/token');

// Only these two roles may EVER authenticate through the mobile apps. admin /
// superadmin accounts are created solely via the superadmin-gated admin panel,
// so a mobile client can never self-provision a privileged account.
const MOBILE_ROLES = [ROLES.CUSTOMER, ROLES.MECHANIC];

const setAuthCookies = (res, accessToken, refreshToken) => {
  const accessMaxAge = parseDurationToMs(config.jwt.accessExpiry);
  const refreshMaxAge = parseDurationToMs(config.jwt.refreshExpiry);
  res.cookie('accessToken', accessToken, getCookieOptions(accessMaxAge));
  res.cookie('refreshToken', refreshToken, getCookieOptions(refreshMaxAge));
};

const issueTokens = async (res, user) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  user.refreshToken = hashToken(refreshToken);
  await user.save({ validateBeforeSave: false });
  setAuthCookies(res, accessToken, refreshToken);
  return { accessToken, refreshToken };
};

// Verify the Firebase ID token and return its decoded claims. Identity (uid,
// phone) ALWAYS comes from here — never from the request body — which is what
// makes mobile auth tamper-proof. Firebase errors map to clean API errors.
const verifyFirebase = async (idToken) => {
  try {
    return await firebase.verifyIdToken(idToken);
  } catch (err) {
    if (err.code === 'FIREBASE_UNCONFIGURED') {
      throw ApiError.internal('Authentication service is temporarily unavailable');
    }
    throw ApiError.unauthorized('Invalid or expired session. Please sign in again.');
  }
};

const normalizeRole = (role) => {
  const r = String(role || '').trim();
  if (!MOBILE_ROLES.includes(r)) {
    throw ApiError.badRequest('role must be customer or mechanic');
  }
  return r;
};
/**
 * POST /api/auth/mobile/login
 * Body: { idToken, role }. Verifies the Firebase token, then looks up the user
 * by the VERIFIED uid (+ role). Returns { exists, user?, accessToken? }.
 */
const login = catchAsync(async (req, res) => {
  const role = normalizeRole(req.body.role);
  const decoded = await verifyFirebase(req.body.idToken);
  const firebaseUid = decoded.uid;

  const user = await User.findOne({ firebaseUid, role });
  if (!user) {
    return ApiResponse.success(res, { exists: false });
  }
  if (!user.isActive) {
    throw ApiError.forbidden('Your account has been deactivated. Contact support.');
  }

  const { accessToken, refreshToken } = await issueTokens(res, user);
  return ApiResponse.success(res, { exists: true, user, accessToken, refreshToken });
});

/**
 * POST /api/auth/mobile/register
 * Body: { idToken, role, name, email?, age?, gender?, profileImage? }.
 * uid + phone come from the VERIFIED token; role is restricted to
 * customer/mechanic. Privileged roles can never be self-provisioned here.
 */
const register = catchAsync(async (req, res) => {
  const role = normalizeRole(req.body.role);
  const decoded = await verifyFirebase(req.body.idToken);
  const firebaseUid = decoded.uid;
  const phone = decoded.phone_number || null;

  const { name, email, age, gender, profileImage } = req.body;

  // One account per (uid, role). Reuse an existing one instead of a 500 on the
  // unique index, so a double-tapped "Create account" is idempotent.
  const existing = await User.findOne({ firebaseUid, role });
  if (existing) {
    if (!existing.isActive) throw ApiError.forbidden('Your account has been deactivated.');
    const t = await issueTokens(res, existing);
    return ApiResponse.success(res, { user: existing, ...t });
  }

  let profileImageUrl = null;
  if (typeof profileImage === 'string' && profileImage.startsWith('data:')) {
    profileImageUrl = await uploadBase64(profileImage, 'mecfinders/profiles');
  } else if (req.file) {
    profileImageUrl = req.file.path;
  } else if (typeof profileImage === 'string' && /^https?:\/\//.test(profileImage)) {
    profileImageUrl = profileImage;
  }

  const user = await User.create({
    firebaseUid,
    phone,
    name: typeof name === 'string' ? name.trim() : undefined,
    email: typeof email === 'string' && email.trim() ? email.trim() : undefined,
    role,
    age: age ? parseInt(age, 10) : null,
    gender: gender || null,
    profileImage: profileImageUrl,
  });

  const { accessToken, refreshToken } = await issueTokens(res, user);
  return ApiResponse.created(res, { user, accessToken, refreshToken });
});

const uploadDocument = catchAsync(async (req, res) => {
  const { documentType, documentUrl } = req.body;
  const user = req.user;
  if (!user) throw ApiError.unauthorized('User not authenticated');

  if (!documentType || !['AADHAAR', 'PAN'].includes(documentType)) {
    throw ApiError.badRequest('Invalid document type. Must be AADHAAR or PAN.');
  }

  let imageUrl = null;
  if (req.file) {
    imageUrl = req.file.path;
  } else if (typeof documentUrl === 'string' && documentUrl.startsWith('data:')) {
    imageUrl = await uploadBase64(documentUrl, 'mecfinders/documents');
  } else if (typeof documentUrl === 'string' && /^https?:\/\//.test(documentUrl)) {
    imageUrl = documentUrl;
  } else {
    throw ApiError.badRequest('No document image provided.');
  }

  if (!user.documents) user.documents = [];
  const existingDocIndex = user.documents.findIndex((d) => d.documentType === documentType);
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
  await userCache.invalidate(user._id);
  return ApiResponse.success(res, { user }, 'Document uploaded successfully');
});

const updateProfileImage = catchAsync(async (req, res) => {
  const { profileImage } = req.body;
  const user = req.user;
  if (!user) throw ApiError.unauthorized('User not authenticated');

  let imageUrl = null;
  if (req.file) {
    imageUrl = req.file.path;
  } else if (typeof profileImage === 'string' && profileImage.startsWith('data:')) {
    imageUrl = await uploadBase64(profileImage, 'mecfinders/profiles');
  } else if (typeof profileImage === 'string' && /^https?:\/\//.test(profileImage)) {
    imageUrl = profileImage;
  } else {
    throw ApiError.badRequest('No image provided.');
  }

  user.profileImage = imageUrl;
  await user.save({ validateBeforeSave: false });
  await userCache.invalidate(user._id);
  return ApiResponse.success(res, { user }, 'Profile image updated successfully');
});

const updateFcmToken = catchAsync(async (req, res) => {
  const { token } = req.body;
  const user = req.user;
  if (!user) throw ApiError.unauthorized('User not authenticated');
  if (typeof token !== 'string' || !token.trim()) {
    throw ApiError.badRequest('A valid FCM token is required');
  }

  user.fcmToken = token.trim();
  await user.save({ validateBeforeSave: false });
  await userCache.invalidate(user._id);
  return ApiResponse.success(res, { user }, 'FCM token updated successfully');
});

// Update editable account details (name, email, age, gender). Phone/role are
// immutable here — they are bound to the verified Firebase identity.
const updateProfile = catchAsync(async (req, res) => {
  const user = req.user;
  if (!user) throw ApiError.unauthorized('User not authenticated');

  const { name, email, age, gender } = req.body;
  if (typeof name === 'string' && name.trim()) user.name = name.trim();
  if (typeof email === 'string') user.email = email.trim() || undefined;
  if (age !== undefined && age !== null && age !== '') user.age = parseInt(age, 10);
  if (gender !== undefined) user.gender = gender || null;

  await user.save({ validateBeforeSave: false });
  await userCache.invalidate(user._id);
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
