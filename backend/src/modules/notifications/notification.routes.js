'use strict';

const express = require('express');
const router = express.Router();
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { ROLES } = require('../../constants/roles');
const validate = require('../../middleware/validate');
const { param } = require('express-validator');
const ctrl = require('./notification.controller');

// Notifications belong to any mobile user (customer or mechanic).
router.use(authenticate, authorize(ROLES.CUSTOMER, ROLES.MECHANIC));

router.get('/', ctrl.list);
router.get('/unread-count', ctrl.unreadCount);
router.post('/read-all', ctrl.markAllRead);
router.post(
  '/:id/read',
  [param('id').isMongoId().withMessage('Invalid notification id')],
  validate,
  ctrl.markRead
);

module.exports = router;
