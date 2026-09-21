'use strict';

const request = require('supertest');
const { app } = require('../setup');
const {
  createSuperAdmin,
  createAdmin,
  getCookieString,
} = require('../helpers/auth.helper');

describe('Auth - Login', () => {
  describe('POST /api/auth/login', () => {
    // Test 1: SuperAdmin login with valid credentials
    it('should login SuperAdmin with valid credentials', async () => {
      await createSuperAdmin();

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'superadmin@test.com', password: 'SuperAdmin@123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.role).toBe('superadmin');
      expect(res.body.data.user.email).toBe('superadmin@test.com');
      expect(res.body.data.user.password).toBeUndefined();
      expect(res.body.data.user.refreshToken).toBeUndefined();

      // Check cookies are set
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieStr = cookies.join('; ');
      expect(cookieStr).toContain('accessToken');
      expect(cookieStr).toContain('refreshToken');
      expect(cookieStr).toContain('HttpOnly');
    });

    // Test 2: SuperAdmin login with wrong password
    it('should reject SuperAdmin login with wrong password', async () => {
      await createSuperAdmin();

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'superadmin@test.com', password: 'WrongPassword@123' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid email or password');
    });

    // Test 3: Login with non-existent email
    it('should reject login with non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@test.com', password: 'SomePass@123' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid email or password');
    });

    // Test 4: Admin login with valid credentials
    it('should login Admin with valid credentials', async () => {
      await createAdmin();

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'TestAdmin@123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe('admin');
    });

    // Test 5: Admin login with wrong password
    it('should reject Admin login with wrong password', async () => {
      await createAdmin();

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'WrongPass@123' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    // Test 6: Deactivated Admin login
    it('should reject login for deactivated Admin', async () => {
      await createAdmin({ isActive: false });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'TestAdmin@123' });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Account has been deactivated');
    });

    // Test 7: Login with missing email
    it('should reject login with missing email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'SomePass@123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    // Test 8: Login with missing password
    it('should reject login with missing password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@test.com' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    // Test 9: Login with invalid email format
    it('should reject login with invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'not-an-email', password: 'SomePass@123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});

