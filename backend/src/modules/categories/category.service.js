'use strict';
const Category = require('./category.model');
const ApiError = require('../../utils/ApiError');
const cache = require('../../utils/cache');

// Any category change can affect the cached category list AND the cached
// service lists (services embed category name/emoji), so clear both.
async function bustReferenceCache() {
  await cache.invalidate('mobile:categories:active');
  await cache.invalidatePrefix('mobile:services:');
}

class CategoryService {
  async createCategory(data) {
    const existing = await Category.findOne({ name: data.name });
    if (existing) throw ApiError.conflict('Category name already exists');
    const created = await Category.create(data);
    await bustReferenceCache();
    return created;
  }

  async getCategories(query = {}) {
    return Category.find(query).sort({ createdAt: -1 });
  }

  async getCategoryById(id) {
    const category = await Category.findById(id);
    if (!category) throw ApiError.notFound('Category not found');
    return category;
  }

  async updateCategory(id, data) {
    if (data.name) {
      const existing = await Category.findOne({ name: data.name, _id: { $ne: id } });
      if (existing) throw ApiError.conflict('Category name already exists');
    }
    const category = await Category.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!category) throw ApiError.notFound('Category not found');
    await bustReferenceCache();
    return category;
  }

  async updateStatus(id, isActive) {
    const category = await Category.findByIdAndUpdate(id, { isActive }, { new: true });
    if (!category) throw ApiError.notFound('Category not found');
    await bustReferenceCache();
    return category;
  }

  async deleteCategory(id) {
    const Service = require('../services/service.model');
    const hasServices = await Service.exists({ vehicleCategoryId: id });
    if (hasServices) {
      throw ApiError.badRequest('Cannot delete category. Services are attached to it.');
    }
    const category = await Category.findByIdAndDelete(id);
    if (!category) throw ApiError.notFound('Category not found');
    await bustReferenceCache();
    return category;
  }
}
module.exports = new CategoryService();