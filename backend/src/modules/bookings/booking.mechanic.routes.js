'use strict';

const express = require('express');
const router = express.Router();
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { ROLES } = require('../../constants/roles');
const ctrl = require('./booking.mechanic.controller');

router.use(authenticate, authorize(ROLES.MECHANIC));

// Availability & location
router.patch('/availability', ctrl.setAvailability);
router.patch('/location', ctrl.updateLocation);

// Dispatch offers
router.get('/requests', ctrl.listRequests);
router.post('/requests/:bookingId/accept', ctrl.acceptRequest);
router.post('/requests/:bookingId/reject', ctrl.rejectRequest);

// Assigned bookings lifecycle
router.get('/bookings', ctrl.listBookings);
router.get('/bookings/:id', ctrl.getBooking);
router.post('/bookings/:id/arrive', ctrl.arrive);
router.post('/bookings/:id/start', ctrl.startWork);
router.post('/bookings/:id/additional-services', ctrl.addAdditionalService);
router.post('/bookings/:id/complete', ctrl.completeWork);
router.post('/bookings/:id/collect-cash', ctrl.collectCash);

// Checklist (itemId = BookingService line-item id)
router.patch('/booking-services/:itemId/checklist', ctrl.updateChecklistItem);

// Wallet & ratings
router.get('/wallet', ctrl.getWallet);
router.get('/wallet/transactions', ctrl.getWalletTransactions);
router.get('/ratings', ctrl.getRatings);

module.exports = router;
