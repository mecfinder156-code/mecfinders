'use strict';

const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const adminWallet = require('./adminWallet.service');

const listWallets = catchAsync(async (req, res) => {
  const { q, page, limit } = req.query;
  const result = await adminWallet.listMechanicWallets({ q, page, limit });
  return ApiResponse.paginated(res, result.items, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    pages: result.pages,
  });
});

const getStats = catchAsync(async (req, res) => {
  const stats = await adminWallet.getPlatformStats();
  return ApiResponse.success(res, stats);
});

const getMechanic = catchAsync(async (req, res) => {
  const { from, to, status, page, limit } = req.query;
  const data = await adminWallet.getMechanicDetail(req.params.mechanicId, { from, to, status, page, limit });
  return ApiResponse.success(res, data);
});

const listEarnings = catchAsync(async (req, res) => {
  const { from, to, status, page, limit } = req.query;
  const result = await adminWallet.listEarnings(req.params.mechanicId, { from, to, status, page, limit });
  return ApiResponse.paginated(res, result.items, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    pages: result.pages,
  });
});

const listPayouts = catchAsync(async (req, res) => {
  const { page, limit } = req.query;
  const result = await adminWallet.listPayouts(req.params.mechanicId, { page, limit });
  return ApiResponse.paginated(res, result.items, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    pages: result.pages,
  });
});

const createPayout = catchAsync(async (req, res) => {
  const { earningIds, settleAll, method, reference, note } = req.body;
  const data = await adminWallet.createPayout(
    req.params.mechanicId,
    { earningIds, settleAll, method, reference, note },
    req.user
  );
  return ApiResponse.created(res, data, 'Payout recorded');
});

const clearDue = catchAsync(async (req, res) => {
  const { amount, method, reference, note } = req.body;
  const data = await adminWallet.createDueClearance(
    req.params.mechanicId,
    { amount, method, reference, note },
    req.user
  );
  return ApiResponse.created(res, data, 'Due updated');
});

module.exports = {
  listWallets,
  getStats,
  getMechanic,
  listEarnings,
  listPayouts,
  createPayout,
  clearDue,
};
