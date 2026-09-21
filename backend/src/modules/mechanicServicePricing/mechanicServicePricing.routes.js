'use strict';
const express = require('express');
const router = express.Router();
const mechanicServicePricingController = require('./mechanicServicePricing.controller');
const validate = require('../../middleware/validate');
const { pricingRules } = require('./mechanicServicePricing.validators');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { ROLES } = require('../../constants/roles');

router.use(authenticate, authorize(ROLES.ADMIN, ROLES.SUPERADMIN));

router.route('/service/:mechanicServiceId')
  .get(mechanicServicePricingController.getPricing)
  .put(pricingRules, validate, mechanicServicePricingController.upsertPricing);

module.exports = router;
