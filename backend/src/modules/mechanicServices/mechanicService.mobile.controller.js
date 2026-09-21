'use strict';
const MechanicService = require('./mechanicService.model');
const MechanicServicePricing = require('../mechanicServicePricing/mechanicServicePricing.model');
const ApiResponse = require('../../utils/ApiResponse');
const catchAsync = require('../../utils/catchAsync');

exports.getPublicMechanicServices = catchAsync(async (req, res) => {
  const { cityId, vehicleCategoryId } = req.query;
  const filter = { isActive: true };
  if (cityId) filter.cityId = cityId;
  if (vehicleCategoryId) filter.vehicleCategoryId = vehicleCategoryId;

  const services = await MechanicService.find(filter)
    .populate('vehicleCategoryId', 'name emoji')
    .sort({ displayOrder: 1 })
    .lean();

  // Fetch pricing for all returned services
  const serviceIds = services.map(s => s._id);
  const pricings = await MechanicServicePricing.find({ mechanicServiceId: { $in: serviceIds }, isActive: true }).lean();

  // Map pricing to services
  const pricingMap = pricings.reduce((acc, p) => {
    acc[p.mechanicServiceId.toString()] = p;
    return acc;
  }, {});

  const enrichedServices = services.map(s => ({
    ...s,
    pricing: pricingMap[s._id.toString()] || null
  }));

  return ApiResponse.success(res, enrichedServices, 'Mechanic services retrieved successfully');
});
