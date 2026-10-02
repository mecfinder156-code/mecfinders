'use strict';

const Booking = require('./booking.model');
const MechanicRequest = require('./mechanicRequest.model');
const Mechanic = require('../users/models/mechanic.model');
const User = require('../users/models/user.model');
const MechanicWallet = require('../wallet/wallet.model');
const settingsService = require('../settings/settings.service');
const {
  BOOKING_STATUS,
  REQUEST_STATUS,
  TIMELINE_EVENT,
  SOCKET_EVENTS,
} = require('./booking.constants');
const timeline = require('./timeline.service');
const socket = require('../../realtime/socket');
const config = require('../../config');
const logger = require('../../utils/logger');
const ApiError = require('../../utils/ApiError');

/**
 * Backend-controlled mechanic dispatch.
 *
 * Instant/scheduled bookings are offered to eligible mechanics ONE AT A TIME
 * (sequential). Each offer (MechanicRequest) has a server-side `expiresAt`. A
 * mechanic can ACCEPT or REJECT; on reject or timeout we immediately offer the
 * next eligible mechanic. Acceptance is atomic — only one mechanic can ever win
 * a booking (guaranteed by a conditional update on the Booking document).
 */

/** Great-circle distance in metres between two lat/lng points (Haversine). */
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/** Distance (m) from a mechanic's live location to the booking's service location. */
function distanceForOffer(booking, mechanic) {
  const bLat = booking.serviceLocation?.latitude;
  const bLng = booking.serviceLocation?.longitude;
  const coords = mechanic.currentLocation?.coordinates; // [lng, lat]
  if (typeof bLat !== 'number' || typeof bLng !== 'number' || !Array.isArray(coords)) return null;
  return haversineMeters(bLat, bLng, coords[1], coords[0]);
}

/**
 * Drop mechanics whose outstanding platform due exceeds the admin threshold.
 * A due is a NEGATIVE wallet balance (cash bookings), so a mechanic is blocked
 * when `balance < -maxDueThreshold`. Configured in the admin panel; read from a
 * short-lived in-process cache because this is on the hot dispatch path. Fails
 * open (returns the list unchanged) if settings can't be read.
 */
async function filterByDueThreshold(mechanics) {
  if (!mechanics.length) return mechanics;
  let threshold = null;
  try {
    const settings = await settingsService.getSettingsCached();
    if (settings && typeof settings.maxDueThreshold === 'number') threshold = settings.maxDueThreshold;
  } catch (err) {
    logger.error(`Could not read due threshold, allowing all: ${err.message}`);
    return mechanics;
  }
  // `0` (or unset/negative) disables the block entirely — matches the admin
  // panel and settings model contract.
  if (threshold === null || threshold <= 0) return mechanics;

  const ids = mechanics.map((m) => m._id);
  const blocked = await MechanicWallet.find({
    mechanicId: { $in: ids },
    balance: { $lt: -threshold },
  })
    .select('mechanicId')
    .lean();
  if (!blocked.length) return mechanics;

  const blockedSet = new Set(blocked.map((w) => String(w.mechanicId)));
  return mechanics.filter((m) => !blockedSet.has(String(m._id)));
}

/**
 * Shortlist eligible mechanics for a booking, excluding those already offered
 * and any whose platform due exceeds the admin threshold. Prefers geo-proximity
 * when the booking has coordinates, otherwise ranks by rating. Returns lean
 * docs, best candidate first.
 */
