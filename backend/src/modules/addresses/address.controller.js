'use strict';
const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const addressService = require('./address.service');

const addAddress = catchAsync(async (req, res) => {
  const address = await addressService.addAddress(req.user._id, req.body);
  ApiResponse.created(res, { address }, 'Address added successfully');
});

const getAddresses = catchAsync(async (req, res) => {
  const addresses = await addressService.getAddresses(req.user._id);
  ApiResponse.success(res, { addresses });
});

const getAddressById = catchAsync(async (req, res) => {
  const address = await addressService.getAddressById(req.params.id, req.user._id);
  ApiResponse.success(res, { address });
});

const updateAddress = catchAsync(async (req, res) => {
  const address = await addressService.updateAddress(req.params.id, req.user._id, req.body);
  ApiResponse.success(res, { address }, 'Address updated successfully');
});

const setDefaultAddress = catchAsync(async (req, res) => {
  const address = await addressService.setDefaultAddress(req.params.id, req.user._id);
  ApiResponse.success(res, { address }, 'Address set as default successfully');
});

const deleteAddress = catchAsync(async (req, res) => {
  await addressService.deleteAddress(req.params.id, req.user._id);
  ApiResponse.success(res, null, 'Address deleted successfully');
});

module.exports = {
  addAddress,
  getAddresses,
  getAddressById,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
};
