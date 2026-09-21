'use strict';
const mongoose = require('mongoose');

const mechanicServiceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    vehicleCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'VehicleCategory', required: true },
    cityId: { type: mongoose.Schema.Types.ObjectId, ref: 'City', required: true },
    displayOrder: { type: Number, default: 0 },
    image: { type: String, default: null },
    banner: { type: String, default: null },
    // Configurable checklist template, snapshotted onto the booking line item
    // when this service is added as an additional service. Additive.
    checklist: {
      type: [
        new mongoose.Schema(
          {
            label: { type: String, required: true, trim: true },
            required: { type: Boolean, default: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

mechanicServiceSchema.index({ name: 1, vehicleCategoryId: 1, cityId: 1 }, { unique: true });

module.exports = mongoose.model('MechanicService', mechanicServiceSchema);
