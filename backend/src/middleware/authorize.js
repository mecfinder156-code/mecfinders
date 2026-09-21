'use strict';

const ApiError = require('../utils/ApiError');

/**
 * Role-based authorization middleware.
 * Must be used after the `authenticate` middleware.
 *
 * Usage:
 *   authorize(ROLES.SUPERADMIN)
 *   authorize(ROLES.ADMIN, ROLES.SUPERADMIN)
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          'You do not have permission to perform this action'
        )
      );
    }

    next();
  };
};

module.exports = authorize;

