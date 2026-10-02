'use strict';

const express = require('express');
const router = express.Router();
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { ROLES } = require('../../constants/roles');
const ctrl = require('./wallet.admin.controller');

router.use(authenticate, authorize(ROLES.ADMIN, ROLES.SUPERADMIN));

// Per-mechanic payout ledger: earned / paid / outstanding, settle outstanding.
router.get('/stats', ctrl.getStats);
router.get('/', ctrl.listWallets);
router.get('/:mechanicId', ctrl.getMechanic);
router.get('/:mechanicId/earnings', ctrl.listEarnings);
router.get('/:mechanicId/payouts', ctrl.listPayouts);
router.post('/:mechanicId/payouts', ctrl.createPayout);
router.post('/:mechanicId/clear-due', ctrl.clearDue);

module.exports = router;
