'use strict';

const express = require('express');
const router = express.Router();

const usersController = require('./users.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { ROLES } = require('../../constants/roles');

// Apply authentication and authorization to all routes in this file
router.use(authenticate);
router.use(authorize(ROLES.SUPERADMIN, ROLES.ADMIN));

router.get('/', usersController.getUsers);
router.get('/:id', usersController.getUserById);
router.patch('/:id/status', usersController.updateUserStatus);
router.patch('/:id/dispatch', usersController.updateMechanicDispatch);
router.patch('/:id/documents/:docType/verify', usersController.verifyDocument);
router.patch('/:id/documents/:docType/reject', usersController.rejectDocument);

module.exports = router;
