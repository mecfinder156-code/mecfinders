'use strict';

const request = require('supertest');
const { app } = require('../setup');
const {
  createSuperAdmin,
  createAdmin,
  loginAndGetCookies,
  getCookieString,
} = require('../helpers/auth.helper');

describe('Middleware - Authentication & Authorization', () => {
  describe('authenticate middleware', () => {
    it('should reject requests without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('should reject requests with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', 'accessToken=invalid.token.here');
      expect(res.status).toBe(401);
    });

    it('should pass authenticated requests', async () => {
      await createSuperAdmin();
      const { cookies } = await loginAndGetCookies(
        'superadmin@test.com',
        'SuperAdmin@123'
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', getCookieString(cookies));

      expect(res.status).toBe(200);
    });
  });

  describe('authorize middleware', () => {
    it('should allow SuperAdmin to access SuperAdmin-only routes', async () => {
      await createSuperAdmin();
      const { cookies } = await loginAndGetCookies(
        'superadmin@test.com',
        'SuperAdmin@123'
      );

      const res = await request(app)
        .get('/api/admin/admins')
        .set('Cookie', getCookieString(cookies));

      expect(res.status).toBe(200);
    });

    it('should deny Admin access to SuperAdmin-only routes', async () => {
      await createAdmin();
      const { cookies } = await loginAndGetCookies(
        'admin@test.com',
        'TestAdmin@123'
      );

      const res = await request(app)
        .get('/api/admin/admins')
        .set('Cookie', getCookieString(cookies));

      expect(res.status).toBe(403);
    });

    it('should deny unauthenticated access to protected routes', async () => {
      const res = await request(app).get('/api/admin/admins');
      expect(res.status).toBe(401);
    });
  });
});

