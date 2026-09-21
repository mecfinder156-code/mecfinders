'use strict';

const request = require('supertest');
const { app } = require('../setup');
const {
  createSuperAdmin,
  loginAndGetCookies,
  getCookieString,
} = require('../helpers/auth.helper');

describe('Auth - Refresh', () => {
  describe('POST /api/auth/refresh', () => {
    // Test 13: Valid refresh token
    it('should refresh access token with valid refresh token', async () => {
      await createSuperAdmin();
      const { cookies } = await loginAndGetCookies(
        'superadmin@test.com',
        'SuperAdmin@123'
      );

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', getCookieString(cookies));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // New cookies should be set
      const newCookies = res.headers['set-cookie'];
      expect(newCookies).toBeDefined();
      const cookieStr = newCookies.join('; ');
      expect(cookieStr).toContain('accessToken');
      expect(cookieStr).toContain('refreshToken');
    });

    // Test 14: Invalid refresh token
    it('should reject refresh with invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', 'refreshToken=invalidtoken123');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    // No refresh token at all
    it('should reject refresh without refresh token', async () => {
      const res = await request(app).post('/api/auth/refresh');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});

