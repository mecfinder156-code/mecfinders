'use strict';
const express = require('express');
const router = express.Router();
const mechanicServiceController = require('./mechanicService.controller');
const validate = require('../../middleware/validate');
const { createRules, updateRules, statusRules } = require('./mechanicService.validators');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { ROLES } = require('../../constants/roles');

router.use(authenticate, authorize(ROLES.ADMIN, ROLES.SUPERADMIN));

router.route('/')
  .post(createRules, validate, mechanicServiceController.createMechanicService)
  .get(mechanicServiceController.getMechanicServices);

router.route('/:id')
  .get(mechanicServiceController.getMechanicServiceById)
  .patch(updateRules, validate, mechanicServiceController.updateMechanicService)
  .delete(mechanicServiceController.deleteMechanicService);

router.patch('/:id/status', statusRules, validate, mechanicServiceController.updateStatus);

module.exports = router;
