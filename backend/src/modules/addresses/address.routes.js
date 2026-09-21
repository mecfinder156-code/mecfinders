'use strict';
const express = require('express');
const router = express.Router();
const addressController = require('./address.controller');
const validate = require('../../middleware/validate');
const { createAddressRules, updateAddressRules } = require('./address.validators');
const authenticate = require('../../middleware/authenticate');

router.use(authenticate);

router.route('/')
  .post(createAddressRules, validate, addressController.addAddress)
  .get(addressController.getAddresses);

router.route('/:id')
  .get(addressController.getAddressById)
  .patch(updateAddressRules, validate, addressController.updateAddress)
  .delete(addressController.deleteAddress);

router.patch('/:id/default', addressController.setDefaultAddress);

module.exports = router;
