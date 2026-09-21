import { useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket';

const BOOKING_EVENTS = [
  'booking:updated',
  'booking:status_changed',
  'additional_service:requested',
  'additional_service:resolved',
  'bill:generated',
  'payment:updated',
];

/**
 * Subscribe to realtime updates for a single booking. Joins the booking room
 * and invokes `onChange` whenever the server pushes a booking event (the
 * screen then refetches via SWR). Also surfaces mechanic location pings via
 * `onLocation`. Cleans up listeners + leaves the room on unmount.
 */
export function useBookingLive(
  bookingId: string | null,
  onChange: () => void,
  onLocation?: (loc: { latitude: number; longitude: number }) => void
) {
  const onChangeRef = useRef(onChange);
  const onLocationRef = useRef(onLocation);
  onChangeRef.current = onChange;
  onLocationRef.current = onLocation;

  useEffect(() => {
    if (!bookingId) return;
    let active = true;
    let cleanup = () => {};

    (async () => {
      try {
        const socket = await getSocket();
        if (!active) return;

        const handleChange = () => onChangeRef.current?.();
        const handleLocation = (data: any) => {
          if (data && typeof data.latitude === 'number') {
            onLocationRef.current?.({ latitude: data.latitude, longitude: data.longitude });
          }
        };

        socket.emit('booking:join', bookingId);
        BOOKING_EVENTS.forEach((ev) => socket.on(ev, handleChange));
        socket.on('mechanic:location', handleLocation);
        // Re-join after a reconnect so we keep receiving room events.
        socket.on('connect', () => socket.emit('booking:join', bookingId));

        cleanup = () => {
          BOOKING_EVENTS.forEach((ev) => socket.off(ev, handleChange));
          socket.off('mechanic:location', handleLocation);
          socket.emit('booking:leave', bookingId);
        };
      } catch {
        /* socket optional; SWR fallback still refreshes */
      }
    })();

    return () => {
      active = false;
      cleanup();
    };
  }, [bookingId]);
}
