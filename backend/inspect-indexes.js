'use strict';

/**
 * Diagnose & repair booking-related indexes.
 *
 * "Duplicate value for field: bookingId" means some collection has a UNIQUE
 * index keyed on bookingId. Only these are legitimate:
 *   - ratings:         { bookingId: 1 } unique   (one rating per booking)
 *   - mechanicrequests { bookingId: 1, mechanicId: 1 } unique
 * Any other collection that stores many rows per booking (bookingservices,
 * bookingtimelines, bookingpayments, wallettransactions) must NOT have a unique
 * bookingId index — this script drops such stale indexes.
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MANY_PER_BOOKING = [
  'bookingservices',
  'bookingtimelines',
  'bookingpayments',
  'wallettransactions',
];

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const cols = await db.listCollections().toArray();
  const names = cols.map((c) => c.name);
  console.log('Collections:', names.join(', '));

  for (const name of [
    'bookings',
    'bookingservices',
    'mechanicrequests',
    'bookingtimelines',
    'bookingpayments',
    'wallettransactions',
    'mechanicwallets',
    'ratings',
  ]) {
    if (!names.includes(name)) continue;
    const col = db.collection(name);
    const indexes = await col.indexes();
    console.log(`\n[${name}] indexes:`);
    for (const idx of indexes) {
      console.log(`   ${idx.name}  key=${JSON.stringify(idx.key)}  unique=${!!idx.unique}`);
    }

    // Drop stale UNIQUE single-field bookingId indexes where many rows per
    // booking are expected.
    if (MANY_PER_BOOKING.includes(name)) {
      for (const idx of indexes) {
        const keys = Object.keys(idx.key);
        const isBookingIdOnly = keys.length === 1 && keys[0] === 'bookingId';
        if (idx.unique && isBookingIdOnly) {
          await col.dropIndex(idx.name);
          console.log(`   >>> DROPPED stale unique index ${idx.name} on ${name}`);
        }
      }
    }
  }

  await mongoose.disconnect();
  console.log('\nDone. Restart the backend so Mongoose rebuilds the correct indexes.');
  process.exit(0);
})().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
