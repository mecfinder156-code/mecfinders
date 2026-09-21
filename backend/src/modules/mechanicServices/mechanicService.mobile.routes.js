'use strict';
const express = require('express');
const router = express.Router();
const controller = require('./mechanicService.mobile.controller');

router.get('/', controller.getPublicMechanicServices);

module.exports = router;
