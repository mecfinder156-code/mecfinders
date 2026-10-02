'use strict';

/**
 * One-off migration: allow one phone number to be BOTH a customer and a mechanic.
 *
 * The customer/mechanic discriminator models used to declare `firebaseUid` with
 * a field-level `unique: true`, which (since discriminators share the `users`
 * collection) created a collection-wide `firebaseUid_1` unique index. That
 * blocked registering the same phone in both apps — the second register failed
 * with a duplicate-key error. The models now rely on the base User model's
 * compound `{ firebaseUid, role }` unique index (uniqueness PER ROLE), but
 * Mongoose never drops the old index on its own. This drops it.
 */

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./src/modules/users/models/user.model'); // also registers discriminators

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri);
  const coll = User.collection;

  const before = await coll.indexes();
  console.log('users indexes:', before.map((i) => i.name));

  if (before.find((i) => i.name === 'firebaseUid_1')) {
    await coll.dropIndex('firebaseUid_1');
    console.log('✓ Dropped stale collection-wide index firebaseUid_1');
  } else {
    console.log('• No firebaseUid_1 index to drop');
  }

  // Ensure the intended per-role compound unique index exists.
  try {
    await coll.createIndex({ firebaseUid: 1, role: 1 }, { unique: true, sparse: true });
    console.log('✓ Ensured compound index { firebaseUid, role } (unique, sparse)');
  } catch (err) {
    console.error('Could not create compound index (check for duplicate data):', err.message);
  }

  console.log('final indexes:', (await coll.indexes()).map((i) => i.name));
  await mongoose.disconnect();
  console.log('Done. Same phone can now register as both a customer and a mechanic.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
