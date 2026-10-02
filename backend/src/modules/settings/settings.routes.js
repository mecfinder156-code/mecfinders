'use strict';

const express = require('express');
const router = express.Router();
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { ROLES } = require('../../constants/roles');
const settingsService = require('./settings.service');

router.use(authenticate, authorize(ROLES.SUPERADMIN, ROLES.ADMIN));

// Read the current platform settings.
router.get(
  '/',
  catchAsync(async (req, res) => {
    const settings = await settingsService.getSettings();
    return ApiResponse.success(res, { settings });
  })
);

// Update platform settings (currently the max-due threshold).
router.patch(
  '/',
  catchAsync(async (req, res) => {
    const { maxDueThreshold, dispatchRadiusKm } = req.body;
    if (maxDueThreshold !== undefined) {
      const v = Number(maxDueThreshold);
      if (!Number.isFinite(v) || v < 0) {
        throw ApiError.badRequest('maxDueThreshold must be a non-negative number');
      }
    }
    if (dispatchRadiusKm !== undefined) {
      const v = Number(dispatchRadiusKm);
      if (!Number.isFinite(v) || v < 1 || v > 500) {
        throw ApiError.badRequest('dispatchRadiusKm must be between 1 and 500 km');
      }
    }
    const settings = await settingsService.updateSettings({ maxDueThreshold, dispatchRadiusKm }, req.user._id);
    return ApiResponse.success(res, { settings }, 'Settings updated');
  })
);

module.exports = router;
