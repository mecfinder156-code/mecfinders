'use strict';

const mongoose = require('mongoose');
const User = require('./user.model');

const customerSchema = new mongoose.Schema({
  firebaseUid: {
    type: String,
    unique: true,
    sparse: true,
    default: null,
  },
  // Future: addresses, vehicle info, order history, etc.
});
// NOTE: `unique: true` above already creates the index; a separate
// schema.index({ firebaseUid: 1 }) would trigger a "Duplicate schema index"
// warning, so it is intentionally omitted.

const Customer = User.discriminator('customer', customerSchema);

module.exports = Customer;

