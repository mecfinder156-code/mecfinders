'use strict';

const express = require('express');
const router = express.Router();
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const paymentService = require('./payment.service');

/**
 * Razorpay webhook. Public endpoint (no JWT) but authenticated by verifying the
 * webhook signature over the RAW request body (captured in app.js via the
 * express.json `verify` hook). This is the server-trusted settlement path;
 * client callbacks are also verified separately.
 */
router.post(
  '/razorpay',
  catchAsync(async (req, res) => {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const result = await paymentService.handleWebhook(rawBody, signature);
    return ApiResponse.success(res, result, 'Webhook processed');
  })
);

module.exports = router;
