'use strict';
const { body } = require('express-validator');

const createRules = [
  body('name').notEmpty().withMessage('Name is required').trim(),
];

const updateRules = [
  body('name').optional().notEmpty().withMessage('Name cannot be empty').trim(),
];

const statusRules = [
  body('isActive').isBoolean().withMessage('isActive must be a boolean'),
];

module.exports = { createRules, updateRules, statusRules };