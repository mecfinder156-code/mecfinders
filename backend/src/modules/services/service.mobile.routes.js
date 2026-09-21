'use strict';
const express = require('express');
const router = express.Router();
const serviceMobileController = require('./service.mobile.controller');

router.get('/', serviceMobileController.getPublicServices);

module.exports = router;
