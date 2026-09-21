'use strict';

const { body, param, query } = require('express-validator');

const createAdminRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/\d/)
    .withMessage('Password must contain at least one number'),

  body('permissions')
    .optional()
    .isArray()
    .withMessage('Permissions must be an array')
    .custom((arr) => arr.every((item) => typeof item === 'string'))
    .withMessage('Each permission must be a string'),
];

const updateAdminRules = [
  param('id')
    .isMongoId()
    .withMessage('Invalid admin ID'),

  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),

  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),

  body('permissions')
    .optional()
    .isArray()
    .withMessage('Permissions must be an array')
    .custom((arr) => arr.every((item) => typeof item === 'string'))
    .withMessage('Each permission must be a string'),
];

const updateAdminStatusRules = [
  param('id')
    .isMongoId()
    .withMessage('Invalid admin ID'),

  body('isActive')
    .notEmpty()
    .withMessage('isActive is required')
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

const resetAdminPasswordRules = [
  param('id')
    .isMongoId()
    .withMessage('Invalid admin ID'),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/\d/)
    .withMessage('Password must contain at least one number'),
];

const getAdminByIdRules = [
  param('id')
    .isMongoId()
    .withMessage('Invalid admin ID'),
];

const getAdminsRules = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search query too long'),
];

module.exports = {
  createAdminRules,
  updateAdminRules,
  updateAdminStatusRules,
  resetAdminPasswordRules,
  getAdminByIdRules,
  getAdminsRules,
};

