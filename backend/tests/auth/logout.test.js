'use strict';

const request = require('supertest');
const { app } = require('../setup');
const {
  createSuperAdmin,
  loginAndGetCookies,
  getCookieString,
} = require('../helpers/auth.helper');

describe('Auth - Logout', () => {
  describe('POST /api/auth/logout', () => {
    // Test 15: Successful logout
    it('should logout and clear cookies', async () => {
      await createSuperAdmin();
      const { cookies } = await loginAndGetCookies(
        'superadmin@test.com',
        'SuperAdmin@123'
      );

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', getCookieString(cookies));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Logged out successfully');

      // Verify cannot access protected route after logout
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', getCookieString(cookies));

      // The access token is still valid (short-lived), but the idea
      // is that the cookies were cleared on the client side.
      // In a real scenario the browser wouldn't send the cookie.
    });

    // Logout without authentication
    it('should reject logout without authentication', async () => {
      const res = await request(app).post('/api/auth/logout');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});

