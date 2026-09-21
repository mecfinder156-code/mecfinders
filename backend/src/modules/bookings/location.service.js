'use strict';

const Mechanic = require('../users/models/mechanic.model');

/**
 * Persist a mechanic's live location as a GeoJSON point. Used both by the
 * socket location stream and REST location updates. Coordinates are stored as
 * [longitude, latitude] per GeoJSON.
 */
async function updateMechanicLocation(mechanicId, latitude, longitude) {
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    Number.isNaN(latitude) ||
    Number.isNaN(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return Mechanic.findByIdAndUpdate(
    mechanicId,
    {
      $set: {
        currentLocation: {
          type: 'Point',
          coordinates: [longitude, latitude],
          updatedAt: new Date(),
        },
        lastSeenAt: new Date(),
      },
    },
    { new: true }
  );
}

/**
 * Toggle a mechanic's online/availability flag.
 */
async function setOnlineStatus(mechanicId, isOnline) {
  return Mechanic.findByIdAndUpdate(
    mechanicId,
    { $set: { isOnline: Boolean(isOnline), lastSeenAt: new Date() } },
    { new: true }
  );
}

module.exports = { updateMechanicLocation, setOnlineStatus };
