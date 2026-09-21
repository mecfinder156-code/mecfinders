'use strict';
const express = require('express');
const router = express.Router();
const Category = require('./category.model');
const ApiResponse = require('../../utils/ApiResponse');
const catchAsync = require('../../utils/catchAsync');
const cache = require('../../utils/cache');
const config = require('../../config');

router.get('/', catchAsync(async (req, res) => {
  // Category list changes rarely but is fetched on nearly every app open —
  // cache it so a traffic spike doesn't translate 1:1 into DB reads.
  const categories = await cache.getOrSet(
    'mobile:categories:active',
    config.cache.referenceTtl,
    () => Category.find({ isActive: true }).select('name emoji').lean()
  );
  return ApiResponse.success(res, categories, 'Categories retrieved successfully');
}));

module.exports = router;
