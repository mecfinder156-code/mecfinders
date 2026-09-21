'use strict';

/**
 * One-off migration to fix the mechanic geo location field/index.
 *
 * - Removes any malformed `currentLocation` (a GeoJSON Point without
 *   `coordinates`) that the previous schema default created.
 * - Drops the old (non-sparse) `currentLocation_2dsphere` index if present so
 *   it is recreated as sparse by the app on next boot.
 *
 * Safe/idempotent: it only unsets location data that was never valid.
 */

const mongoose = require('mongoose');
require('dotenv').config();

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri);
  const users = mongoose.connection.collection('users');

  // 1. Unset malformed location objects (no coordinates array).
  const res = await users.updateMany(
    { currentLocation: { $exists: true }, 'currentLocation.coordinates': { $exists: false } },
    { $unset: { currentLocation: '' } }
  );
  console.log(`Cleared malformed currentLocation on ${res.modifiedCount} document(s)`);

  // 2. Drop the old 2dsphere index so it can be rebuilt sparse.
  try {
    const indexes = await users.indexes();
    const geo = indexes.find((i) => i.key && i.key.currentLocation === '2dsphere');
    if (geo) {
      await users.dropIndex(geo.name);
      console.log(`Dropped index ${geo.name}`);
    } else {
      console.log('No currentLocation 2dsphere index to drop');
    }
  } catch (err) {
    console.log(`Index drop skipped: ${err.message}`);
  }

  await mongoose.disconnect();
  console.log('Done. Restart the server to rebuild the sparse index.');
  process.exit(0);
})().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
