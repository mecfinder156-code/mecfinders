'use strict';

const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../setup');
const {
  createSuperAdmin,
  createAdmin,
  loginAndGetCookies,
  getCookieString,
} = require('../helpers/auth.helper');

describe('Admin - List & Get', () => {
  let superAdminCookies;

  beforeEach(async () => {
    await createSuperAdmin();
    const { cookies } = await loginAndGetCookies(
      'superadmin@test.com',
      'SuperAdmin@123'
    );
    superAdminCookies = getCookieString(cookies);
  });

  describe('GET /api/admin/admins', () => {
    // Test 21: SuperAdmin lists Admins
    it('should list all admins with pagination', async () => {
      await createAdmin({ email: 'admin1@test.com', name: 'Admin One' });
      await createAdmin({ email: 'admin2@test.com', name: 'Admin Two' });

      const res = await request(app)
        .get('/api/admin/admins')
        .set('Cookie', superAdminCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBe(2);
    });

    // Test with search
    it('should search admins by name', async () => {
      await createAdmin({ email: 'admin1@test.com', name: 'John Doe' });
      await createAdmin({ email: 'admin2@test.com', name: 'Jane Smith' });

      const res = await request(app)
        .get('/api/admin/admins?search=John')
        .set('Cookie', superAdminCookies);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('John Doe');
    });

    // Test 27: Admin attempts to list Admins
    it('should reject Admin listing other Admins', async () => {
      await createAdmin();
      const { cookies } = await loginAndGetCookies(
        'admin@test.com',
        'TestAdmin@123'
      );

      const res = await request(app)
        .get('/api/admin/admins')
        .set('Cookie', getCookieString(cookies));

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/admin/admins/:id', () => {
    // Test 22: SuperAdmin gets specific Admin
    it('should get a specific admin by ID', async () => {
      const admin = await createAdmin();

      const res = await request(app)
        .get(`/api/admin/admins/${admin._id}`)
        .set('Cookie', superAdminCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.admin.email).toBe('admin@test.com');
    });

    // Test 23: Non-existent Admin
    it('should return 404 for non-existent admin', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .get(`/api/admin/admins/${fakeId}`)
        .set('Cookie', superAdminCookies);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});

