'use strict';
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const vehicleService = require('./vehicle.service');

const addVehicle = catchAsync(async (req, res) => {
  const vehicle = await vehicleService.addVehicle(req.user._id, req.body);
  ApiResponse.created(res, { vehicle }, 'Vehicle added successfully');
});

const getVehicles = catchAsync(async (req, res) => {
  const vehicles = await vehicleService.getVehicles(req.user._id);
  ApiResponse.success(res, { vehicles });
});

const getVehicleById = catchAsync(async (req, res) => {
  const vehicle = await vehicleService.getVehicleById(req.params.id, req.user._id);
  ApiResponse.success(res, { vehicle });
});

const updateVehicle = catchAsync(async (req, res) => {
  const vehicle = await vehicleService.updateVehicle(req.params.id, req.user._id, req.body);
  ApiResponse.success(res, { vehicle }, 'Vehicle updated successfully');
});

const setDefaultVehicle = catchAsync(async (req, res) => {
  const vehicle = await vehicleService.setDefaultVehicle(req.params.id, req.user._id);
  ApiResponse.success(res, { vehicle }, 'Vehicle set as default successfully');
});

const deleteVehicle = catchAsync(async (req, res) => {
  await vehicleService.deleteVehicle(req.params.id, req.user._id);
  ApiResponse.success(res, null, 'Vehicle deleted successfully');
});

module.exports = {
  addVehicle,
  getVehicles,
  getVehicleById,
  updateVehicle,
  setDefaultVehicle,
  deleteVehicle,
};
