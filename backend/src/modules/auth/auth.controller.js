'use strict';

const authService = require('./auth.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

/**
 * POST /api/auth/login
 * Login with email and password (Admin/SuperAdmin).
 */
const login = catchAsync(async (req, res) => {
  console.log('Login controller hit:', req.body);
  const { email, password } = req.body;
  const user = await authService.login(email, password, res);
  console.log('Login service success');
  ApiResponse.success(res, { user }, 'Login successful');
});

/**
 * POST /api/auth/refresh
 * Refresh the access token using the refresh token cookie.
 */
const refresh = catchAsync(async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  const user = await authService.refresh(refreshToken, res);
  ApiResponse.success(res, { user }, 'Token refreshed');
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

