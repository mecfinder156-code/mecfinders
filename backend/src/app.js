'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const compression = require('compression');

const config = require('./config');
const errorHandler = require('./middleware/errorHandler');
const ApiError = require('./utils/ApiError');
const { authLimiter, writeLimiter, apiLimiter } = require('./middleware/rateLimit');

const app = express();

// Behind a reverse proxy (Nginx) / load balancer we must trust the proxy so
// req.ip and rate limiting see the real client IP, not the proxy's.
app.set('trust proxy', config.server.trustProxy);

// Security headers
app.use(helmet());

// gzip responses (JSON lists compress well → less bandwidth, lower latency).
app.use(compression());

// CORS. Browser clients (admin panel) send cookies, so we must NOT reflect an
// arbitrary origin with credentials. We allow an explicit allow-list (admin
// panel + CORS_ORIGINS env) plus localhost/Capacitor origins for development.
// Native mobile apps send no Origin header (and use Bearer tokens, not cookies),
// so requests with no origin are allowed.
const allowedOrigins = new Set(
  [
    config.cors.adminPanelUrl,
    ...config.corsOrigins,
    'http://localhost',
    'https://localhost',
    'capacitor://localhost',
    'ionic://localhost',
    'http://localhost:3000',
    'http://localhost:4512',
    'http://localhost:4513',
    'http://localhost:4514',
  ].filter(Boolean)
);

