'use strict';
const Address = require('./address.model');
const ApiError = require('../../utils/ApiError');
const mongoose = require('mongoose');

class AddressService {
  async addAddress(customerId, data) {
    if (data.isDefault) {
      await Address.updateMany({ customerId }, { isDefault: false });
    } else {
      const count = await Address.countDocuments({ customerId });
      if (count === 0) {
        data.isDefault = true;
      }
    }

    data.customerId = customerId;
    return Address.create(data);
  }

  async getAddresses(customerId) {
    return Address.find({ customerId })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean();
  }

  async getAddressById(id, customerId) {
    const address = await Address.findOne({ _id: id, customerId });
    if (!address) throw ApiError.notFound('Address not found');
    return address;
  }

  async updateAddress(id, customerId, data) {
    const address = await Address.findOne({ _id: id, customerId });
    if (!address) throw ApiError.notFound('Address not found');

    if (data.isDefault && !address.isDefault) {
      await Address.updateMany({ customerId, _id: { $ne: id } }, { isDefault: false });
    }

    Object.assign(address, data);
    await address.save();
    return address;
  }

  async setDefaultAddress(id, customerId) {
    const address = await Address.findOne({ _id: id, customerId });
    if (!address) throw ApiError.notFound('Address not found');

    if (address.isDefault) return address;

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await Address.updateMany({ customerId }, { isDefault: false }, { session });
      address.isDefault = true;
      await address.save({ session });
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
    
    return address;
  }

  async deleteAddress(id, customerId) {
    const address = await Address.findOneAndDelete({ _id: id, customerId });
    if (!address) throw ApiError.notFound('Address not found');

    if (address.isDefault) {
      const latestAddress = await Address.findOne({ customerId }).sort({ createdAt: -1 });
      if (latestAddress) {
        latestAddress.isDefault = true;
        await latestAddress.save();
      }
    }

    return address;
  }
}

module.exports = new AddressService();
