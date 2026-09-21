'use strict';
const Vehicle = require('./vehicle.model');
const ApiError = require('../../utils/ApiError');
const mongoose = require('mongoose');

class VehicleService {
  async addVehicle(customerId, data) {
    const existing = await Vehicle.findOne({ customerId, registrationNumber: data.registrationNumber });
    if (existing) {
      throw ApiError.conflict('A vehicle with this registration number already exists for this user.');
    }

    if (data.isDefault) {
      await Vehicle.updateMany({ customerId }, { isDefault: false });
    } else {
      const count = await Vehicle.countDocuments({ customerId });
      if (count === 0) {
        data.isDefault = true;
      }
    }

    data.customerId = customerId;
    return Vehicle.create(data);
  }

  async getVehicles(customerId) {
    return Vehicle.find({ customerId })
      .populate('vehicleCategoryId', 'name emoji')
      .sort({ isDefault: -1, createdAt: -1 })
      .lean();
  }

  async getVehicleById(id, customerId) {
    const vehicle = await Vehicle.findOne({ _id: id, customerId }).populate('vehicleCategoryId', 'name emoji');
    if (!vehicle) throw ApiError.notFound('Vehicle not found');
    return vehicle;
  }

  async updateVehicle(id, customerId, data) {
    const vehicle = await Vehicle.findOne({ _id: id, customerId });
    if (!vehicle) throw ApiError.notFound('Vehicle not found');

    if (data.registrationNumber && data.registrationNumber !== vehicle.registrationNumber) {
      const existing = await Vehicle.findOne({ customerId, registrationNumber: data.registrationNumber });
      if (existing) {
        throw ApiError.conflict('Another vehicle with this registration number already exists.');
      }
    }

    if (data.isDefault && !vehicle.isDefault) {
      await Vehicle.updateMany({ customerId, _id: { $ne: id } }, { isDefault: false });
    }

    Object.assign(vehicle, data);
    await vehicle.save();
    return vehicle;
  }

  async setDefaultVehicle(id, customerId) {
    const vehicle = await Vehicle.findOne({ _id: id, customerId });
    if (!vehicle) throw ApiError.notFound('Vehicle not found');

    if (vehicle.isDefault) return vehicle;

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await Vehicle.updateMany({ customerId }, { isDefault: false }, { session });
      vehicle.isDefault = true;
      await vehicle.save({ session });
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
    
    return vehicle;
  }

  async deleteVehicle(id, customerId) {
    const vehicle = await Vehicle.findOneAndDelete({ _id: id, customerId });
    if (!vehicle) throw ApiError.notFound('Vehicle not found');

    if (vehicle.isDefault) {
      const latestVehicle = await Vehicle.findOne({ customerId }).sort({ createdAt: -1 });
      if (latestVehicle) {
        latestVehicle.isDefault = true;
        await latestVehicle.save();
      }
    }

    return vehicle;
  }
}

module.exports = new VehicleService();
