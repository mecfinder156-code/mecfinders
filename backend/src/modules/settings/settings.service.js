'use strict';

const PlatformSettings = require('./settings.model');

/**
 * Platform settings accessor. The document is a singleton (key 'GLOBAL'). The
 * value is cached in-process for a short TTL because it is read on the hot
 * dispatch path (every mechanic-shortlist) but changes rarely.
 */

let cache = null;
let cacheAt = 0;
const TTL_MS = 30 * 1000;

async function getOrCreate() {
  let doc = await PlatformSettings.findOne({ key: 'GLOBAL' });
  if (!doc) {
    try {
      doc = await PlatformSettings.create({ key: 'GLOBAL' });
    } catch (err) {
      // Race: another request created it first.
      doc = await PlatformSettings.findOne({ key: 'GLOBAL' });
      if (!doc) throw err;
    }
  }
  return doc;
}

/** Fresh document (bypasses cache) — used by admin reads/writes. */
async function getSettings() {
  return getOrCreate();
}

/** Cached read for the hot dispatch path. */
async function getSettingsCached() {
  const now = Date.now();
  if (cache && now - cacheAt < TTL_MS) return cache;
  const doc = await getOrCreate();
  cache = doc.toObject();
  cacheAt = now;
  return cache;
}

function invalidate() {
  cache = null;
  cacheAt = 0;
}

async function updateSettings(patch, adminUserId = null) {
  const doc = await getOrCreate();
  if (patch.maxDueThreshold !== undefined && patch.maxDueThreshold !== null) {
    const v = Number(patch.maxDueThreshold);
    if (Number.isFinite(v) && v >= 0) doc.maxDueThreshold = v;
  }
  if (patch.dispatchRadiusKm !== undefined && patch.dispatchRadiusKm !== null) {
    const v = Number(patch.dispatchRadiusKm);
    if (Number.isFinite(v) && v >= 1 && v <= 500) doc.dispatchRadiusKm = v;
  }
  if (adminUserId) doc.updatedBy = adminUserId;
  await doc.save();
  invalidate();
  return doc;
}

module.exports = { getSettings, getSettingsCached, updateSettings, invalidate };