async function findEligibleMechanics(booking, excludeIds = []) {
  const base = {
    role: 'mechanic',
    isActive: true,
    isOnline: true,
    // Admin may pause a mechanic from dispatch without banning the account.
    // `$ne: true` keeps legacy mechanics (field absent) eligible.
    requestsPaused: { $ne: true },
    _id: { $nin: excludeIds },
  };
  const max = config.dispatch.maxCandidates || 20;

  // Admin-tunable search radius (km in settings → metres), else the config default.
  let radiusMeters = config.dispatch.searchRadiusMeters || 10000;
  try {
    const settings = await settingsService.getSettingsCached();
    if (settings && Number(settings.dispatchRadiusKm) > 0) {
      radiusMeters = Number(settings.dispatchRadiusKm) * 1000;
    }
  } catch (_) {
    /* use config default */
  }

  const { latitude, longitude } = booking.serviceLocation || {};
  const hasCoords = typeof latitude === 'number' && typeof longitude === 'number';

  if (hasCoords) {
    // STRICT radius: only ONLINE mechanics within range are offered the job —
    // nearest first ($near sorts by distance). NO far-away fallback, so a Delhi
    // booking can never reach an Agra mechanic. If nobody is in range (or the
    // only ones in range are over their due limit), return [] and let the
    // booking wait/expire rather than dispatch across cities.
    try {
      const geo = await Mechanic.find({
        ...base,
        currentLocation: {
          $near: {
            $geometry: { type: 'Point', coordinates: [longitude, latitude] },
            $maxDistance: radiusMeters,
          },
        },
      })
        .limit(max)
        .lean();
      const eligible = await filterByDueThreshold(geo);
      logger.info(
        `[dispatch] geo: ${geo.length} online mechanic(s) within ${Math.round(radiusMeters / 1000)}km, ${eligible.length} after due filter` +
          (geo.length && !eligible.length ? ' (in-range mechanics blocked by maxDueThreshold)' : '')
      );
      return eligible;
    } catch (err) {
      // A missing/broken 2dsphere index makes $near throw — return [] rather than
      // risk matching a far mechanic. Run sync-indexes.js if this recurs.
      logger.error(`[dispatch] geo search failed (check 2dsphere index): ${err.message}`);
      return [];
    }
  }

  // Booking has NO coordinates (can't measure distance) — last-resort fallback
  // to any online mechanic so it can still be served. Distance NOT enforced.
  const fallback = await Mechanic.find(base)
    .sort({ ratingAverage: -1, completedServicesCount: -1, createdAt: 1 })
    .limit(max)
    .lean();
  const eligible = await filterByDueThreshold(fallback);
  logger.info(
    `[dispatch] booking has no coords — fallback to ${eligible.length} online mechanic(s) (distance NOT enforced)` +
      (!fallback.length ? ' (NONE online)' : '')
  );
  return eligible;
}

async function notifyMechanicOfOffer(mechanic, booking) {
  socket.emitToUser(mechanic._id, SOCKET_EVENTS.NEW_REQUEST, {
    bookingId: String(booking._id),
    bookingType: booking.bookingType,
    scheduledAt: booking.scheduledAt,
  });
  // Best-effort background push (no-op if FCM not configured).
  try {
    const push = require('../notifications/push.service');
    const full = await User.findById(mechanic._id).select('fcmToken');
    if (full && full.fcmToken) {
      await push.send(
        full.fcmToken,
        booking.bookingType === 'INSTANT' ? '🔴 New Instant Request' : '🕒 New Scheduled Request',
        'You have a new service request. Tap to respond.',
        { type: 'NEW_REQUEST', bookingId: String(booking._id) }
      );
    }
  } catch (_) {
    /* push is optional */
  }
}

/**
 * Offer the booking to the next eligible mechanic. No-op if the booking is no
 * longer searching, or if it already has a live PENDING offer.
 */
async function dispatchNext(bookingOrId) {
  const booking =
    typeof bookingOrId === 'object' && bookingOrId._id
      ? bookingOrId
      : await Booking.findById(bookingOrId);
  if (!booking) return null;
  if (booking.status !== BOOKING_STATUS.SEARCHING_MECHANIC) return null;

  // Don't create a second concurrent offer.
  const livePending = await MechanicRequest.findOne({
    bookingId: booking._id,
    status: REQUEST_STATUS.PENDING,
  });
  if (livePending) return livePending;

  const offered = await MechanicRequest.find({ bookingId: booking._id }).distinct('mechanicId');
  const candidates = await findEligibleMechanics(booking, offered);

  if (!candidates.length) {
    // No one left to try -> expire the booking.
    booking.status = BOOKING_STATUS.EXPIRED;
    await booking.save();
    await timeline.logEvent({
      bookingId: booking._id,
      event: TIMELINE_EVENT.EXPIRED,
      fromStatus: BOOKING_STATUS.SEARCHING_MECHANIC,
      toStatus: BOOKING_STATUS.EXPIRED,
      message: 'No eligible mechanic accepted the request',
    });
    socket.emitToUser(booking.customerId, SOCKET_EVENTS.BOOKING_STATUS_CHANGED, {
      bookingId: String(booking._id),
      status: BOOKING_STATUS.EXPIRED,
    });

    // Expiry bypasses applyTransition too — tell the customer no mechanic accepted.
    const bookingNotifications = require('../notifications/notification.booking');
    bookingNotifications.notifyBookingStatus(booking, BOOKING_STATUS.EXPIRED, null);
    return null;
  }

  const mechanic = candidates[0];
  const count = await MechanicRequest.countDocuments({ bookingId: booking._id });
  const timeoutMs = config.dispatch.requestTimeoutMs || 30000;
  const distanceMeters = distanceForOffer(booking, mechanic);

  let request;
  try {
    request = await MechanicRequest.create({
      bookingId: booking._id,
      mechanicId: mechanic._id,
      status: REQUEST_STATUS.PENDING,
      sequence: count,
      distanceMeters,
      sentAt: new Date(),
      expiresAt: new Date(Date.now() + timeoutMs),
    });
  } catch (err) {
    if (err && err.code === 11000) {
      // A concurrent dispatch (sweeper + reject) already placed an offer for
      // this booking. Return that live offer instead of creating a duplicate.
      return MechanicRequest.findOne({ bookingId: booking._id, status: REQUEST_STATUS.PENDING });
    }
    throw err;
  }

  await timeline.logEvent({
    bookingId: booking._id,
    event: TIMELINE_EVENT.REQUEST_SENT,
    meta: { mechanicId: mechanic._id, sequence: count },
  });

  notifyMechanicOfOffer(mechanic, booking);
  logger.info(`[dispatch] booking ${booking._id}: offer sent to mechanic ${mechanic._id} (seq ${count})`);
  return request;
}

