'use strict';
const { body } = require('express-validator');

const createRules = [
  body('name').notEmpty().withMessage('Name is required').trim(),
  body('vehicleCategoryId').isMongoId().withMessage('Valid Vehicle Category ID is required'),
  body('cityId').isMongoId().withMessage('Valid City ID is required'),
  body('description').optional().trim(),
  body('image').optional().isString(),
  body('banner').optional().isString(),
  body('displayOrder').optional().isNumeric().toInt(),
];

const updateRules = [
  body('name').optional().notEmpty().withMessage('Name cannot be empty').trim(),
  body('vehicleCategoryId').optional().isMongoId().withMessage('Invalid Category ID'),
  body('cityId').optional().isMongoId().withMessage('Invalid City ID'),
  body('description').optional().trim(),
  body('image').optional().isString(),
  body('banner').optional().isString(),
  body('displayOrder').optional().isNumeric().toInt(),
];

const statusRules = [
  body('isActive').isBoolean().withMessage('isActive must be a boolean'),
];

module.exports = { createRules, updateRules, statusRules };
