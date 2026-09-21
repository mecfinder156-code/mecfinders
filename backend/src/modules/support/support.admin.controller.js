'use strict';

const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const supportService = require('./support.service');

// --- FAQs ---

const listFaqs = catchAsync(async (req, res) => {
  const faqs = await supportService.listFaqs({ audience: req.query.audience });
  return ApiResponse.success(res, { faqs });
});

const createFaq = catchAsync(async (req, res) => {
  const faq = await supportService.createFaq(req.body);
  return ApiResponse.created(res, { faq }, 'FAQ created');
});

const updateFaq = catchAsync(async (req, res) => {
  const faq = await supportService.updateFaq(req.params.id, req.body);
  return ApiResponse.success(res, { faq }, 'FAQ updated');
});

const deleteFaq = catchAsync(async (req, res) => {
  await supportService.deleteFaq(req.params.id);
  return ApiResponse.success(res, null, 'FAQ deleted');
});

// --- Support queries ---

const listQueries = catchAsync(async (req, res) => {
  const { status, role, page, limit } = req.query;
  const result = await supportService.listQueries({
    status,
    role,
    page: parseInt(page, 10) || 1,
    limit: parseInt(limit, 10) || 20,
  });
  return ApiResponse.paginated(
    res,
    result.items,
    { page: result.page, limit: result.limit, total: result.total, pages: result.pages },
    'Support queries'
  );
});

const getQuery = catchAsync(async (req, res) => {
  const query = await supportService.getQuery(req.params.id);
  return ApiResponse.success(res, { query });
});

const replyToQuery = catchAsync(async (req, res) => {
  const query = await supportService.replyToQuery(req.params.id, req.user, req.body.message);
  return ApiResponse.success(res, { query }, 'Reply sent');
});

const updateQueryStatus = catchAsync(async (req, res) => {
  const query = await supportService.updateQueryStatus(req.params.id, req.body.status);
  return ApiResponse.success(res, { query }, 'Status updated');
});

module.exports = {
  listFaqs,
  createFaq,
  updateFaq,
  deleteFaq,
  listQueries,
  getQuery,
  replyToQuery,
  updateQueryStatus,
};
