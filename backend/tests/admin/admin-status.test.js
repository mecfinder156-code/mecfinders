'use strict';

const request = require('supertest');
const { app } = require('../setup');
const {
  createSuperAdmin,
  createAdmin,
  loginAndGetCookies,
  getCookieString,
} = require('../helpers/auth.helper');

describe('Admin - Status', () => {
  let superAdminCookies;

  beforeEach(async () => {
    await createSuperAdmin();
    const { cookies } = await loginAndGetCookies(
      'superadmin@test.com',
      'SuperAdmin@123'
    );
    superAdminCookies = getCookieString(cookies);
  });

  describe('PATCH /api/admin/admins/:id/status', () => {
    // Test 25: SuperAdmin deactivates Admin
    it('should deactivate an admin', async () => {
      const admin = await createAdmin();

      const res = await request(app)
        .patch(`/api/admin/admins/${admin._id}/status`)
        .set('Cookie', superAdminCookies)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.admin.isActive).toBe(false);
      expect(res.body.message).toBe('Admin deactivated');
    });

    // Test 26: SuperAdmin reactivates Admin
    it('should reactivate an admin', async () => {
      const admin = await createAdmin({ isActive: false });

      const res = await request(app)
        .patch(`/api/admin/admins/${admin._id}/status`)
        .set('Cookie', superAdminCookies)
        .send({ isActive: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.admin.isActive).toBe(true);
      expect(res.body.message).toBe('Admin activated');
    });

    // Deactivated Admin cannot login
    it('should prevent deactivated admin from logging in', async () => {
      const admin = await createAdmin();

      // Deactivate
      await request(app)
        .patch(`/api/admin/admins/${admin._id}/status`)
        .set('Cookie', superAdminCookies)
        .send({ isActive: false });

      // Try to login
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'TestAdmin@123' });

      expect(loginRes.status).toBe(403);
      expect(loginRes.body.message).toBe('Account has been deactivated');
    });

    // Invalid isActive value
    it('should reject invalid isActive value', async () => {
      const admin = await createAdmin();

      const res = await request(app)
        .patch(`/api/admin/admins/${admin._id}/status`)
        .set('Cookie', superAdminCookies)
        .send({ isActive: 'not-a-boolean' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});

