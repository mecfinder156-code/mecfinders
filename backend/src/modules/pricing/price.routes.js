'use strict';
const express = require('express');
const router = express.Router();
const priceController = require('./price.controller');
const validate = require('../../middleware/validate');
const { pricingRules } = require('./price.validators');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { ROLES } = require('../../constants/roles');

router.use(authenticate, authorize(ROLES.ADMIN, ROLES.SUPERADMIN));

router.route('/service/:serviceId')
  .get(priceController.getPricing)
  .put(pricingRules, validate, priceController.upsertPricing);

module.exports = router;