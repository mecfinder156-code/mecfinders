'use strict';

const request = require('supertest');
const { app } = require('../setup');
const SuperAdmin = require('../../src/modules/users/models/superadmin.model');
const Admin = require('../../src/modules/users/models/admin.model');
const { ROLES } = require('../../src/constants/roles');

/**
 * Create a SuperAdmin user in the database.
 */
const createSuperAdmin = async (overrides = {}) => {
  const data = {
    name: 'Super Admin',
    email: 'superadmin@test.com',
    password: 'SuperAdmin@123',
    role: ROLES.SUPERADMIN,
    isActive: true,
    ...overrides,
  };

  return SuperAdmin.create(data);
};

/**
 * Create an Admin user in the database.
 */
const createAdmin = async (overrides = {}) => {
  const data = {
    name: 'Test Admin',
    email: 'admin@test.com',
    password: 'TestAdmin@123',
    role: ROLES.ADMIN,
    permissions: [],
    isActive: true,
    ...overrides,
  };

  return Admin.create(data);
};

/**
 * Login and return cookies from the response.
 */
const loginAndGetCookies = async (email, password) => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  const cookies = res.headers['set-cookie'];
  return { res, cookies };
};

/**
 * Extract cookie string for use in subsequent requests.
 */
const getCookieString = (cookies) => {
  if (!cookies) return '';
  return cookies.map((c) => c.split(';')[0]).join('; ');
};

module.exports = {
  createSuperAdmin,
  createAdmin,
  loginAndGetCookies,
  getCookieString,
};

