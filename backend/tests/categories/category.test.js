'use strict';
const request = require('supertest');
const app = require('../src/app');
const { generateAccessToken } = require('../src/utils/token');
const mongoose = require('mongoose');

describe('Categories API', () => {
  let adminToken;
  let superadminToken;

  beforeEach(() => {
    adminToken = generateAccessToken({ _id: new mongoose.Types.ObjectId(), role: 'admin' });
    superadminToken = generateAccessToken({ _id: new mongoose.Types.ObjectId(), role: 'superadmin' });
  });

  it('POST /api/admin/categories - should create a category', async () => {
    const res = await request(app)
      .post('/api/admin/categories')
      .set('Cookie', [`access_token=${superadminToken}`])
      .send({ name: 'Bike', emoji: '🏍️' });
    
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.category.name).toBe('Bike');
  });

  it('GET /api/admin/categories - should list categories', async () => {
    const res = await request(app)
      .get('/api/admin/categories')
      .set('Cookie', [`access_token=${adminToken}`]);
      
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.categories)).toBe(true);
  });
});