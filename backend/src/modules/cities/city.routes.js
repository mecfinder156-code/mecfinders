'use strict';
const express = require('express');
const router = express.Router();
const cityController = require('./city.controller');
const validate = require('../../middleware/validate');
const { createRules, updateRules, statusRules } = require('./city.validators');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { ROLES } = require('../../constants/roles');

router.use(authenticate, authorize(ROLES.ADMIN, ROLES.SUPERADMIN));

router.route('/')
  .post(createRules, validate, cityController.createCity)
  .get(cityController.getCities);

router.route('/:id')
  .get(cityController.getCityById)
  .patch(updateRules, validate, cityController.updateCity)
  .delete(cityController.deleteCity);

router.patch('/:id/status', statusRules, validate, cityController.updateStatus);

module.exports = router;