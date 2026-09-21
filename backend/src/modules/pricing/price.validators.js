'use strict';
const { body, param } = require('express-validator');

const pricingRules = [
  param('serviceId').isMongoId().withMessage('Valid Service ID is required'),
  body('servicePrice').isNumeric().withMessage('Service Price must be a number').isFloat({ min: 0 }),
  body('gstPercentage').isNumeric().withMessage('GST Percentage must be a number').isFloat({ min: 0, max: 100 }),
  body('platformFee').isNumeric().withMessage('Platform Fee must be a number').isFloat({ min: 0 }),
  // Optional admin-configurable extra taxes/fees/discounts.
  body('charges').optional().isArray().withMessage('charges must be an array'),
  body('charges.*.name').optional().isString().trim().notEmpty().withMessage('charge name is required'),
  body('charges.*.mode').optional().isIn(['PERCENT', 'FLAT']).withMessage('charge mode must be PERCENT or FLAT'),
  body('charges.*.value').optional().isFloat({ min: 0 }).withMessage('charge value must be >= 0'),
  body('charges.*.isDiscount').optional().isBoolean(),
  body('gstAmount').not().exists().withMessage('Calculated fields cannot be set manually'),
  body('totalPrice').not().exists().withMessage('Calculated fields cannot be set manually'),
  body('completePlatformFee').not().exists().withMessage('Calculated fields cannot be set manually'),
  body('companyAmount').not().exists().withMessage('Calculated fields cannot be set manually'),
  body('breakdown').not().exists().withMessage('Calculated fields cannot be set manually'),
];

module.exports = { pricingRules };