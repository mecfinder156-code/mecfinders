'use strict';

const User = require('../users/models/user.model');
const ApiError = require('../../utils/ApiError');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
  getCookieOptions,
  parseDurationToMs,
} = require('../../utils/token');
const config = require('../../config');
const { ADMIN_ROLES } = require('../../constants/roles');
const userCache = require('../../utils/userCache');

class AuthService {
  /**
   * Login with email and password (Admin/SuperAdmin only).
   * Returns user data and sets auth cookies on the response.
   */
  async login(email, password, res) {
    // Find user by email, explicitly select password and refreshToken
    const user = await User.findOne({ email, role: { $in: ADMIN_ROLES } })
      .select('+password +refreshToken');

    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    // Check if account is active
    if (!user.isActive) {
      throw ApiError.forbidden('Account has been deactivated');
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Store hashed refresh token in DB
    user.refreshToken = hashToken(refreshToken);
    await user.save({ validateBeforeSave: false });

    // Set cookies
    this._setAuthCookies(res, accessToken, refreshToken);

    // Return user data (without password/refreshToken)
    return user.toJSON();
  }

  /**
   * Refresh the access token using a valid refresh token cookie.
   */
  async refresh(refreshTokenCookie, res) {
    if (!refreshTokenCookie) {
      throw ApiError.unauthorized('Refresh token is required');
    }

    // Verify the refresh token JWT
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshTokenCookie);
    } catch {
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }

    // Find user and check hashed refresh token
    const user = await User.findById(decoded.id).select('+refreshToken');

    if (!user || !user.isActive) {
      throw ApiError.unauthorized('User not found or deactivated');
    }

    const hashedToken = hashToken(refreshTokenCookie);
    if (user.refreshToken !== hashedToken) {
      // Possible token reuse — clear all tokens
      user.refreshToken = null;
      await user.save({ validateBeforeSave: false });
      throw ApiError.unauthorized('Invalid refresh token — please login again');
    }

    // Rotate tokens
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    user.refreshToken = hashToken(newRefreshToken);
    await user.save({ validateBeforeSave: false });

    // Set new cookies (used by the browser admin panel).
    this._setAuthCookies(res, newAccessToken, newRefreshToken);

    // Also return the rotated tokens in the body so the native mobile apps —
    // which use Bearer tokens from storage, not cookies — can persist them.
    return { user: user.toJSON(), accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  /**
   * Logout — clear cookies and remove refresh token from DB.
   */
  async logout(userId, res) {
    await User.findByIdAndUpdate(userId, { refreshToken: null });
    await userCache.invalidate(userId);

    // Clear cookies
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });
  }

  /**
   * Get the current authenticated user's profile.
   */
  async getMe(userId) {
    const user = await User.findById(userId);

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    return user.toJSON();
  }

  /**
   * Set HTTP-only auth cookies on the response.
   */
  _setAuthCookies(res, accessToken, refreshToken) {
    const accessMaxAge = parseDurationToMs(config.jwt.accessExpiry);
    const refreshMaxAge = parseDurationToMs(config.jwt.refreshExpiry);

    res.cookie('accessToken', accessToken, getCookieOptions(accessMaxAge));
    res.cookie('refreshToken', refreshToken, getCookieOptions(refreshMaxAge));
  }
}

module.exports = new AuthService();

