'use strict';

const mongoose = require('mongoose');
const User = require('./user.model');

const superadminSchema = new mongoose.Schema({
  // SuperAdmin is identified by role alone.
  // All SuperAdmin powers are derived from the role check, not from a permissions array.
});

const SuperAdmin = User.discriminator('superadmin', superadminSchema);

module.exports = SuperAdmin;

