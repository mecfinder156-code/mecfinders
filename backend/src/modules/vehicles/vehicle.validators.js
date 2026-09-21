'use strict';
const { body } = require('express-validator');

const createVehicleRules = [
  body('vehicleCategoryId').isMongoId().withMessage('Valid Vehicle Category ID is required'),
  body('registrationNumber').notEmpty().withMessage('Registration number is required').trim(),
  body('make').optional().isString().trim(),
  body('model').optional().isString().trim(),
  body('fuelType').optional().isString().trim(),
  body('year').optional().isNumeric().toInt(),
  body('nickname').optional().isString().trim(),
  body('isDefault').optional().isBoolean(),
];

const updateVehicleRules = [
  body('vehicleCategoryId').optional().isMongoId().withMessage('Invalid Vehicle Category ID'),
  body('registrationNumber').optional().notEmpty().withMessage('Registration number cannot be empty').trim(),
  body('make').optional().isString().trim(),
  body('model').optional().isString().trim(),
  body('fuelType').optional().isString().trim(),
  body('year').optional().isNumeric().toInt(),
  body('nickname').optional().isString().trim(),
  body('isDefault').optional().isBoolean(),
];

module.exports = { createVehicleRules, updateVehicleRules };
