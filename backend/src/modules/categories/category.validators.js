'use strict';
const { body, param } = require('express-validator');

const createRules = [
  body('name').notEmpty().withMessage('Name is required').trim(),
  body('emoji').notEmpty().withMessage('Emoji is required').trim(),
];

const updateRules = [
  body('name').optional().notEmpty().withMessage('Name cannot be empty').trim(),
  body('emoji').optional().notEmpty().withMessage('Emoji cannot be empty').trim(),
];

const statusRules = [
  body('isActive').isBoolean().withMessage('isActive must be a boolean'),
];

module.exports = { createRules, updateRules, statusRules };