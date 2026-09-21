'use strict';
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const priceService = require('./price.service');

const upsertPricing = catchAsync(async (req, res) => {
  const pricing = await priceService.upsertPricing(req.params.serviceId, req.body);
  ApiResponse.success(res, { pricing }, 'Pricing saved successfully');
});

const getPricing = catchAsync(async (req, res) => {
  const pricing = await priceService.getPricingByServiceId(req.params.serviceId);
  ApiResponse.success(res, { pricing });
});

module.exports = { upsertPricing, getPricing };