'use strict';

const authService = require('./auth.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

/**
 * POST /api/auth/login
 * Login with email and password (Admin/SuperAdmin).
 */
const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const user = await authService.login(email, password, res);
  ApiResponse.success(res, { user }, 'Login successful');
});

/**
 * POST /api/auth/refresh
 * Refresh the access token using the refresh token cookie.
 */
const refresh = catchAsync(async (req, res) => {
  // Browser (admin panel) sends the refresh token as an httpOnly cookie; the
  // native mobile apps have no cookie jar, so they send it in the body.
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
  const result = await authService.refresh(refreshToken, res);
  ApiResponse.success(res, result, 'Token refreshed');
});

/**
 * POST /api/auth/logout
 * Logout — clear tokens.
 */
const logout = catchAsync(async (req, res) => {
  await authService.logout(req.user.id, res);
  ApiResponse.success(res, null, 'Logged out successfully');
});

/**
 * GET /api/auth/me
 * Get the current authenticated user's profile.
 */
const getMe = catchAsync(async (req, res) => {
  const user = await authService.getMe(req.user.id);
  ApiResponse.success(res, { user });
});

module.exports = {
  login,
  refresh,
  logout,
  getMe,
};

