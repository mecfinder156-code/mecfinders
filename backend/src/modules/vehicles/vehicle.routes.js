'use strict';
const express = require('express');
const router = express.Router();
const vehicleController = require('./vehicle.controller');
const validate = require('../../middleware/validate');
const { createVehicleRules, updateVehicleRules } = require('./vehicle.validators');
const authenticate = require('../../middleware/authenticate');

router.use(authenticate);

router.route('/')
  .post(createVehicleRules, validate, vehicleController.addVehicle)
  .get(vehicleController.getVehicles);

router.route('/:id')
  .get(vehicleController.getVehicleById)
  .patch(updateVehicleRules, validate, vehicleController.updateVehicle)
  .delete(vehicleController.deleteVehicle);

router.patch('/:id/default', vehicleController.setDefaultVehicle);

module.exports = router;
