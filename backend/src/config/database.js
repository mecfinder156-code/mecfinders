'use strict';

const mongoose = require('mongoose');
const logger = require('../utils/logger');

const config = require('./index');

const connectDB = async (uri) => {
  try {
    // Pool + timeout tuning matters under concurrent load: maxPoolSize caps how
    // many DB ops run in parallel per process; the timeouts prevent a slow/dead
    // DB from hanging requests forever. See config.mongodb for env overrides.
    const conn = await mongoose.connect(uri, {
      maxPoolSize: config.mongodb.maxPoolSize,
      minPoolSize: config.mongodb.minPoolSize,
      serverSelectionTimeoutMS: config.mongodb.serverSelectionTimeoutMs,
      socketTimeoutMS: config.mongodb.socketTimeoutMs,
    });
    logger.info(
      `MongoDB connected: ${conn.connection.host} (pool ${config.mongodb.minPoolSize}-${config.mongodb.maxPoolSize})`
    );
    return conn;
  } catch (error) {
    logger.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected');
  } catch (error) {
    logger.error('MongoDB disconnection error:', error.message);
  }
};

module.exports = { connectDB, disconnectDB };
