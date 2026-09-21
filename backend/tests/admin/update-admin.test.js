'use strict';

const request = require('supertest');
const { app } = require('../setup');
const {
  createSuperAdmin,
  createAdmin,
  loginAndGetCookies,
  getCookieString,
} = require('../helpers/auth.helper');

describe('Admin - Update', () => {
  let superAdminCookies;

  beforeEach(async () => {
    await createSuperAdmin();
    const { cookies } = await loginAndGetCookies(
      'superadmin@test.com',
      'SuperAdmin@123'
    );
    superAdminCookies = getCookieString(cookies);
  });

  describe('PATCH /api/admin/admins/:id', () => {
    // Test 24: SuperAdmin updates Admin
    it('should update admin details', async () => {
      const admin = await createAdmin();

      const res = await request(app)
        .patch(`/api/admin/admins/${admin._id}`)
        .set('Cookie', superAdminCookies)
        .send({ name: 'Updated Name', email: 'updated@test.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.admin.name).toBe('Updated Name');
      expect(res.body.data.admin.email).toBe('updated@test.com');
    });

    // Update with duplicate email
    it('should reject update with duplicate email', async () => {
      await createAdmin({ email: 'existing@test.com' });
      const admin2 = await createAdmin({ email: 'admin2@test.com', name: 'Admin 2' });

      const res = await request(app)
        .patch(`/api/admin/admins/${admin2._id}`)
        .set('Cookie', superAdminCookies)
        .send({ email: 'existing@test.com' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/admin/admins/:id/password', () => {
    // Test 28: SuperAdmin resets Admin password
    it('should reset admin password', async () => {
      const admin = await createAdmin();

      const res = await request(app)
        .patch(`/api/admin/admins/${admin._id}/password`)
        .set('Cookie', superAdminCookies)
        .send({ password: 'NewPassword@123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify new password works
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'NewPassword@123' });

      expect(loginRes.status).toBe(200);
    });

    // Invalid password format
    it('should reject password reset with weak password', async () => {
      const admin = await createAdmin();

      const res = await request(app)
        .patch(`/api/admin/admins/${admin._id}/password`)
        .set('Cookie', superAdminCookies)
        .send({ password: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});

