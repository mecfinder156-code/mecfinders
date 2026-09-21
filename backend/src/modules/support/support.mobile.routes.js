'use strict';

const express = require('express');
const router = express.Router();
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { ROLES } = require('../../constants/roles');
const validate = require('../../middleware/validate');
const ctrl = require('./support.mobile.controller');
const { createQueryRules, idParamRule } = require('./support.validators');

// Customer + mechanic apps both use the same Help & Support endpoints; the
// audience/role is derived server-side from the authenticated user.
router.use(authenticate, authorize(ROLES.CUSTOMER, ROLES.MECHANIC));

router.get('/faqs', ctrl.getFaqs);
router.route('/queries').get(ctrl.listMyQueries).post(createQueryRules, validate, ctrl.createQuery);
router.get('/queries/:id', idParamRule, validate, ctrl.getMyQuery);

module.exports = router;
