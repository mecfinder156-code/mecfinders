'use strict';
const { body } = require('express-validator');

const createAddressRules = [
  body('label').optional().isIn(['HOME', 'WORK', 'OTHER']).withMessage('Invalid label'),
  body('addressLine1').notEmpty().withMessage('Address line 1 is required').trim(),
  body('addressLine2').optional().trim(),
  body('landmark').optional().trim(),
  body('city').notEmpty().withMessage('City is required').trim(),
  body('state').notEmpty().withMessage('State is required').trim(),
  body('postalCode').notEmpty().withMessage('Postal code is required').trim(),
  body('isDefault').optional().isBoolean(),
];

const updateAddressRules = [
  body('label').optional().isIn(['HOME', 'WORK', 'OTHER']).withMessage('Invalid label'),
  body('addressLine1').optional().notEmpty().withMessage('Address line 1 cannot be empty').trim(),
  body('addressLine2').optional().trim(),
  body('landmark').optional().trim(),
  body('city').optional().notEmpty().withMessage('City cannot be empty').trim(),
  body('state').optional().notEmpty().withMessage('State cannot be empty').trim(),
  body('postalCode').optional().notEmpty().withMessage('Postal code cannot be empty').trim(),
  body('isDefault').optional().isBoolean(),
];

module.exports = { createAddressRules, updateAddressRules };