app.use(
  cors({
    origin(origin, callback) {
      // No Origin → native app / server-to-server / curl: allow.
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      // Outside production, stay permissive so on-device / ngrok testing works.
      if (config.env !== 'production') return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

// Body parsing. Capture the raw body so webhook signatures (Razorpay) can be
// verified against the exact bytes received.
//
// A few endpoints accept a base64 image inside the JSON body (register /
// profile-image / documents), which easily exceeds the small global limit — so
// those paths get a larger limit while everything else stays capped (DoS guard).
const captureRawBody = (req, res, buf) => {
  req.rawBody = buf && buf.length ? buf.toString('utf8') : '';
};
const jsonSmall = express.json({ limit: config.server.jsonBodyLimit, verify: captureRawBody });
const jsonLarge = express.json({ limit: config.server.uploadBodyLimit, verify: captureRawBody });
const LARGE_BODY_PATHS = [
  // Mobile: base64 profile photo / KYC document in the JSON body.
  '/api/auth/mobile/register',
  '/api/auth/mobile/documents',
  '/api/auth/mobile/profile-image',
  // Admin: base64 service image/banner in the JSON body.
  '/api/admin/services',
  '/api/admin/mechanic-services',
];
app.use((req, res, next) => {
  const parser = LARGE_BODY_PATHS.some((p) => req.path.startsWith(p)) ? jsonLarge : jsonSmall;
  return parser(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: config.server.jsonBodyLimit }));

// Cookie parsing
app.use(cookieParser());

// Strip MongoDB operator-injection payloads ($-prefixed / dotted keys) from
// body/params/query before anything reaches the data layer.
const sanitizeRequest = require('./middleware/sanitize');
app.use(sanitizeRequest);

// HTTP request logging (skip in test)
if (config.env !== 'test') {
  app.use(morgan('dev'));
}

// Health check — reports real dependency state so a load balancer can pull an
// unhealthy instance out of rotation instead of routing traffic to a process
// that can't reach the DB.
const mongoose = require('mongoose');
const redis = require('./config/redis');
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState; // 1 = connected
  const healthy = dbState === 1;
  res.status(healthy ? 200 : 503).json({
    success: healthy,
    message: healthy ? 'Server is running' : 'Degraded: database not connected',
    instance: config.server.instanceId,
    db: dbState === 1 ? 'up' : 'down',
    redis: redis.isEnabled() ? (redis.isConnected() ? 'up' : 'down') : 'disabled',
    uptimeSec: Math.round(process.uptime()),
  });
});

// Global rate-limit backstop (skips health + webhooks internally).
app.use(apiLimiter);

// API Routes
const authRoutes = require('./modules/auth/auth.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const categoryRoutes = require('./modules/categories/category.routes');
const cityRoutes = require('./modules/cities/city.routes');
const serviceRoutes = require('./modules/services/service.routes');
const priceRoutes = require('./modules/pricing/price.routes');
const mechanicServiceRoutes = require('./modules/mechanicServices/mechanicService.routes');
const mechanicServicePricingRoutes = require('./modules/mechanicServicePricing/mechanicServicePricing.routes');

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/admin/admins', adminRoutes);
const adminUsersRoutes = require('./modules/admin/users.routes');
app.use('/api/admin/users', adminUsersRoutes);
app.use('/api/admin/categories', categoryRoutes);
app.use('/api/admin/cities', cityRoutes);
app.use('/api/admin/services', serviceRoutes);
app.use('/api/admin/pricing', priceRoutes);
app.use('/api/admin/mechanic-services', mechanicServiceRoutes);
app.use('/api/admin/mechanic-service-pricing', mechanicServicePricingRoutes);

// Admin booking / payment / rating visibility
const adminBookingRoutes = require('./modules/bookings/booking.admin.routes');
app.use('/api/admin/bookings', adminBookingRoutes);

// Admin mechanic-wallet payout ledger (earned / paid / outstanding, settle)
const adminWalletRoutes = require('./modules/wallet/wallet.admin.routes');
app.use('/api/admin/wallets', adminWalletRoutes);

// Platform settings (max-due threshold, etc.)
const settingsRoutes = require('./modules/settings/settings.routes');
app.use('/api/admin/settings', settingsRoutes);

// Customer Mobile App Routes
const vehicleRoutes = require('./modules/vehicles/vehicle.routes');
const addressRoutes = require('./modules/addresses/address.routes');
const mobileMechanicServiceRoutes = require('./modules/mechanicServices/mechanicService.mobile.routes');
const mobileCategoryRoutes = require('./modules/categories/category.mobile.routes');

app.use('/api/mobile/vehicles', vehicleRoutes);
app.use('/api/mobile/addresses', addressRoutes);
app.use('/api/mobile/mechanic-services', mobileMechanicServiceRoutes);
const mobileServiceRoutes = require("./modules/services/service.mobile.routes");
app.use("/api/mobile/services", mobileServiceRoutes);
app.use('/api/mobile/categories', mobileCategoryRoutes);

// Booking lifecycle — customer + mechanic (provider) mobile apps
const customerBookingRoutes = require('./modules/bookings/booking.customer.routes');
const mechanicBookingRoutes = require('./modules/bookings/booking.mechanic.routes');
app.use('/api/mobile/bookings', writeLimiter, customerBookingRoutes);
app.use('/api/mobile/mechanic', writeLimiter, mechanicBookingRoutes);

// In-app notification feed (customer + mechanic)
const notificationRoutes = require('./modules/notifications/notification.routes');
app.use('/api/mobile/notifications', notificationRoutes);

// Help & Support — FAQs + user queries (mobile) and management (admin)
const supportMobileRoutes = require('./modules/support/support.mobile.routes');
const supportAdminRoutes = require('./modules/support/support.admin.routes');
app.use('/api/mobile/support', supportMobileRoutes);
app.use('/api/admin/support', supportAdminRoutes);

// Legal — admin-editable Privacy Policy & Terms per audience (customer/provider)
const legalAdminRoutes = require('./modules/legal/legal.admin.routes');
const legalMobileRoutes = require('./modules/legal/legal.mobile.routes');
app.use('/api/admin/legal', legalAdminRoutes);
app.use('/api/mobile/legal', legalMobileRoutes);

// Payment webhooks (public, signature-verified)
const paymentWebhookRoutes = require('./modules/payments/payment.webhook.routes');
app.use('/api/webhooks', paymentWebhookRoutes);

// 404 handler for unknown routes
app.use((req, res, next) => {
  next(ApiError.notFound(`Route not found: ${req.originalUrl}`));
});

// Global error handler
app.use(errorHandler);

module.exports = app;
