'use strict';
const City = require('./city.model');
const ApiError = require('../../utils/ApiError');

class CityService {
  async createCity(data) {
    const existing = await City.findOne({ name: data.name });
    if (existing) throw ApiError.conflict('City name already exists');
    return City.create(data);
  }

  async getCities(query = {}) {
    return City.find(query).sort({ createdAt: -1 });
  }

  async getCityById(id) {
    const city = await City.findById(id);
    if (!city) throw ApiError.notFound('City not found');
    return city;
  }

  async updateCity(id, data) {
    if (data.name) {
      const existing = await City.findOne({ name: data.name, _id: { $ne: id } });
      if (existing) throw ApiError.conflict('City name already exists');
    }
    const city = await City.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!city) throw ApiError.notFound('City not found');
    return city;
  }

  async updateStatus(id, isActive) {
    const city = await City.findByIdAndUpdate(id, { isActive }, { new: true });
    if (!city) throw ApiError.notFound('City not found');
    return city;
  }

  async deleteCity(id) {
    const Service = require('../services/service.model');
    const hasServices = await Service.exists({ cityId: id });
    if (hasServices) {
      throw ApiError.badRequest('Cannot delete city. Services are attached to it.');
    }
    const city = await City.findByIdAndDelete(id);
    if (!city) throw ApiError.notFound('City not found');
    return city;
  }
}
module.exports = new CityService();