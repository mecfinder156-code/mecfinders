'use strict';
const mongoose = require('mongoose');

const chargeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    mode: { type: String, enum: ['PERCENT', 'FLAT'], default: 'FLAT' },
    value: { type: Number, required: true, min: 0 },
    isDiscount: { type: Boolean, default: false },
  },
  { _id: false }
);

const breakdownLineSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    kind: { type: String, enum: ['TAX', 'FEE', 'DISCOUNT'], default: 'FEE' },
    amount: { type: Number, required: true },
  },
  { _id: false }
);

const mechanicServicePricingSchema = new mongoose.Schema(
  {
    mechanicServiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'MechanicService', required: true, unique: true },
    servicePrice: { type: Number, required: true, min: 0 },
    gstPercentage: { type: Number, required: true, min: 0, max: 100 },
    platformFee: { type: Number, required: true, min: 0 },

    charges: { type: [chargeSchema], default: [] },

    // Calculated fields
    gstAmount: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    completePlatformFee: { type: Number, required: true },
    companyAmount: { type: Number, default: 0 },
    breakdown: { type: [breakdownLineSchema], default: [] },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MechanicServicePricing', mechanicServicePricingSchema);
