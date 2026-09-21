'use strict';
const Service = require('./service.model');
const Price = require('../pricing/price.model');
const ApiResponse = require('../../utils/ApiResponse');
const catchAsync = require('../../utils/catchAsync');
const cache = require('../../utils/cache');
const config = require('../../config');

exports.getPublicServices = catchAsync(async (req, res) => {
  const { cityId, vehicleCategoryId } = req.query;
  const filter = { isActive: true };
  if (cityId) filter.cityId = cityId;
  if (vehicleCategoryId) filter.vehicleCategoryId = vehicleCategoryId;

  // Services + their pricing are read on every browse but change only when an
  // admin edits them. Cache per (city, category) filter combination. The key
  // includes the filter so different browse contexts don't collide.
  const cacheKey = `mobile:services:${cityId || 'all'}:${vehicleCategoryId || 'all'}`;
  const enrichedServices = await cache.getOrSet(
    cacheKey,
    config.cache.referenceTtl,
    async () => {
      const services = await Service.find(filter)
        .populate('vehicleCategoryId', 'name emoji')
        .sort({ displayOrder: 1 })
        .lean();

      const serviceIds = services.map((s) => s._id);
      const pricings = await Price.find({
        serviceId: { $in: serviceIds },
        isActive: true,
      }).lean();

      const pricingMap = pricings.reduce((acc, p) => {
        acc[p.serviceId.toString()] = p;
        return acc;
      }, {});

      return services.map((s) => ({
        ...s,
        pricing: pricingMap[s._id.toString()] || null,
      }));
    }
  );

  return ApiResponse.success(res, { services: enrichedServices }, 'Services retrieved successfully');
});
