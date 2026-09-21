'use strict';

/**
 * Reconcile booking-related collection indexes with the CURRENT schemas.
 *
 * The DB carries stale indexes from a previous booking/wallet implementation
 * (e.g. bookings.idempotencyKey_1 unique, bookings.userId_*, stale wallet
 * indexes). Because the current Booking documents have no `idempotencyKey`, the
 * stale UNIQUE idempotencyKey index rejects the 2nd booking (both null) with a
 * duplicate-key error. Model.syncIndexes() drops indexes not defined by the
 * schema and builds the correct ones. Indexes only — data is untouched.
 */

const mongoose = require('mongoose');
require('dotenv').config();

const models = [
  require('./src/modules/bookings/booking.model'),
  require('./src/modules/bookings/bookingService.model'),
  require('./src/modules/bookings/mechanicRequest.model'),
  require('./src/modules/bookings/bookingTimeline.model'),
  require('./src/modules/payments/bookingPayment.model'),
  require('./src/modules/wallet/wallet.model'),
  require('./src/modules/wallet/walletTransaction.model'),
  require('./src/modules/ratings/rating.model'),
];

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri);

  for (const Model of models) {
    try {
      const dropped = await Model.syncIndexes();
      console.log(`[${Model.collection.collectionName}] synced. dropped: ${JSON.stringify(dropped)}`);
    } catch (err) {
      console.error(`[${Model.collection.collectionName}] syncIndexes failed: ${err.message}`);
    }
  }

  await mongoose.disconnect();
  console.log('\nDone. Restart the backend.');
  process.exit(0);
})().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
