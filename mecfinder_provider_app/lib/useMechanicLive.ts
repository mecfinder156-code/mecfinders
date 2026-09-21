import { useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket';

const NEW_REQUEST = 'request:new';
const REQUEST_CLOSED = 'request:closed';
const BOOKING_EVENTS = [
  'booking:updated',
  'booking:status_changed',
  'additional_service:resolved',
  'payment:updated',
];

/**
 * Provider-side realtime subscription. Fires `onRequestsChange` when a new
 * dispatch offer arrives or an offer is closed, and `onBookingChange` when any
 * assigned-booking event fires. Screens then refetch via SWR.
 */
export function useMechanicLive(
  onRequestsChange: () => void,
  onBookingChange?: () => void,
  joinBookingId?: string | null
) {
  const reqRef = useRef(onRequestsChange);
  const bookRef = useRef(onBookingChange);
  reqRef.current = onRequestsChange;
  bookRef.current = onBookingChange;

  useEffect(() => {
    let active = true;
    let cleanup = () => {};

    (async () => {
      try {
        const socket = await getSocket();
        if (!active) return;

        const handleReq = () => reqRef.current?.();
        const handleBook = () => bookRef.current?.();

        socket.on(NEW_REQUEST, handleReq);
        socket.on(REQUEST_CLOSED, handleReq);
        BOOKING_EVENTS.forEach((ev) => socket.on(ev, handleBook));

        if (joinBookingId) {
          socket.emit('booking:join', joinBookingId);
          socket.on('connect', () => socket.emit('booking:join', joinBookingId));
        }

        cleanup = () => {
          socket.off(NEW_REQUEST, handleReq);
          socket.off(REQUEST_CLOSED, handleReq);
          BOOKING_EVENTS.forEach((ev) => socket.off(ev, handleBook));
          if (joinBookingId) socket.emit('booking:leave', joinBookingId);
        };
      } catch {
        /* socket optional */
      }
    })();

    return () => {
      active = false;
      cleanup();
    };
  }, [joinBookingId]);
}
