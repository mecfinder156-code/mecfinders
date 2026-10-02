'use strict';

const { body } = require('express-validator');

const loginRules = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

// Mobile phone-OTP auth: the client sends the Firebase ID token, which the
// backend verifies. uid/phone are taken from the verified token, never the body.
const mobileLoginRules = [
  body('idToken').isString().trim().notEmpty().withMessage('idToken is required'),
  body('role').isIn(['customer', 'mechanic']).withMessage('role must be customer or mechanic'),
];

const mobileRegisterRules = [
  body('idToken').isString().trim().notEmpty().withMessage('idToken is required'),
  body('role').isIn(['customer', 'mechanic']).withMessage('role must be customer or mechanic'),
  body('name').isString().trim().isLength({ min: 2, max: 50 }).withMessage('Name must be 2–50 characters'),
  body('email').optional({ values: 'falsy' }).isEmail().withMessage('Invalid email'),
  body('age').optional({ values: 'falsy' }).isInt({ min: 16, max: 120 }).withMessage('Invalid age'),
  body('gender').optional({ values: 'falsy' }).isIn(['male', 'female', 'other']).withMessage('Invalid gender'),
];

module.exports = {
  loginRules,
  mobileLoginRules,
  mobileRegisterRules,
};
