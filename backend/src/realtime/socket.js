'use strict';

const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { verifyAccessToken } = require('../utils/token');
const logger = require('../utils/logger');
const redis = require('../config/redis');
const { SOCKET_EVENTS } = require('../modules/bookings/booking.constants');

/**
 * Realtime layer (Socket.IO).
 *
 * The socket server carries booking state changes to the customer and provider
 * apps so neither needs to poll or manually reload. REST remains the source of
 * truth and is used for the initial fetch and all mutations; sockets only push
 * state deltas.
 *
 * Rooms:
 *   user:<userId>       every connection joins its own user room (targeted push)
 *   booking:<bookingId> customer + assigned mechanic of a booking
 *   role:mechanic       all connected mechanics (used sparingly)
 */

let io = null;

function roomForUser(userId) {
  return `user:${userId}`;
}
function roomForBooking(bookingId) {
  return `booking:${bookingId}`;
}

/**
 * Initialise Socket.IO on an existing HTTP server. Safe to call once at boot.
 */
function initSocket(server) {
  io = new Server(server, {
    cors: { origin: true, credentials: true },
    // Capacitor apps connect over websocket/polling; allow both.
    transports: ['websocket', 'polling'],
  });

  // Multi-process scaling: with Redis, emits/rooms are broadcast across every
  // app process, so a mechanic connected to process A still receives an event
  // fired from process B. Without Redis this is skipped and Socket.IO uses its
  // default single-process in-memory adapter (unchanged behaviour).
  const adapterClients = redis.getAdapterClients();
  if (adapterClients) {
    io.adapter(createAdapter(adapterClients.pubClient, adapterClients.subClient));
    logger.info('Socket.IO using Redis adapter (multi-process realtime enabled)');
  }

  // Authenticate every connection via the same JWT access token the REST API
  // uses. Token is passed in the handshake auth payload.
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token ||
        (socket.handshake.headers?.authorization || '').replace(/^Bearer\s+/i, '');

      if (!token) return next(new Error('Authentication required'));

      const decoded = verifyAccessToken(token);
      socket.user = { id: String(decoded.id), role: decoded.role };
      return next();
    } catch (err) {
      return next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { id: userId, role } = socket.user;
    socket.join(roomForUser(userId));
    if (role === 'mechanic') socket.join('role:mechanic');

    logger.info(`Socket connected: user=${userId} role=${role} sid=${socket.id}`);

    // Join a specific booking room after verifying the user is a participant.
    socket.on(SOCKET_EVENTS.JOIN_BOOKING, async (bookingId, ack) => {
      try {
        const Booking = require('../modules/bookings/booking.model');
        const booking = await Booking.findById(bookingId).select('customerId mechanicId').lean();
        if (!booking) return typeof ack === 'function' && ack({ ok: false, error: 'Not found' });

        const isParticipant =
          String(booking.customerId) === userId ||
          (booking.mechanicId && String(booking.mechanicId) === userId);

        if (!isParticipant) return typeof ack === 'function' && ack({ ok: false, error: 'Forbidden' });

        socket.join(roomForBooking(bookingId));
        if (typeof ack === 'function') ack({ ok: true });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: 'Error' });
      }
    });

    socket.on(SOCKET_EVENTS.LEAVE_BOOKING, (bookingId) => {
      socket.leave(roomForBooking(bookingId));
    });

    // Mechanic streams its live location; relay to the booking room and persist
    // best-effort (persistence handled by the dispatch/location service).
    socket.on(SOCKET_EVENTS.MECHANIC_LOCATION_UPDATE, async (payload = {}) => {
      if (role !== 'mechanic') return;
      const { bookingId, latitude, longitude } = payload;
      if (typeof latitude !== 'number' || typeof longitude !== 'number') return;

      if (bookingId) {
        io.to(roomForBooking(bookingId)).emit(SOCKET_EVENTS.MECHANIC_LOCATION, {
          bookingId,
          mechanicId: userId,
          latitude,
          longitude,
          at: new Date().toISOString(),
        });
      }
      try {
        const locationService = require('../modules/bookings/location.service');
        await locationService.updateMechanicLocation(userId, latitude, longitude);
      } catch (_) {
        /* non-fatal */
      }
    });

    // Customer streams its live location; relay to the booking room so the
    // assigned mechanic can see where the customer actually is. Relay-only
    // (not persisted) — it's live-tracking data, the booking already stores the
    // service address.
    socket.on(SOCKET_EVENTS.CUSTOMER_LOCATION_UPDATE, (payload = {}) => {
      if (role !== 'customer') return;
      const { bookingId, latitude, longitude } = payload;
      if (typeof latitude !== 'number' || typeof longitude !== 'number') return;
      if (!bookingId) return;
      io.to(roomForBooking(bookingId)).emit(SOCKET_EVENTS.CUSTOMER_LOCATION, {
        bookingId,
        customerId: userId,
        latitude,
        longitude,
        at: new Date().toISOString(),
      });
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: user=${userId} sid=${socket.id}`);
    });
  });

  logger.info('Socket.IO initialised');
  return io;
}

// --- Emit helpers (no-op if sockets aren't initialised, e.g. in tests) ---

function emitToUser(userId, event, data) {
  if (!io || !userId) return;
  io.to(roomForUser(String(userId))).emit(event, data);
}

function emitToBooking(bookingId, event, data) {
  if (!io || !bookingId) return;
  io.to(roomForBooking(String(bookingId))).emit(event, data);
}

function emitToMechanics(event, data) {
  if (!io) return;
  io.to('role:mechanic').emit(event, data);
}

function getIO() {
  return io;
}

module.exports = {
  initSocket,
  getIO,
  emitToUser,
  emitToBooking,
  emitToMechanics,
  roomForUser,
  roomForBooking,
};
