'use strict';
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const categoryService = require('./category.service');

const createCategory = catchAsync(async (req, res) => {
  const category = await categoryService.createCategory(req.body);
  ApiResponse.created(res, { category }, 'Category created');
});

const getCategories = catchAsync(async (req, res) => {
  const categories = await categoryService.getCategories();
  ApiResponse.success(res, { categories });
});

const getCategoryById = catchAsync(async (req, res) => {
  const category = await categoryService.getCategoryById(req.params.id);
  ApiResponse.success(res, { category });
});

const updateCategory = catchAsync(async (req, res) => {
  const category = await categoryService.updateCategory(req.params.id, req.body);
  ApiResponse.success(res, { category }, 'Category updated');
});

const updateStatus = catchAsync(async (req, res) => {
  const category = await categoryService.updateStatus(req.params.id, req.body.isActive);
  ApiResponse.success(res, { category }, 'Category updated');
});

const deleteCategory = catchAsync(async (req, res) => {
  await categoryService.deleteCategory(req.params.id);
  ApiResponse.success(res, null, 'Category deleted successfully');
});

module.exports = { createCategory, getCategories, getCategoryById, updateCategory, updateStatus, deleteCategory };