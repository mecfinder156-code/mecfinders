const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

const modules = {
  categories: {
    model: `
'use strict';
const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    emoji: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('VehicleCategory', categorySchema);
`,
    service: `
'use strict';
const Category = require('./category.model');
const ApiError = require('../../utils/ApiError');

class CategoryService {
  async createCategory(data) {
    const existing = await Category.findOne({ name: data.name });
    if (existing) throw ApiError.conflict('Category name already exists');
    return Category.create(data);
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
    return category;
  }

  async updateStatus(id, isActive) {
    const category = await Category.findByIdAndUpdate(id, { isActive }, { new: true });
    if (!category) throw ApiError.notFound('Category not found');
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
    return category;
  }
}
module.exports = new CategoryService();
`,
    controller: `
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
`,
    validators: `
'use strict';
const { body, param } = require('express-validator');

const createRules = [
  body('name').notEmpty().withMessage('Name is required').trim(),
  body('emoji').notEmpty().withMessage('Emoji is required').trim(),
];

const updateRules = [
  body('name').optional().notEmpty().withMessage('Name cannot be empty').trim(),
  body('emoji').optional().notEmpty().withMessage('Emoji cannot be empty').trim(),
];

const statusRules = [
  body('isActive').isBoolean().withMessage('isActive must be a boolean'),
];

module.exports = { createRules, updateRules, statusRules };
`,
    routes: `
'use strict';
const express = require('express');
const router = express.Router();
const categoryController = require('./category.controller');
const validate = require('../../middleware/validate');
const { createRules, updateRules, statusRules } = require('./category.validators');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { ROLES } = require('../../constants/roles');

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
`
  },
  cities: {
    model: `
'use strict';
const mongoose = require('mongoose');

const citySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('City', citySchema);
`,
    service: `
'use strict';
const City = require('./city.model');
const ApiError = require('../../utils/ApiError');

class CityService {
  async createCity(data) {
    const existing = await City.findOne({ name: data.name });
    if (existing) throw ApiError.conflict('City name already exists');
    return City.create(data);
  }

  async getCities(query = {}) {
    return City.find(query).sort({ createdAt: -1 });
  }

  async getCityById(id) {
    const city = await City.findById(id);
    if (!city) throw ApiError.notFound('City not found');
    return city;
  }

  async updateCity(id, data) {
    if (data.name) {
      const existing = await City.findOne({ name: data.name, _id: { $ne: id } });
      if (existing) throw ApiError.conflict('City name already exists');
    }
    const city = await City.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!city) throw ApiError.notFound('City not found');
    return city;
  }

  async updateStatus(id, isActive) {
    const city = await City.findByIdAndUpdate(id, { isActive }, { new: true });
    if (!city) throw ApiError.notFound('City not found');
    return city;
  }

  async deleteCity(id) {
    const Service = require('../services/service.model');
    const hasServices = await Service.exists({ cityId: id });
    if (hasServices) {
      throw ApiError.badRequest('Cannot delete city. Services are attached to it.');
    }
    const city = await City.findByIdAndDelete(id);
    if (!city) throw ApiError.notFound('City not found');
    return city;
  }
}
module.exports = new CityService();
`,
    controller: `
'use strict';
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const cityService = require('./city.service');

const createCity = catchAsync(async (req, res) => {
  const city = await cityService.createCity(req.body);
  ApiResponse.created(res, { city }, 'City created');
});

const getCities = catchAsync(async (req, res) => {
  const cities = await cityService.getCities();
  ApiResponse.success(res, { cities });
});

const getCityById = catchAsync(async (req, res) => {
  const city = await cityService.getCityById(req.params.id);
  ApiResponse.success(res, { city });
});

const updateCity = catchAsync(async (req, res) => {
  const city = await cityService.updateCity(req.params.id, req.body);
  ApiResponse.success(res, { city }, 'City updated');
});

const updateStatus = catchAsync(async (req, res) => {
  const city = await cityService.updateStatus(req.params.id, req.body.isActive);
  ApiResponse.success(res, { city }, 'City updated');
});

const deleteCity = catchAsync(async (req, res) => {
  await cityService.deleteCity(req.params.id);
  ApiResponse.success(res, null, 'City deleted successfully');
});

module.exports = { createCity, getCities, getCityById, updateCity, updateStatus, deleteCity };
`,
    validators: `
'use strict';
const { body } = require('express-validator');

const createRules = [
  body('name').notEmpty().withMessage('Name is required').trim(),
];

const updateRules = [
  body('name').optional().notEmpty().withMessage('Name cannot be empty').trim(),
];

const statusRules = [
  body('isActive').isBoolean().withMessage('isActive must be a boolean'),
];

module.exports = { createRules, updateRules, statusRules };
`,
    routes: `
'use strict';
const express = require('express');
const router = express.Router();
const cityController = require('./city.controller');
const validate = require('../../middleware/validate');
const { createRules, updateRules, statusRules } = require('./city.validators');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { ROLES } = require('../../constants/roles');

router.use(authenticate, authorize(ROLES.ADMIN, ROLES.SUPERADMIN));

router.route('/')
  .post(createRules, validate, cityController.createCity)
  .get(cityController.getCities);

router.route('/:id')
  .get(cityController.getCityById)
  .patch(updateRules, validate, cityController.updateCity)
  .delete(cityController.deleteCity);

router.patch('/:id/status', statusRules, validate, cityController.updateStatus);

module.exports = router;
`
  },
  services: {
    model: `
'use strict';
const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    vehicleCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'VehicleCategory', required: true },
    cityId: { type: mongoose.Schema.Types.ObjectId, ref: 'City', required: true },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

serviceSchema.index({ name: 1, vehicleCategoryId: 1, cityId: 1 }, { unique: true });

module.exports = mongoose.model('Service', serviceSchema);
`,
    service: `
'use strict';
const Service = require('./service.model');
const ApiError = require('../../utils/ApiError');
const Category = require('../categories/category.model');
const City = require('../cities/city.model');

class ServiceEntityService {
  async createService(data) {
    const catExists = await Category.exists({ _id: data.vehicleCategoryId });
    if (!catExists) throw ApiError.badRequest('Invalid vehicle category');
    
    const cityExists = await City.exists({ _id: data.cityId });
    if (!cityExists) throw ApiError.badRequest('Invalid city');

    const existing = await Service.findOne({ 
      name: data.name, 
      vehicleCategoryId: data.vehicleCategoryId, 
      cityId: data.cityId 
    });
    if (existing) throw ApiError.conflict('Service with this name already exists for this category in this city');

    return Service.create(data);
  }

  async getServices(query = {}) {
    const filter = {};
    if (query.categoryId) filter.vehicleCategoryId = query.categoryId;
    if (query.cityId) filter.cityId = query.cityId;
    if (query.isActive !== undefined) filter.isActive = query.isActive;

    return Service.find(filter)
      .populate('vehicleCategoryId', 'name emoji')
      .populate('cityId', 'name')
      .sort({ displayOrder: 1, createdAt: -1 });
  }

  async getServiceById(id) {
    const service = await Service.findById(id)
      .populate('vehicleCategoryId', 'name emoji')
      .populate('cityId', 'name');
    if (!service) throw ApiError.notFound('Service not found');
    return service;
  }

  async updateService(id, data) {
    if (data.name || data.vehicleCategoryId || data.cityId) {
      const current = await this.getServiceById(id);
      const name = data.name || current.name;
      const vehicleCategoryId = data.vehicleCategoryId || current.vehicleCategoryId;
      const cityId = data.cityId || current.cityId;
      
      const existing = await Service.findOne({ 
        name, vehicleCategoryId, cityId, _id: { $ne: id } 
      });
      if (existing) throw ApiError.conflict('Service name conflict in this city/category');
    }

    const service = await Service.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!service) throw ApiError.notFound('Service not found');
    return service;
  }

  async updateStatus(id, isActive) {
    const service = await Service.findByIdAndUpdate(id, { isActive }, { new: true });
    if (!service) throw ApiError.notFound('Service not found');
    return service;
  }

  async deleteService(id) {
    const PriceModel = require('../pricing/price.model');
    const hasPrice = await PriceModel.exists({ serviceId: id });
    if (hasPrice) {
      await PriceModel.deleteOne({ serviceId: id });
    }
    const service = await Service.findByIdAndDelete(id);
    if (!service) throw ApiError.notFound('Service not found');
    return service;
  }
}
module.exports = new ServiceEntityService();
`,
    controller: `
'use strict';
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const serviceEntityService = require('./service.service');

const createService = catchAsync(async (req, res) => {
  const service = await serviceEntityService.createService(req.body);
  ApiResponse.created(res, { service }, 'Service created');
});

const getServices = catchAsync(async (req, res) => {
  const services = await serviceEntityService.getServices(req.query);
  ApiResponse.success(res, { services });
});

const getServiceById = catchAsync(async (req, res) => {
  const service = await serviceEntityService.getServiceById(req.params.id);
  ApiResponse.success(res, { service });
});

const updateService = catchAsync(async (req, res) => {
  const service = await serviceEntityService.updateService(req.params.id, req.body);
  ApiResponse.success(res, { service }, 'Service updated');
});

const updateStatus = catchAsync(async (req, res) => {
  const service = await serviceEntityService.updateStatus(req.params.id, req.body.isActive);
  ApiResponse.success(res, { service }, 'Service updated');
});

const deleteService = catchAsync(async (req, res) => {
  await serviceEntityService.deleteService(req.params.id);
  ApiResponse.success(res, null, 'Service deleted successfully');
});

module.exports = { createService, getServices, getServiceById, updateService, updateStatus, deleteService };
`,
    validators: `
'use strict';
const { body, query } = require('express-validator');

const createRules = [
  body('name').notEmpty().withMessage('Name is required').trim(),
  body('vehicleCategoryId').isMongoId().withMessage('Valid Vehicle Category ID is required'),
  body('cityId').isMongoId().withMessage('Valid City ID is required'),
  body('description').optional().trim(),
  body('displayOrder').optional().isNumeric().toInt(),
];

const updateRules = [
  body('name').optional().notEmpty().withMessage('Name cannot be empty').trim(),
  body('vehicleCategoryId').optional().isMongoId().withMessage('Invalid Category ID'),
  body('cityId').optional().isMongoId().withMessage('Invalid City ID'),
  body('description').optional().trim(),
  body('displayOrder').optional().isNumeric().toInt(),
];

const statusRules = [
  body('isActive').isBoolean().withMessage('isActive must be a boolean'),
];

module.exports = { createRules, updateRules, statusRules };
`,
    routes: `
'use strict';
const express = require('express');
const router = express.Router();
const serviceController = require('./service.controller');
const validate = require('../../middleware/validate');
const { createRules, updateRules, statusRules } = require('./service.validators');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { ROLES } = require('../../constants/roles');

router.use(authenticate, authorize(ROLES.ADMIN, ROLES.SUPERADMIN));

router.route('/')
  .post(createRules, validate, serviceController.createService)
  .get(serviceController.getServices);

router.route('/:id')
  .get(serviceController.getServiceById)
  .patch(updateRules, validate, serviceController.updateService)
  .delete(serviceController.deleteService);

router.patch('/:id/status', statusRules, validate, serviceController.updateStatus);

module.exports = router;
`
  },
  pricing: {
    model: `
'use strict';
const mongoose = require('mongoose');

const priceModelSchema = new mongoose.Schema(
  {
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true, unique: true },
    servicePrice: { type: Number, required: true, min: 0 },
    gstPercentage: { type: Number, required: true, min: 0, max: 100 },
    platformFee: { type: Number, required: true, min: 0 },
    
    // Calculated fields
    gstAmount: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    completePlatformFee: { type: Number, required: true },
    
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PriceModel', priceModelSchema);
`,
    service: `
'use strict';
const PriceModel = require('./price.model');
const Service = require('../services/service.model');
const ApiError = require('../../utils/ApiError');

class PriceService {
  calculateDerivedValues(servicePrice, gstPercentage, platformFee) {
    const gstAmount = (servicePrice * gstPercentage) / 100;
    const totalPrice = servicePrice + gstAmount + platformFee;
    const completePlatformFee = totalPrice - servicePrice;
    
    return { gstAmount, totalPrice, completePlatformFee };
  }

  async upsertPricing(serviceId, data) {
    const serviceExists = await Service.exists({ _id: serviceId });
    if (!serviceExists) throw ApiError.notFound('Service not found');

    const derived = this.calculateDerivedValues(data.servicePrice, data.gstPercentage, data.platformFee);
    
    const priceData = {
      ...data,
      ...derived
    };

    const pricing = await PriceModel.findOneAndUpdate(
      { serviceId },
      priceData,
      { new: true, upsert: true, runValidators: true }
    );
    
    return pricing;
  }

  async getPricingByServiceId(serviceId) {
    return PriceModel.findOne({ serviceId });
  }
}
module.exports = new PriceService();
`,
    controller: `
'use strict';
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const priceService = require('./price.service');

const upsertPricing = catchAsync(async (req, res) => {
  const pricing = await priceService.upsertPricing(req.params.serviceId, req.body);
  ApiResponse.success(res, { pricing }, 'Pricing saved successfully');
});

const getPricing = catchAsync(async (req, res) => {
  const pricing = await priceService.getPricingByServiceId(req.params.serviceId);
  ApiResponse.success(res, { pricing });
});

module.exports = { upsertPricing, getPricing };
`,
    validators: `
'use strict';
const { body, param } = require('express-validator');

const pricingRules = [
  param('serviceId').isMongoId().withMessage('Valid Service ID is required'),
  body('servicePrice').isNumeric().withMessage('Service Price must be a number').isFloat({ min: 0 }),
  body('gstPercentage').isNumeric().withMessage('GST Percentage must be a number').isFloat({ min: 0, max: 100 }),
  body('platformFee').isNumeric().withMessage('Platform Fee must be a number').isFloat({ min: 0 }),
  body('gstAmount').not().exists().withMessage('Calculated fields cannot be set manually'),
  body('totalPrice').not().exists().withMessage('Calculated fields cannot be set manually'),
  body('completePlatformFee').not().exists().withMessage('Calculated fields cannot be set manually'),
];

module.exports = { pricingRules };
`,
    routes: `
'use strict';
const express = require('express');
const router = express.Router();
const priceController = require('./price.controller');
const validate = require('../../middleware/validate');
const { pricingRules } = require('./price.validators');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { ROLES } = require('../../constants/roles');

router.use(authenticate, authorize(ROLES.ADMIN, ROLES.SUPERADMIN));

router.route('/service/:serviceId')
  .get(priceController.getPricing)
  .put(pricingRules, validate, priceController.upsertPricing);

module.exports = router;
`
  }
};

for (const [moduleName, files] of Object.entries(modules)) {
  const modulePath = path.join(srcDir, 'modules', moduleName);
  fs.mkdirSync(modulePath, { recursive: true });
  
  const baseName = moduleName.endsWith('ies') ? moduleName.slice(0, -3) + 'y' : 
                   moduleName.endsWith('s') ? moduleName.slice(0, -1) : moduleName;
  
  const mappedName = moduleName === 'pricing' ? 'price' : baseName;

  fs.writeFileSync(path.join(modulePath, mappedName + '.model.js'), files.model.trim());
  fs.writeFileSync(path.join(modulePath, mappedName + '.service.js'), files.service.trim());
  fs.writeFileSync(path.join(modulePath, mappedName + '.controller.js'), files.controller.trim());
  fs.writeFileSync(path.join(modulePath, mappedName + '.validators.js'), files.validators.trim());
  fs.writeFileSync(path.join(modulePath, mappedName + '.routes.js'), files.routes.trim());
}

console.log('Backend modules generated successfully.');
