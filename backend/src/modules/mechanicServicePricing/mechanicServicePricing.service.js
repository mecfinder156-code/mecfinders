'use strict';
const MechanicServicePricing = require('./mechanicServicePricing.model');
const MechanicService = require('../mechanicServices/mechanicService.model');
const ApiError = require('../../utils/ApiError');
const { computePricing } = require('../pricing/pricing.util');

class MechanicServicePricingService {
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

  async upsertPricing(mechanicServiceId, data) {
    const serviceExists = await MechanicService.exists({ _id: mechanicServiceId });
    if (!serviceExists) throw ApiError.notFound('Mechanic service not found');

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

    const pricing = await MechanicServicePricing.findOneAndUpdate(
      { mechanicServiceId },
      priceData,
      { new: true, upsert: true, runValidators: true }
    );

    return pricing;
  }

  async getPricingByMechanicServiceId(mechanicServiceId) {
    return MechanicServicePricing.findOne({ mechanicServiceId });
  }
}

module.exports = new MechanicServicePricingService();
