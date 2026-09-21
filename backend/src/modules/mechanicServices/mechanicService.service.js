'use strict';
const MechanicService = require('./mechanicService.model');
const ApiError = require('../../utils/ApiError');
const Category = require('../categories/category.model');
const City = require('../cities/city.model');

class MechanicServiceEntityService {
  async createMechanicService(data) {
    const catExists = await Category.exists({ _id: data.vehicleCategoryId });
    if (!catExists) throw ApiError.badRequest('Invalid vehicle category');
    
    const cityExists = await City.exists({ _id: data.cityId });
    if (!cityExists) throw ApiError.badRequest('Invalid city');

    const existing = await MechanicService.findOne({ 
      name: data.name, 
      vehicleCategoryId: data.vehicleCategoryId, 
      cityId: data.cityId 
    });
    if (existing) throw ApiError.conflict('Mechanic service with this name already exists for this category in this city');

    return MechanicService.create(data);
  }

  async getMechanicServices(query = {}) {
    const filter = {};
    if (query.categoryId) filter.vehicleCategoryId = query.categoryId;
    if (query.cityId) filter.cityId = query.cityId;
    if (query.isActive !== undefined) filter.isActive = query.isActive;

    const services = await MechanicService.find(filter)
      .populate('vehicleCategoryId', 'name emoji')
      .populate('cityId', 'name')
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();
      
    // Optionally fetch pricing for these mechanic services, but avoiding direct cyclic requires if not needed
    // Assuming standard practice as in services
    const MechanicServicePricingModel = require('../mechanicServicePricing/mechanicServicePricing.model');
    const serviceIds = services.map(s => s._id);
    const prices = await MechanicServicePricingModel.find({ mechanicServiceId: { $in: serviceIds } }).lean();
    
    const priceMap = {};
    for (const p of prices) {
      priceMap[p.mechanicServiceId.toString()] = p;
    }
    
    for (const s of services) {
      s.pricing = priceMap[s._id.toString()] || null;
    }
    
    return services;
  }

  async getMechanicServiceById(id) {
    const service = await MechanicService.findById(id)
      .populate('vehicleCategoryId', 'name emoji')
      .populate('cityId', 'name');
    if (!service) throw ApiError.notFound('Mechanic service not found');
    return service;
  }

  async updateMechanicService(id, data) {
    if (data.name || data.vehicleCategoryId || data.cityId) {
      const current = await this.getMechanicServiceById(id);
      const name = data.name || current.name;
      const vehicleCategoryId = data.vehicleCategoryId || current.vehicleCategoryId;
      const cityId = data.cityId || current.cityId;
      
      const existing = await MechanicService.findOne({ 
        name, vehicleCategoryId, cityId, _id: { $ne: id } 
      });
      if (existing) throw ApiError.conflict('Mechanic service name conflict in this city/category');
    }

    const service = await MechanicService.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!service) throw ApiError.notFound('Mechanic service not found');
    return service;
  }

  async updateStatus(id, isActive) {
    const service = await MechanicService.findByIdAndUpdate(id, { isActive }, { new: true });
    if (!service) throw ApiError.notFound('Mechanic service not found');
    return service;
  }

  async deleteMechanicService(id) {
    const MechanicServicePricingModel = require('../mechanicServicePricing/mechanicServicePricing.model');
    const hasPrice = await MechanicServicePricingModel.exists({ mechanicServiceId: id });
    if (hasPrice) {
      await MechanicServicePricingModel.deleteOne({ mechanicServiceId: id });
    }
    const service = await MechanicService.findByIdAndDelete(id);
    if (!service) throw ApiError.notFound('Mechanic service not found');
    return service;
  }
}

module.exports = new MechanicServiceEntityService();
