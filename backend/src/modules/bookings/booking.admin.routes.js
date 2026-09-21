'use strict';

const express = require('express');
const router = express.Router();
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { ROLES } = require('../../constants/roles');
const ctrl = require('./booking.admin.controller');

router.use(authenticate, authorize(ROLES.ADMIN, ROLES.SUPERADMIN));

router.get('/stats', ctrl.getStats);
router.get('/payments', ctrl.listPayments);
router.get('/ratings', ctrl.listRatings);
router.get('/mechanics/:mechanicId/wallet', ctrl.getMechanicWallet);
router.get('/', ctrl.listBookings);
router.get('/:id', ctrl.getBooking);

module.exports = router;
