'use strict';

const express = require('express');
const router = express.Router();
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const legalService = require('./legal.service');

/**
 * Public legal content for the mobile apps (privacy / terms). No auth — these
 * screens can be shown before login. `audience` query is customer|provider
 * (defaults to customer).
 *   GET /api/mobile/legal/privacy?audience=provider
 *   GET /api/mobile/legal/terms?audience=customer
 */
router.get(
  '/:type',
  catchAsync(async (req, res) => {
    const type = String(req.params.type || '').toUpperCase();
    const audience = String(req.query.audience || 'customer').toLowerCase();
    const document = await legalService.getDocument(type, audience);
    return ApiResponse.success(res, { document });
  })
);

module.exports = router;
