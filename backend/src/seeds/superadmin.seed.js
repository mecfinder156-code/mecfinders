'use strict';

/**
 * SuperAdmin Seed Script
 *
 * Creates the initial SuperAdmin user from environment variables.
 * Idempotent — will not create a duplicate if one already exists.
 *
 * Usage:
 *   node src/seeds/superadmin.seed.js
 *   npm run seed:superadmin
 */

require('dotenv').config();

const mongoose = require('mongoose');
const config = require('../config');
const { connectDB, disconnectDB } = require('../config/database');
const logger = require('../utils/logger');
const { ROLES } = require('../constants/roles');

// Import models — the base User model and the SuperAdmin discriminator
require('../modules/users/models/user.model');
const SuperAdmin = require('../modules/users/models/superadmin.model');

const seedSuperAdmin = async () => {
  try {
    // Validate required seed config
    const { name, email, password } = config.superadmin;

    if (!name || !email || !password) {
      logger.error(
        'SuperAdmin seed failed: SUPERADMIN_NAME, SUPERADMIN_EMAIL, and SUPERADMIN_PASSWORD must be set in environment variables.'
      );
      process.exit(1);
    }

    // Connect to database
    await connectDB(config.mongodb.uri);

    // Check if a SuperAdmin already exists
    const existingSuperAdmin = await SuperAdmin.findOne({ role: ROLES.SUPERADMIN });

    if (existingSuperAdmin) {
      logger.info(`SuperAdmin already exists: ${existingSuperAdmin.email}`);
      await disconnectDB();
      process.exit(0);
    }

    // Create the SuperAdmin
    const superadmin = await SuperAdmin.create({
      name,
      email,
      password,
      role: ROLES.SUPERADMIN,
      isActive: true,
    });

    logger.info(`SuperAdmin created successfully: ${superadmin.email}`);
    await disconnectDB();
    process.exit(0);
  } catch (error) {
    logger.error(`SuperAdmin seed error: ${error.message}`);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seedSuperAdmin();

