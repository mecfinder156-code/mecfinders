'use strict';

const User = require('../modules/users/models/user.model');
const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/token');

/**
 * Authentication middleware.
 * Extracts the access token from HTTP-only cookie, verifies it,
 * and attaches the user to req.user.
 */
const authenticate = async (req, res, next) => {
  try {
    let token = req.cookies.accessToken;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw ApiError.unauthorized('Authentication required');
    }

    // Verify token
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw ApiError.unauthorized('Token expired');
      }
      throw ApiError.unauthorized('Invalid token');
    }

    // Find user
    const user = await User.findById(decoded.id);

    if (!user) {
      throw ApiError.unauthorized('User not found');
    }

    if (!user.isActive) {
      throw ApiError.forbidden('Account has been deactivated');
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = authenticate;

