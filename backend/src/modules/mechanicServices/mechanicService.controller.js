'use strict';
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const mechanicServiceEntityService = require('./mechanicService.service');
const { uploadBase64 } = require('../../config/cloudinary');

const processImages = async (data) => {
  if (data.image && data.image.startsWith('data:')) {
    data.image = await uploadBase64(data.image, 'mecfinders/services/images');
  }
  if (data.banner && data.banner.startsWith('data:')) {
    data.banner = await uploadBase64(data.banner, 'mecfinders/services/banners');
  }
  return data;
};

const createMechanicService = catchAsync(async (req, res) => {
  const data = await processImages(req.body);
  const service = await mechanicServiceEntityService.createMechanicService(data);
  ApiResponse.created(res, { service }, 'Mechanic service created');
});

const getMechanicServices = catchAsync(async (req, res) => {
  const services = await mechanicServiceEntityService.getMechanicServices(req.query);
  ApiResponse.success(res, { services });
});

const getMechanicServiceById = catchAsync(async (req, res) => {
  const service = await mechanicServiceEntityService.getMechanicServiceById(req.params.id);
  ApiResponse.success(res, { service });
});

const updateMechanicService = catchAsync(async (req, res) => {
  const data = await processImages(req.body);
  const service = await mechanicServiceEntityService.updateMechanicService(req.params.id, data);
  ApiResponse.success(res, { service }, 'Mechanic service updated');
});

const updateStatus = catchAsync(async (req, res) => {
  const service = await mechanicServiceEntityService.updateStatus(req.params.id, req.body.isActive);
  ApiResponse.success(res, { service }, 'Mechanic service status updated');
});

const deleteMechanicService = catchAsync(async (req, res) => {
  await mechanicServiceEntityService.deleteMechanicService(req.params.id);
  ApiResponse.success(res, null, 'Mechanic service deleted');
});

module.exports = {
  createMechanicService,
  getMechanicServices,
  getMechanicServiceById,
  updateMechanicService,
  updateStatus,
  deleteMechanicService
};
