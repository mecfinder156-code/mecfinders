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

// CORS
const allowedOrigins = [
  config.cors.adminPanelUrl,
  'http://localhost',
  'capacitor://localhost',
  'http://localhost:3000',
  'http://localhost:3001'
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow all origins dynamically (great for Capacitor/Ngrok development)
      callback(null, true);
    },
    credentials: true,
  })
);

// Body parsing. Capture the raw body so webhook signatures (Razorpay) can be
// verified against the exact bytes received.
app.use(
  express.json({
    limit: config.server.jsonBodyLimit,
    verify: (req, res, buf) => {
      req.rawBody = buf && buf.length ? buf.toString('utf8') : '';
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: config.server.jsonBodyLimit }));

// Cookie parsing
app.use(cookieParser());

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
