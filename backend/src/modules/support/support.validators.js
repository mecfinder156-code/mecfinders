'use strict';

const { body, param } = require('express-validator');

const createFaqRules = [
  body('audience').isIn(['customer', 'provider']).withMessage('audience must be customer or provider'),
  body('question').notEmpty().withMessage('Question is required').trim(),
  body('answer').notEmpty().withMessage('Answer is required').trim(),
  body('category').optional().trim(),
  body('order').optional().isInt().withMessage('order must be a number'),
  body('isActive').optional().isBoolean(),
];

const updateFaqRules = [
  param('id').isMongoId().withMessage('Invalid FAQ id'),
  body('audience').optional().isIn(['customer', 'provider']),
  body('question').optional().notEmpty().withMessage('Question cannot be empty').trim(),
  body('answer').optional().notEmpty().withMessage('Answer cannot be empty').trim(),
  body('category').optional().trim(),
  body('order').optional().isInt().withMessage('order must be a number'),
  body('isActive').optional().isBoolean(),
];

const idParamRule = [param('id').isMongoId().withMessage('Invalid id')];

const replyRules = [
  param('id').isMongoId().withMessage('Invalid id'),
  body('message').notEmpty().withMessage('Message is required').trim(),
];

const statusRules = [
  param('id').isMongoId().withMessage('Invalid id'),
  body('status').isIn(['OPEN', 'ANSWERED', 'CLOSED']).withMessage('Invalid status'),
];

const createQueryRules = [
  body('subject').notEmpty().withMessage('Subject is required').trim().isLength({ max: 150 }),
  body('message').notEmpty().withMessage('Message is required').trim().isLength({ max: 2000 }),
  body('bookingId').optional().isMongoId().withMessage('Invalid bookingId'),
];

module.exports = {
  createFaqRules,
  updateFaqRules,
  idParamRule,
  replyRules,
  statusRules,
  createQueryRules,
};
