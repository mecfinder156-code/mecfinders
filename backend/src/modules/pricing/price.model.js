'use strict';
const mongoose = require('mongoose');

// A configurable extra charge / tax / discount an admin can add on top of the
// base service price. PERCENT is a percentage of the service price.
const chargeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    mode: { type: String, enum: ['PERCENT', 'FLAT'], default: 'FLAT' },
    value: { type: Number, required: true, min: 0 },
    isDiscount: { type: Boolean, default: false },
  },
  { _id: false }
);

// A single computed line in the price breakdown (rendered generically by apps).
const breakdownLineSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    kind: { type: String, enum: ['TAX', 'FEE', 'DISCOUNT'], default: 'FEE' },
    amount: { type: Number, required: true },
  },
  { _id: false }
);

const priceModelSchema = new mongoose.Schema(
  {
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true, unique: true },
    servicePrice: { type: Number, required: true, min: 0 },
    gstPercentage: { type: Number, required: true, min: 0, max: 100 },
    platformFee: { type: Number, required: true, min: 0 },

    // Optional admin-configurable extra taxes/fees/discounts.
    charges: { type: [chargeSchema], default: [] },

    // Calculated fields
    gstAmount: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    completePlatformFee: { type: Number, required: true },
    companyAmount: { type: Number, default: 0 }, // totalPrice - servicePrice
    breakdown: { type: [breakdownLineSchema], default: [] },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PriceModel', priceModelSchema);