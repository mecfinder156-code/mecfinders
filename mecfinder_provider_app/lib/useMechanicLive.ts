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
  joinBookingId?: string | null,
  onCustomerLocation?: (loc: { latitude: number; longitude: number }) => void
) {
  const reqRef = useRef(onRequestsChange);
  const bookRef = useRef(onBookingChange);
  const locRef = useRef(onCustomerLocation);
  reqRef.current = onRequestsChange;
  bookRef.current = onBookingChange;
  locRef.current = onCustomerLocation;

  useEffect(() => {
    let active = true;
    let cleanup = () => {};

    (async () => {
      try {
        const socket = await getSocket();
        if (!active) return;

        const handleReq = () => reqRef.current?.();
        const handleBook = () => bookRef.current?.();
        const handleCustomerLoc = (data: any) => {
          if (data && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
            locRef.current?.({ latitude: data.latitude, longitude: data.longitude });
          }
        };

        socket.on(NEW_REQUEST, handleReq);
        socket.on(REQUEST_CLOSED, handleReq);
        BOOKING_EVENTS.forEach((ev) => socket.on(ev, handleBook));
        socket.on('customer:location', handleCustomerLoc);

        // Re-join the booking room on every (re)connect. Capture the handler so
        // we can remove it on cleanup — the socket is a shared singleton, so a
        // leaked `connect` listener would accumulate across navigations.
        const handleConnect = () => socket.emit('booking:join', joinBookingId);
        if (joinBookingId) {
          socket.emit('booking:join', joinBookingId);
          socket.on('connect', handleConnect);
        }

        cleanup = () => {
          socket.off(NEW_REQUEST, handleReq);
          socket.off(REQUEST_CLOSED, handleReq);
          BOOKING_EVENTS.forEach((ev) => socket.off(ev, handleBook));
          socket.off('customer:location', handleCustomerLoc);
          if (joinBookingId) {
            socket.off('connect', handleConnect);
            socket.emit('booking:leave', joinBookingId);
          }
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