/** Entry point after a booking is created. */
async function startDispatch(booking) {
  return dispatchNext(booking);
}

/**
 * Mechanic accepts an offer. Atomic: only one mechanic can win. Uses a
 * conditional update on the Booking (status still SEARCHING + no mechanic yet)
 * so simultaneous accepts cannot both succeed.
 */
async function acceptRequest(bookingId, mechanicUser) {
  const request = await MechanicRequest.findOne({
    bookingId,
    mechanicId: mechanicUser._id,
  });
  if (!request) throw ApiError.notFound('No request found for you on this booking');
  if (request.status === REQUEST_STATUS.ACCEPTED) {
    return Booking.findById(bookingId); // idempotent
  }
  if (request.status !== REQUEST_STATUS.PENDING) {
    throw ApiError.conflict(`Request is ${request.status}`);
  }
  if (request.expiresAt.getTime() < Date.now()) {
    request.status = REQUEST_STATUS.EXPIRED;
    request.respondedAt = new Date();
    await request.save();
    throw ApiError.conflict('This request has expired');
  }

  // Atomic claim: only succeeds if the booking is still unassigned & searching.
  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId, status: BOOKING_STATUS.SEARCHING_MECHANIC, mechanicId: null },
    {
      $set: {
        mechanicId: mechanicUser._id,
        status: BOOKING_STATUS.MECHANIC_ASSIGNED,
        assignedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!booking) {
    // Someone else won, or the booking moved on.
    request.status = REQUEST_STATUS.CANCELLED;
    request.respondedAt = new Date();
    await request.save();
    throw ApiError.conflict('Booking is no longer available');
  }

  request.status = REQUEST_STATUS.ACCEPTED;
  request.respondedAt = new Date();
  await request.save();

  // Cancel all other outstanding offers for this booking.
  await MechanicRequest.updateMany(
    { bookingId, status: REQUEST_STATUS.PENDING, _id: { $ne: request._id } },
    { $set: { status: REQUEST_STATUS.CANCELLED, respondedAt: new Date() } }
  );
  socket.emitToMechanics(SOCKET_EVENTS.REQUEST_CLOSED, { bookingId: String(bookingId) });

  await timeline.logEvent({
    bookingId,
    event: TIMELINE_EVENT.MECHANIC_ASSIGNED,
    actor: mechanicUser,
    fromStatus: BOOKING_STATUS.SEARCHING_MECHANIC,
    toStatus: BOOKING_STATUS.MECHANIC_ASSIGNED,
  });

  const payload = { bookingId: String(bookingId), status: BOOKING_STATUS.MECHANIC_ASSIGNED };
  socket.emitToBooking(bookingId, SOCKET_EVENTS.BOOKING_STATUS_CHANGED, payload);
  socket.emitToUser(booking.customerId, SOCKET_EVENTS.BOOKING_STATUS_CHANGED, payload);
  socket.emitToUser(mechanicUser._id, SOCKET_EVENTS.BOOKING_STATUS_CHANGED, payload);

  // Assignment bypasses applyTransition (atomic claim above), so notify here.
  const bookingNotifications = require('../notifications/notification.booking');
  bookingNotifications.notifyBookingStatus(booking, BOOKING_STATUS.MECHANIC_ASSIGNED, mechanicUser);

  return booking;
}

