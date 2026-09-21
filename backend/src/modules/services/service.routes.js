'use strict';
const express = require('express');
const router = express.Router();
const serviceController = require('./service.controller');
const validate = require('../../middleware/validate');
const { createRules, updateRules, statusRules } = require('./service.validators');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { ROLES } = require('../../constants/roles');

router.use(authenticate, authorize(ROLES.ADMIN, ROLES.SUPERADMIN));

router.route('/')
  .post(createRules, validate, serviceController.createService)
  .get(serviceController.getServices);

router.route('/:id')
  .get(serviceController.getServiceById)
  .patch(updateRules, validate, serviceController.updateService)
  .delete(serviceController.deleteService);

router.patch('/:id/status', statusRules, validate, serviceController.updateStatus);

module.exports = router;