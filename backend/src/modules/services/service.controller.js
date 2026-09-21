'use strict';
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const serviceEntityService = require('./service.service');
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

const createService = catchAsync(async (req, res) => {
  const data = await processImages(req.body);
  const service = await serviceEntityService.createService(data);
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
  const data = await processImages(req.body);
  const service = await serviceEntityService.updateService(req.params.id, data);
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