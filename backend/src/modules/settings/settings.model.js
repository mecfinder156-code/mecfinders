'use strict';

const mongoose = require('mongoose');

/**
 * Platform-wide settings singleton. There is exactly ONE document (key
 * 'GLOBAL'); the service always get-or-creates it. Admin-tunable knobs that are
 * NOT per-booking pricing (that lives on PriceModel/MechanicServicePricing
 * charges) belong here.
 */
const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'GLOBAL', unique: true, index: true },

    // Maximum unpaid platform due (in rupees) a mechanic may carry before they
    // stop receiving new service requests. `0` disables the block. The due is
    // the negative portion of the mechanic's wallet balance (cash bookings owe
    // the company its GST + platform-fee share).
    maxDueThreshold: { type: Number, default: 1000, min: 0 },

    // Dispatch search radius (kilometres). An instant booking is only offered to
    // ONLINE mechanics within this distance of the service location, so a Delhi
    // request never reaches an Agra mechanic. Admin-tunable.
    dispatchRadiusKm: { type: Number, default: 10, min: 1, max: 500 },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlatformSettings', settingsSchema);
