'use strict';

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage for profile images
const profileStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'mecfinders/profiles',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 500, height: 500, crop: 'fill', gravity: 'face' }],
  },
});

// Storage for documents (Aadhaar, PAN etc)
const documentStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'mecfinders/documents',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, quality: 'auto' }],
  },
});

const uploadProfile = multer({ storage: profileStorage, limits: { fileSize: 10 * 1024 * 1024 } });
const uploadDocument = multer({ storage: documentStorage, limits: { fileSize: 10 * 1024 * 1024 } });

/**
 * Upload a base64 data URL directly to Cloudinary (for backward compat with mobile).
 * Returns the secure URL.
 */
const uploadBase64 = async (base64DataUrl, folder = 'mecfinders/misc') => {
  const result = await cloudinary.uploader.upload(base64DataUrl, {
    folder,
    resource_type: 'image',
  });
  return result.secure_url;
};

module.exports = {
  cloudinary,
  uploadProfile,
  uploadDocument,
  uploadBase64,
};