/**
 * Mechanic rejects an offer; immediately move to the next eligible mechanic.
 */
async function rejectRequest(bookingId, mechanicUser) {
  const request = await MechanicRequest.findOne({ bookingId, mechanicId: mechanicUser._id });
  if (!request) throw ApiError.notFound('No request found for you on this booking');
  if (request.status !== REQUEST_STATUS.PENDING) {
    return request; // already resolved
  }
  request.status = REQUEST_STATUS.REJECTED;
  request.respondedAt = new Date();
  await request.save();

  await timeline.logEvent({
    bookingId,
    event: TIMELINE_EVENT.REQUEST_REJECTED,
    actor: mechanicUser,
    meta: { mechanicId: mechanicUser._id },
  });

  await dispatchNext(bookingId);
  return request;
}

/** Close all live offers for a booking (e.g. on cancellation). */
async function closeOffers(bookingId, reason = null) {
  await MechanicRequest.updateMany(
    { bookingId, status: REQUEST_STATUS.PENDING },
    { $set: { status: REQUEST_STATUS.CANCELLED, respondedAt: new Date() } }
  );
  socket.emitToMechanics(SOCKET_EVENTS.REQUEST_CLOSED, { bookingId: String(bookingId), reason });
}

/**
 * Sweep expired PENDING offers and advance dispatch. Idempotent and safe to run
 * on an interval. Returns the number of offers expired.
 */
async function sweepExpired() {
  const now = new Date();
  const batch = config.dispatch.sweepBatchSize || 200;
  const expired = await MechanicRequest.find({
    status: REQUEST_STATUS.PENDING,
    expiresAt: { $lte: now },
  })
    .select('_id bookingId mechanicId')
    .limit(batch)
    .lean();

  if (!expired.length) return 0;

  // Flip all expired offers in ONE bulk write instead of N sequential saves —
  // far less round-trip time and DB churn when many offers time out at once.
  await MechanicRequest.updateMany(
    { _id: { $in: expired.map((r) => r._id) } },
    { $set: { status: REQUEST_STATUS.EXPIRED, respondedAt: now } }
  );

  const bookingIds = new Set();
  await Promise.all(
    expired.map((req) => {
      bookingIds.add(String(req.bookingId));
      return timeline
        .logEvent({
          bookingId: req.bookingId,
          event: TIMELINE_EVENT.REQUEST_EXPIRED,
          meta: { mechanicId: req.mechanicId },
        })
        .catch((err) => logger.error(`timeline log failed: ${err.message}`));
    })
  );

  // Advance each affected booking to its next candidate. Run in parallel; each
  // dispatchNext is independently guarded against duplicate offers.
  await Promise.all(
    [...bookingIds].map((id) =>
      dispatchNext(id).catch((err) =>
        logger.error(`dispatchNext failed for booking ${id}: ${err.message}`)
      )
    )
  );
  return expired.length;
}

let sweeperHandle = null;
function startSweeper() {
  if (sweeperHandle) return sweeperHandle;
  const leaderLock = require('../../utils/leaderLock');
  const interval = config.dispatch.sweepIntervalMs || 5000;
  // Hold the leader lock a little longer than the interval so a live leader
  // keeps renewing it, but a dead leader's lock expires and another takes over.
  const lockTtl = interval * 3;

  sweeperHandle = setInterval(async () => {
    try {
      // In multi-process mode only the lock holder sweeps; every other process
      // no-ops here. Single-process (no Redis) always acquires.
      const isLeader = await leaderLock.tryAcquireSweeper(lockTtl);
      if (!isLeader) return;
      await sweepExpired();
    } catch (err) {
      logger.error(`Dispatch sweep error: ${err.message}`);
    }
  }, interval);
  if (sweeperHandle.unref) sweeperHandle.unref();
  logger.info(`Dispatch sweeper started (every ${interval}ms)`);
  return sweeperHandle;
}
function stopSweeper() {
  if (sweeperHandle) {
    clearInterval(sweeperHandle);
    sweeperHandle = null;
  }
}

module.exports = {
  findEligibleMechanics,
  dispatchNext,
  startDispatch,
  acceptRequest,
  rejectRequest,
  closeOffers,
  sweepExpired,
  startSweeper,
  stopSweeper,
};
