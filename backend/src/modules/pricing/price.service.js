'use strict';
const PriceModel = require('./price.model');
const Service = require('../services/service.model');
const ApiError = require('../../utils/ApiError');
const { computePricing } = require('./pricing.util');
const cache = require('../../utils/cache');

class PriceService {
  // Kept for backward compatibility; delegates to the shared flexible engine.
  calculateDerivedValues(servicePrice, gstPercentage, platformFee, charges = []) {
    const p = computePricing({ servicePrice, gstPercentage, platformFee, charges });
    return {
      gstAmount: p.gstAmount,
      totalPrice: p.totalPrice,
      completePlatformFee: p.completePlatformFee,
      companyAmount: p.companyAmount,
      breakdown: p.breakdown,
    };
  }

  async upsertPricing(serviceId, data) {
    const serviceExists = await Service.exists({ _id: serviceId });
    if (!serviceExists) throw ApiError.notFound('Service not found');

    const computed = computePricing({
      servicePrice: data.servicePrice,
      gstPercentage: data.gstPercentage,
      platformFee: data.platformFee,
      charges: data.charges || [],
    });

    const priceData = {
      servicePrice: computed.servicePrice,
      gstPercentage: computed.gstPercentage,
      platformFee: computed.platformFee,
      charges: computed.charges,
      gstAmount: computed.gstAmount,
      totalPrice: computed.totalPrice,
      completePlatformFee: computed.completePlatformFee,
      companyAmount: computed.companyAmount,
      breakdown: computed.breakdown,
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    };

    const pricing = await PriceModel.findOneAndUpdate(
      { serviceId },
      priceData,
      { new: true, upsert: true, runValidators: true }
    );

    // Public service lists embed pricing → clear them so the new price shows
    // immediately in the apps instead of after the cache TTL.
    await cache.invalidatePrefix('mobile:services:');

    return pricing;
  }

  async getPricingByServiceId(serviceId) {
    return PriceModel.findOne({ serviceId });
  }
}
module.exports = new PriceService();