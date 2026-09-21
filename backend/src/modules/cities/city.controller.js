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