'use strict';

const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const supportService = require('./support.service');
const { ROLES } = require('../../constants/roles');

/**
 * Map a mobile user's role to the FAQ audience. The provider app authenticates
 * as a `mechanic`; its help content is the `provider` audience.
 */
function audienceFor(user) {
  return user.role === ROLES.MECHANIC ? 'provider' : 'customer';
}

const getFaqs = catchAsync(async (req, res) => {
  const audience = audienceFor(req.user);
  const faqs = await supportService.getPublicFaqs(audience);
  return ApiResponse.success(res, { audience, faqs });
});

const createQuery = catchAsync(async (req, res) => {
  const query = await supportService.createQuery(req.user, {
    subject: req.body.subject,
    message: req.body.message,
    bookingId: req.body.bookingId,
  });
  return ApiResponse.created(res, { query }, 'Your query has been submitted');
});

const listMyQueries = catchAsync(async (req, res) => {
  const { page, limit } = req.query;
  const result = await supportService.listUserQueries(req.user._id, {
    page: parseInt(page, 10) || 1,
    limit: parseInt(limit, 10) || 20,
  });
  return ApiResponse.paginated(res, result.items, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    pages: result.pages,
  });
});

const getMyQuery = catchAsync(async (req, res) => {
  const query = await supportService.getUserQuery(req.user._id, req.params.id);
  return ApiResponse.success(res, { query });
});

module.exports = { getFaqs, createQuery, listMyQueries, getMyQuery };
