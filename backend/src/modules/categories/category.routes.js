'use strict';
const express = require('express');
const router = express.Router();
const categoryController = require('./category.controller');
const validate = require('../../middleware/validate');
const { createRules, updateRules, statusRules } = require('./category.validators');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { ROLES } = require('../../constants/roles');

// Public route for mobile app
router.get('/public', categoryController.getCategories);

router.use(authenticate, authorize(ROLES.ADMIN, ROLES.SUPERADMIN));

router.route('/')
  .post(createRules, validate, categoryController.createCategory)
  .get(categoryController.getCategories);

router.route('/:id')
  .get(categoryController.getCategoryById)
  .patch(updateRules, validate, categoryController.updateCategory)
  .delete(categoryController.deleteCategory);

router.patch('/:id/status', statusRules, validate, categoryController.updateStatus);

module.exports = router;