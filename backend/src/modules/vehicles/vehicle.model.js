'use strict';
const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    vehicleCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'VehicleCategory', required: true },
    make: { type: String, trim: true },
    model: { type: String, trim: true },
    registrationNumber: { type: String, required: true, trim: true },
    fuelType: { type: String, trim: true },
    year: { type: Number },
    nickname: { type: String, trim: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

vehicleSchema.index({ customerId: 1, registrationNumber: 1 }, { unique: true });

module.exports = mongoose.model('Vehicle', vehicleSchema);
