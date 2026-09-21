'use strict';

const express = require('express');
const router = express.Router();
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { ROLES } = require('../../constants/roles');
const validate = require('../../middleware/validate');
const ctrl = require('./support.admin.controller');
const {
  createFaqRules,
  updateFaqRules,
  idParamRule,
  replyRules,
  statusRules,
} = require('./support.validators');

router.use(authenticate, authorize(ROLES.ADMIN, ROLES.SUPERADMIN));

// FAQs
router.route('/faqs').get(ctrl.listFaqs).post(createFaqRules, validate, ctrl.createFaq);
router
  .route('/faqs/:id')
  .patch(updateFaqRules, validate, ctrl.updateFaq)
  .delete(idParamRule, validate, ctrl.deleteFaq);

// Support queries (inbox)
router.get('/queries', ctrl.listQueries);
router.get('/queries/:id', idParamRule, validate, ctrl.getQuery);
router.post('/queries/:id/reply', replyRules, validate, ctrl.replyToQuery);
router.patch('/queries/:id/status', statusRules, validate, ctrl.updateQueryStatus);

module.exports = router;
