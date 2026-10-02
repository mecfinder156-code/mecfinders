'use strict';

const mongoose = require('mongoose');
const User = require('./user.model');

const customerSchema = new mongoose.Schema({
  // NOT unique on its own — the base User model's compound {firebaseUid, role}
  // unique index enforces uniqueness PER ROLE, so the same phone can be both a
  // customer and a mechanic. A field-level `unique: true` here would create a
  // collection-wide `firebaseUid_1` index and block that.
  firebaseUid: {
    type: String,
    sparse: true,
    default: null,
  },
  // Future: addresses, vehicle info, order history, etc.
});

const Customer = User.discriminator('customer', customerSchema);

module.exports = Customer;

