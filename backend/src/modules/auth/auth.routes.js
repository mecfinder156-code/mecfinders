'use strict';

const { Router } = require('express');
const authController = require('./auth.controller');
const mobileController = require('./mobile.controller');
const { loginRules } = require('./auth.validators');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const { uploadProfile, uploadDocument } = require('../../config/cloudinary');

const router = Router();

// Public routes
router.post('/login', loginRules, validate, authController.login);
router.post('/refresh', authController.refresh);

router.post('/mobile/login', mobileController.login);
router.post('/mobile/register', uploadProfile.single('profileImageFile'), mobileController.register);

// Protected routes
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);
router.post('/mobile/documents', authenticate, uploadDocument.single('documentFile'), mobileController.uploadDocument);
router.patch('/mobile/profile-image', authenticate, uploadProfile.single('profileImageFile'), mobileController.updateProfileImage);
router.patch('/mobile/fcm-token', authenticate, mobileController.updateFcmToken);
router.patch('/mobile/profile', authenticate, mobileController.updateProfile);

module.exports = router;
