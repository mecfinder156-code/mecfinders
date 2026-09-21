'use strict';

const request = require('supertest');
const { app } = require('../setup');
const {
  createSuperAdmin,
  loginAndGetCookies,
  getCookieString,
} = require('../helpers/auth.helper');

describe('Auth - Me', () => {
  describe('GET /api/auth/me', () => {
    // Test 10: Without token
    it('should reject request without authentication', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    // Test 11: With invalid token
    it('should reject request with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', 'accessToken=invalidtoken123');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    // Test 12: With valid token
    it('should return user data with valid token', async () => {
      await createSuperAdmin();
      const { cookies } = await loginAndGetCookies(
        'superadmin@test.com',
        'SuperAdmin@123'
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', getCookieString(cookies));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe('superadmin@test.com');
      expect(res.body.data.user.password).toBeUndefined();
    });
  });
});

