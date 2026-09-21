'use strict';

const express = require('express');
const router = express.Router();
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { ROLES } = require('../../constants/roles');
const ctrl = require('./booking.customer.controller');

// All customer booking routes require an authenticated customer.
router.use(authenticate, authorize(ROLES.CUSTOMER));

router.route('/').post(ctrl.createBooking).get(ctrl.listBookings);
router.get('/:id', ctrl.getBooking);
router.post('/:id/cancel', ctrl.cancelBooking);
router.post('/:id/additional-services/:itemId/respond', ctrl.respondAdditionalService);
router.post('/:id/pay', ctrl.initiatePayment);
router.post('/:id/pay/razorpay/verify', ctrl.verifyRazorpay);
router.post('/:id/rating', ctrl.submitRating);

module.exports = router;
