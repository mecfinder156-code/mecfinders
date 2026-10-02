'use strict';

require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 4511,

  mongodb: {
    uri: process.env.MONGODB_URI,
    // Connection-pool tuning. Under concurrent load these decide how many
    // simultaneous DB operations the process can have in flight. Keep
    // maxPoolSize well under the Atlas tier's connection cap (M0/M10 ≈ 500).
    // With N app processes, N * maxPoolSize must stay under that cap.
    maxPoolSize: parseInt(process.env.MONGO_MAX_POOL, 10) || 50,
    minPoolSize: parseInt(process.env.MONGO_MIN_POOL, 10) || 5,
    serverSelectionTimeoutMs:
      parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS, 10) || 10000,
    socketTimeoutMs: parseInt(process.env.MONGO_SOCKET_TIMEOUT_MS, 10) || 45000,
  },

  // Redis is OPTIONAL. Set REDIS_URL to enable multi-process scaling:
  //   - Socket.IO Redis adapter (realtime works across processes)
  //   - distributed leader-lock so only ONE process runs the dispatch sweeper
  //   - shared cache
  // Without REDIS_URL the app runs single-process exactly as before.
  redis: {
    url: process.env.REDIS_URL || null,
    get enabled() {
      return Boolean(this.url);
    },
  },

  // Generic server tuning.
  server: {
    jsonBodyLimit: process.env.JSON_BODY_LIMIT || '1mb',
    // Larger limit for the few endpoints that accept a base64 image in the JSON
    // body (register/profile-image/documents). Keeps the global limit small
    // (DoS guard) while letting photo uploads through.
    uploadBodyLimit: process.env.UPLOAD_BODY_LIMIT || '15mb',
    // Instance id helps identify which process holds the sweeper lock in logs.
    instanceId:
      process.env.INSTANCE_ID ||
      `${process.pid}@${require('os').hostname()}`,
    trustProxy: process.env.TRUST_PROXY || 'loopback',
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },

  superadmin: {
    name: process.env.SUPERADMIN_NAME,
    email: process.env.SUPERADMIN_EMAIL,
    password: process.env.SUPERADMIN_PASSWORD,
  },

  cors: {
    adminPanelUrl: process.env.ADMIN_PANEL_URL || 'http://localhost:4512',
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || null,
    keySecret: process.env.RAZORPAY_KEY_SECRET || null,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || null,
    get enabled() {
      return Boolean(this.keyId && this.keySecret);
    },
  },

  // Firebase Admin — verifies mobile ID tokens (phone-OTP auth) and sends FCM
  // push. Credentials come from these env vars OR a config/service-account.json
  // file. Without them, mobile login/register fail closed (never trust the
  // client). The private key may contain literal "\n" which we restore at use.
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || null,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || null,
    privateKey: process.env.FIREBASE_PRIVATE_KEY || null,
    get enabled() {
      return Boolean(this.projectId && this.clientEmail && this.privateKey);
    },
  },

  // Comma-separated list of browser origins allowed to call the API with
  // credentials (admin panel, staging, etc.). The mobile apps use Bearer tokens
  // (no cookies) so they are allowed separately. Localhost + capacitor origins
  // are always allowed for development.
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // Booking dispatch tuning (backend-controlled, not the client).
  dispatch: {
    // How long each mechanic has to respond to an instant offer before it moves
    // to the next (nearest) mechanic. 10s per the product requirement.
    requestTimeoutMs: parseInt(process.env.DISPATCH_REQUEST_TIMEOUT_MS, 10) || 10000,
    // How often the sweeper checks for expired offers. Kept well under the
    // request timeout so an expired offer rolls to the next mechanic promptly.
    sweepIntervalMs: parseInt(process.env.DISPATCH_SWEEP_INTERVAL_MS, 10) || 3000,
    // Max mechanics to search radially (metres) for instant bookings. This is
    // the DEFAULT; the admin-tunable `dispatchRadiusKm` setting overrides it.
    searchRadiusMeters: parseInt(process.env.DISPATCH_SEARCH_RADIUS_M, 10) || 10000,
    // Max eligible mechanics to shortlist per booking.
    maxCandidates: parseInt(process.env.DISPATCH_MAX_CANDIDATES, 10) || 20,
    // Max expired offers to process per sweep tick (batched).
    sweepBatchSize: parseInt(process.env.DISPATCH_SWEEP_BATCH, 10) || 200,
    // OTP settings
    otpLength: 4,
    otpMaxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS, 10) || 5,
  },

  // In-process cache TTLs (seconds) for rarely-changing reference data.
  cache: {
    referenceTtl: parseInt(process.env.CACHE_REFERENCE_TTL_S, 10) || 60,
  },
};

// Validate required configuration
const requiredVars = [
  ['MONGODB_URI', config.mongodb.uri],
  ['JWT_ACCESS_SECRET', config.jwt.accessSecret],
  ['JWT_REFRESH_SECRET', config.jwt.refreshSecret],
];

for (const [name, value] of requiredVars) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

if (config.jwt.accessSecret.length < 32) {
  throw new Error('JWT_ACCESS_SECRET must be at least 32 characters');
}

if (config.jwt.refreshSecret.length < 32) {
  throw new Error('JWT_REFRESH_SECRET must be at least 32 characters');
}

module.exports = config;
