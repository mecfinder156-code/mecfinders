'use strict';

const adminService = require('./admin.service');
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');

/**
 * POST /api/admin/admins
 * Create a new Admin user. SuperAdmin only.
 */
const createAdmin = catchAsync(async (req, res) => {
  const admin = await adminService.createAdmin(req.body, req.user._id);
  ApiResponse.created(res, { admin }, 'Admin created successfully');
});

/**
 * GET /api/admin/admins
 * List all Admin users with pagination. SuperAdmin only.
 */
const getAdmins = catchAsync(async (req, res) => {
  const { page, limit, search } = req.query;
  const { admins, pagination } = await adminService.getAdmins({
    page,
    limit,
    search,
  });
  ApiResponse.paginated(res, admins, pagination);
});

/**
 * GET /api/admin/admins/:id
 * Get a specific Admin by ID. SuperAdmin only.
 */
const getAdminById = catchAsync(async (req, res) => {
  const admin = await adminService.getAdminById(req.params.id);
  ApiResponse.success(res, { admin });
});

/**
 * PATCH /api/admin/admins/:id
 * Update Admin details. SuperAdmin only.
 */
const updateAdmin = catchAsync(async (req, res) => {
  const admin = await adminService.updateAdmin(req.params.id, req.body);
  ApiResponse.success(res, { admin }, 'Admin updated successfully');
});

/**
 * PATCH /api/admin/admins/:id/status
 * Activate or deactivate an Admin. SuperAdmin only.
 */
const updateAdminStatus = catchAsync(async (req, res) => {
  const { isActive } = req.body;
  const admin = await adminService.updateAdminStatus(req.params.id, isActive);
  const message = isActive ? 'Admin activated' : 'Admin deactivated';
  ApiResponse.success(res, { admin }, message);
});

/**
 * PATCH /api/admin/admins/:id/password
 * Reset an Admin's password. SuperAdmin only.
 */
const resetAdminPassword = catchAsync(async (req, res) => {
  const admin = await adminService.resetAdminPassword(
    req.params.id,
    req.body.password
  );
  ApiResponse.success(res, { admin }, 'Admin password reset successfully');
});

module.exports = {
  createAdmin,
  getAdmins,
  getAdminById,
  updateAdmin,
  updateAdminStatus,
  resetAdminPassword,
};

