'use strict';

const mongoose = require('mongoose');

/**
 * Help & Support FAQ entry.
 *
 * Managed from the admin panel, consumed by both mobile apps. `audience` keeps
 * customer-facing and provider-facing help content separate even though they
 * live in one collection. `category` groups questions into accordion sections
 * on the client; `order` controls display order within a category.
 */
const faqSchema = new mongoose.Schema(
  {
    audience: {
      type: String,
      enum: ['customer', 'provider'],
      required: true,
      index: true,
    },
    category: { type: String, trim: true, default: 'General' },
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false }
);

// Client fetch: active FAQs for an audience, ordered.
faqSchema.index({ audience: 1, isActive: 1, category: 1, order: 1 });

module.exports = mongoose.model('Faq', faqSchema);
