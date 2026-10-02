'use strict';

const mongoose = require('mongoose');

/**
 * Admin-editable legal documents (Privacy Policy & Terms) per audience
 * (customer app / provider app). There are at most 4 documents — one per
 * (type, audience) pair. The mobile apps fetch and render these; admins edit
 * the content from the panel.
 */
const legalDocumentSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['PRIVACY', 'TERMS'], required: true },
    audience: { type: String, enum: ['customer', 'provider'], required: true },
    title: { type: String, trim: true, default: '' },
    content: { type: String, default: '' }, // plain text / markdown-ish, rendered as paragraphs
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

legalDocumentSchema.index({ type: 1, audience: 1 }, { unique: true });

module.exports = mongoose.model('LegalDocument', legalDocumentSchema);
