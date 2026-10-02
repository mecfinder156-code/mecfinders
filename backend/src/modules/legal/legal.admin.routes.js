'use strict';

const express = require('express');
const router = express.Router();
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const ApiError = require('../../utils/ApiError');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { ROLES } = require('../../constants/roles');
const legalService = require('./legal.service');

router.use(authenticate, authorize(ROLES.ADMIN, ROLES.SUPERADMIN));

// All 4 legal documents (customer/provider × privacy/terms), defaults filled in.
router.get(
  '/',
  catchAsync(async (req, res) => {
    const documents = await legalService.listAll();
    return ApiResponse.success(res, { documents });
  })
);

// Update one document. :audience = customer|provider, :type = privacy|terms.
router.put(
  '/:audience/:type',
  catchAsync(async (req, res) => {
    const audience = String(req.params.audience || '').toLowerCase();
    const type = String(req.params.type || '').toUpperCase();
    const { title, content } = req.body;
    if (typeof content !== 'string' || !content.trim()) {
      throw ApiError.badRequest('Content is required');
    }
    const document = await legalService.upsert(type, audience, { title, content }, req.user._id);
    return ApiResponse.success(res, { document }, 'Saved');
  })
);

module.exports = router;
