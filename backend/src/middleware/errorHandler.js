'use strict';

const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');

/**
 * Global error handler middleware.
 * Converts all errors to a consistent API response format.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let error = err;

  // If it's not an ApiError, wrap it
  if (!(error instanceof ApiError)) {
    // Mongoose validation error
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((e) => ({
        field: e.path,
        message: e.message,
      }));
      error = ApiError.badRequest('Validation failed', errors);
    }
    // Mongoose duplicate key error
    else if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      error = ApiError.conflict(`Duplicate value for field: ${field}`);
    }
    // Mongoose cast error (invalid ObjectId)
    else if (error.name === 'CastError') {
      error = ApiError.badRequest(`Invalid ${error.path}: ${error.value}`);
    }
    // JWT errors
    else if (error.name === 'JsonWebTokenError') {
      error = ApiError.unauthorized('Invalid token');
    }
    else if (error.name === 'TokenExpiredError') {
      error = ApiError.unauthorized('Token expired');
    }
    // Unknown error
    else {
      error = ApiError.internal(error.message || 'Internal server error');
    }
  }

  // Log error (but not sensitive data)
  if (error.statusCode >= 500) {
    logger.error(`${error.statusCode} - ${error.message}`);
    if (process.env.NODE_ENV === 'development') {
      logger.error(err.stack);
    }
  }

  const isProd = process.env.NODE_ENV === 'production';

  const response = {
    success: false,
    // Never leak raw internal error text to clients in production — it can
    // reveal stack/driver/query details. Client (4xx) messages are safe to show.
    message:
      error.statusCode >= 500 && isProd ? 'Internal server error' : error.message,
  };

  if (error.errors && error.errors.length > 0) {
    response.errors = error.errors;
  }

  // Include stack trace only in development
  if (process.env.NODE_ENV === 'development' && error.statusCode >= 500) {
    response.stack = err.stack;
  }

  res.status(error.statusCode).json(response);
};

module.exports = errorHandler;
