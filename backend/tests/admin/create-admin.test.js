'use strict';

const request = require('supertest');
const { app } = require('../setup');
const {
  createSuperAdmin,
  createAdmin,
  loginAndGetCookies,
  getCookieString,
} = require('../helpers/auth.helper');

describe('Admin - Create', () => {
  let superAdminCookies;

  beforeEach(async () => {
    await createSuperAdmin();
    const { cookies } = await loginAndGetCookies(
      'superadmin@test.com',
      'SuperAdmin@123'
    );
    superAdminCookies = getCookieString(cookies);
  });

  describe('POST /api/admin/admins', () => {
    // Test 16: SuperAdmin creates Admin with valid data
    it('should create Admin with valid data', async () => {
      const res = await request(app)
        .post('/api/admin/admins')
        .set('Cookie', superAdminCookies)
        .send({
          name: 'New Admin',
          email: 'newadmin@test.com',
          password: 'NewAdmin@123',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.admin).toBeDefined();
      expect(res.body.data.admin.name).toBe('New Admin');
      expect(res.body.data.admin.email).toBe('newadmin@test.com');
      expect(res.body.data.admin.role).toBe('admin');
      expect(res.body.data.admin.isActive).toBe(true);
      expect(res.body.data.admin.password).toBeUndefined();
    });

    // Test 17: Duplicate email
    it('should reject creating Admin with duplicate email', async () => {
      await createAdmin({ email: 'existing@test.com' });

      const res = await request(app)
        .post('/api/admin/admins')
        .set('Cookie', superAdminCookies)
        .send({
          name: 'Another Admin',
          email: 'existing@test.com',
          password: 'AnotherAdmin@123',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    // Test 18: Invalid data
    it('should reject creating Admin with invalid data', async () => {
      const res = await request(app)
        .post('/api/admin/admins')
        .set('Cookie', superAdminCookies)
        .send({
          name: '',
          email: 'not-an-email',
          password: 'short',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors.length).toBeGreaterThan(0);
    });

    // Test 19: Admin attempts to create Admin
    it('should reject Admin creating another Admin', async () => {
      await createAdmin();
      const { cookies } = await loginAndGetCookies(
        'admin@test.com',
        'TestAdmin@123'
      );

      const res = await request(app)
        .post('/api/admin/admins')
        .set('Cookie', getCookieString(cookies))
        .send({
          name: 'New Admin',
          email: 'newadmin@test.com',
          password: 'NewAdmin@123',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    // Test 20: Unauthenticated request
    it('should reject unauthenticated request to create Admin', async () => {
      const res = await request(app)
        .post('/api/admin/admins')
        .send({
          name: 'New Admin',
          email: 'newadmin@test.com',
          password: 'NewAdmin@123',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});

