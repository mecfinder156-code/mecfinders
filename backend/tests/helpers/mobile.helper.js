'use strict';

const User = require('../../src/modules/users/models/user.model');
const Customer = require('../../src/modules/users/models/customer.model');
const Mechanic = require('../../src/modules/users/models/mechanic.model');
const VehicleCategory = require('../../src/modules/categories/category.model');
const City = require('../../src/modules/cities/city.model');
const Service = require('../../src/modules/services/service.model');
const MechanicService = require('../../src/modules/mechanicServices/mechanicService.model');
const PriceModel = require('../../src/modules/pricing/price.model');
const MechanicServicePricing = require('../../src/modules/mechanicServicePricing/mechanicServicePricing.model');
const Vehicle = require('../../src/modules/vehicles/vehicle.model');
const Address = require('../../src/modules/addresses/address.model');
const { ROLES } = require('../../src/constants/roles');
const { generateAccessToken } = require('../../src/utils/token');
const { computePricing: computeFlexiblePricing } = require('../../src/modules/pricing/pricing.util');

let counter = 0;
const uniq = () => `${Date.now()}${counter++}`;

const createCustomer = async (overrides = {}) => {
  return Customer.create({
    name: 'Test Customer',
    phone: `+9198${uniq()}`,
    role: ROLES.CUSTOMER,
    firebaseUid: `cust-${uniq()}`,
    isActive: true,
    ...overrides,
  });
};

const createMechanic = async (overrides = {}) => {
  return Mechanic.create({
    name: 'Test Mechanic',
    phone: `+9197${uniq()}`,
    role: ROLES.MECHANIC,
    firebaseUid: `mech-${uniq()}`,
    isActive: true,
    isOnline: true,
    ratingAverage: 4.5,
    ...overrides,
  });
};

const tokenFor = (user) => generateAccessToken(user);
const authHeader = (user) => ({ Authorization: `Bearer ${generateAccessToken(user)}` });

const computePricing = (servicePrice, gstPercentage, platformFee, charges = []) =>
  computeFlexiblePricing({ servicePrice, gstPercentage, platformFee, charges });

/**
 * Create a category + city + a priced Service (+ optional checklist / charges),
 * returning everything a booking needs.
 */
const setupService = async ({
  servicePrice = 1000,
  gstPercentage = 18,
  platformFee = 30,
  charges = [],
  checklist = [],
} = {}) => {
  const category = await VehicleCategory.create({ name: `Cat-${uniq()}`, emoji: '🚗' });
  const city = await City.create({ name: `City-${uniq()}` });
  const service = await Service.create({
    name: `Service-${uniq()}`,
    vehicleCategoryId: category._id,
    cityId: city._id,
    checklist,
    isActive: true,
  });
  const pricing = computePricing(servicePrice, gstPercentage, platformFee, charges);
  await PriceModel.create({ serviceId: service._id, ...pricing, isActive: true });
  return { category, city, service, pricing };
};

const setupMechanicService = async ({
  category,
  city,
  servicePrice = 800,
  gstPercentage = 18,
  platformFee = 20,
  charges = [],
  checklist = [],
} = {}) => {
  const cat = category || (await VehicleCategory.create({ name: `Cat-${uniq()}`, emoji: '🏍️' }));
  const c = city || (await City.create({ name: `City-${uniq()}` }));
  const service = await MechanicService.create({
    name: `MechSvc-${uniq()}`,
    vehicleCategoryId: cat._id,
    cityId: c._id,
    checklist,
    isActive: true,
  });
  const pricing = computePricing(servicePrice, gstPercentage, platformFee, charges);
  await MechanicServicePricing.create({ mechanicServiceId: service._id, ...pricing, isActive: true });
  return { service, pricing };
};

const createVehicle = async (customer, category, overrides = {}) => {
  return Vehicle.create({
    customerId: customer._id,
    vehicleCategoryId: category._id,
    make: 'Hyundai',
    model: 'Creta',
    registrationNumber: `DL01${uniq()}`,
    isDefault: true,
    ...overrides,
  });
};

const createAddress = async (customer, overrides = {}) => {
  return Address.create({
    customerId: customer._id,
    label: 'HOME',
    addressLine1: '123 Test Street',
    city: 'Delhi',
    state: 'Delhi',
    postalCode: '110001',
    isDefault: true,
    ...overrides,
  });
};

module.exports = {
  createCustomer,
  createMechanic,
  tokenFor,
  authHeader,
  setupService,
  setupMechanicService,
  createVehicle,
  createAddress,
  computePricing,
};
