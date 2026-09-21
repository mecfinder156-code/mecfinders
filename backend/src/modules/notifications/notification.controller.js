'use strict';

const catchAsync = require('../../utils/catchAsync');
const ApiResponse = require('../../utils/ApiResponse');
const notificationService = require('./notification.service');

/**
 * Mobile notification feed controller (shared by customer + mechanic apps).
 * `req.user._id` scopes every query to the authenticated user.
 */

const list = catchAsync(async (req, res) => {
  const { page, limit } = req.query;
  const result = await notificationService.listForUser(req.user._id, {
    page: parseInt(page, 10) || 1,
    limit: parseInt(limit, 10) || 20,
  });
  return ApiResponse.success(res, {
    notifications: result.items,
    unread: result.unread,
    pagination: result.pagination,
  });
});

const unreadCount = catchAsync(async (req, res) => {
  const count = await notificationService.unreadCount(req.user._id);
  return ApiResponse.success(res, { unread: count });
});

const markRead = catchAsync(async (req, res) => {
  await notificationService.markRead(req.user._id, req.params.id);
  return ApiResponse.success(res, null, 'Notification marked read');
});

const markAllRead = catchAsync(async (req, res) => {
  const modified = await notificationService.markAllRead(req.user._id);
  return ApiResponse.success(res, { modified }, 'All notifications marked read');
});

module.exports = { list, unreadCount, markRead, markAllRead };
