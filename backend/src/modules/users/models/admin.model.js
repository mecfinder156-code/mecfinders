'use strict';

const mongoose = require('mongoose');
const User = require('./user.model');

const adminSchema = new mongoose.Schema({
  permissions: {
    type: [String],
    default: [],
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
});

adminSchema.index({ createdBy: 1 });

const Admin = User.discriminator('admin', adminSchema);

module.exports = Admin;

