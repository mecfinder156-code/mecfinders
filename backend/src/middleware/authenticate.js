'use strict';

const User = require('../modules/users/models/user.model');
const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/token');
const userCache = require('../utils/userCache');

/**
 * Rehydrate a cached lean user object back into a Mongoose document so write
 * routes (profile/document updates) can still call `.save()`. Uses the role
 * discriminator model when known so sub-type paths round-trip correctly.
 */
function hydrateUser(obj) {
  const Model =
    (obj.role && User.discriminators && User.discriminators[obj.role]) || User;
  return Model.hydrate(obj);
}

/**
 * Authentication middleware.
 * Extracts the access token from the HTTP-only cookie or Bearer header, verifies
 * it, loads the user (via a short-TTL cache) and attaches it to req.user.
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

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw ApiError.unauthorized('Token expired');
      }
      throw ApiError.unauthorized('Invalid token');
    }

    // Cached lookup (Redis/in-memory) instead of a DB read on every request.
    const cached = await userCache.getCachedUser(decoded.id);
    if (!cached) {
      throw ApiError.unauthorized('User not found');
    }
    if (!cached.isActive) {
      throw ApiError.forbidden('Account has been deactivated');
    }

    req.user = hydrateUser(cached);
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = authenticate;
