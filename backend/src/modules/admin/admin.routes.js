'use strict';

const { Router } = require('express');
const adminController = require('./admin.controller');
const {
  createAdminRules,
  updateAdminRules,
  updateAdminStatusRules,
  resetAdminPasswordRules,
  getAdminByIdRules,
  getAdminsRules,
} = require('./admin.validators');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { ROLES } = require('../../constants/roles');

const router = Router();

// All admin management routes require SuperAdmin access
router.use(authenticate, authorize(ROLES.SUPERADMIN));

router.post('/', createAdminRules, validate, adminController.createAdmin);
router.get('/', getAdminsRules, validate, adminController.getAdmins);
router.get('/:id', getAdminByIdRules, validate, adminController.getAdminById);
router.patch('/:id', updateAdminRules, validate, adminController.updateAdmin);
router.patch(
  '/:id/status',
  updateAdminStatusRules,
  validate,
  adminController.updateAdminStatus
);
router.patch(
  '/:id/password',
  resetAdminPasswordRules,
  validate,
  adminController.resetAdminPassword
);

module.exports = router;

