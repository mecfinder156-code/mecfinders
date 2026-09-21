'use strict';
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const mechanicServicePricingService = require('./mechanicServicePricing.service');

const upsertPricing = catchAsync(async (req, res) => {
  const pricing = await mechanicServicePricingService.upsertPricing(req.params.mechanicServiceId, req.body);
  ApiResponse.success(res, { pricing }, 'Mechanic service pricing saved successfully');
});

const getPricing = catchAsync(async (req, res) => {
  const pricing = await mechanicServicePricingService.getPricingByMechanicServiceId(req.params.mechanicServiceId);
  ApiResponse.success(res, { pricing });
});

module.exports = { upsertPricing, getPricing };
