'use strict';
const Service = require('./service.model');
const ApiError = require('../../utils/ApiError');
const Category = require('../categories/category.model');
const City = require('../cities/city.model');
const cache = require('../../utils/cache');

// Clear the cached public service lists (keyed per city/category) after any
// change so the mobile apps see edits within the request, not after the TTL.
const bustServiceCache = () => cache.invalidatePrefix('mobile:services:');

class ServiceEntityService {
  async createService(data) {
    const catExists = await Category.exists({ _id: data.vehicleCategoryId });
    if (!catExists) throw ApiError.badRequest('Invalid vehicle category');

    const cityExists = await City.exists({ _id: data.cityId });
    if (!cityExists) throw ApiError.badRequest('Invalid city');

    const existing = await Service.findOne({
      name: data.name,
      vehicleCategoryId: data.vehicleCategoryId,
      cityId: data.cityId
    });
    if (existing) throw ApiError.conflict('Service with this name already exists for this category in this city');

    const created = await Service.create(data);
    await bustServiceCache();
    return created;
  }

  async getServices(query = {}) {
    const filter = {};
    if (query.categoryId) filter.vehicleCategoryId = query.categoryId;
    if (query.cityId) filter.cityId = query.cityId;
    if (query.isActive !== undefined) filter.isActive = query.isActive;

    const services = await Service.find(filter)
      .populate('vehicleCategoryId', 'name emoji')
      .populate('cityId', 'name')
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();
      
    const PriceModel = require('../pricing/price.model');
    const serviceIds = services.map(s => s._id);
    const prices = await PriceModel.find({ serviceId: { $in: serviceIds } }).lean();
    
    const priceMap = {};
    for (const p of prices) {
      priceMap[p.serviceId.toString()] = p;
    }
    
    for (const s of services) {
      s.pricing = priceMap[s._id.toString()] || null;
    }
    
    return services;
  }

  async getServiceById(id) {
    const service = await Service.findById(id)
      .populate('vehicleCategoryId', 'name emoji')
      .populate('cityId', 'name');
    if (!service) throw ApiError.notFound('Service not found');
    return service;
  }

  async updateService(id, data) {
    if (data.name || data.vehicleCategoryId || data.cityId) {
      const current = await this.getServiceById(id);
      const name = data.name || current.name;
      const vehicleCategoryId = data.vehicleCategoryId || current.vehicleCategoryId;
      const cityId = data.cityId || current.cityId;
      
      const existing = await Service.findOne({ 
        name, vehicleCategoryId, cityId, _id: { $ne: id } 
      });
      if (existing) throw ApiError.conflict('Service name conflict in this city/category');
    }

    const service = await Service.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!service) throw ApiError.notFound('Service not found');
    await bustServiceCache();
    return service;
  }

  async updateStatus(id, isActive) {
    const service = await Service.findByIdAndUpdate(id, { isActive }, { new: true });
    if (!service) throw ApiError.notFound('Service not found');
    await bustServiceCache();
    return service;
  }

  async deleteService(id) {
    const PriceModel = require('../pricing/price.model');
    const hasPrice = await PriceModel.exists({ serviceId: id });
    if (hasPrice) {
      await PriceModel.deleteOne({ serviceId: id });
    }
    const service = await Service.findByIdAndDelete(id);
    if (!service) throw ApiError.notFound('Service not found');
    await bustServiceCache();
    return service;
  }
}
module.exports = new ServiceEntityService();