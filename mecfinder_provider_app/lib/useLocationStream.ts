import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { getSocket } from '@/lib/socket';

/**
 * Provider-side GPS streamer (Rapido-style live tracking).
 *
 * While `active` is true, watches the device's position and pushes each fix to
 * the booking room via the `mechanic:location_update` socket event. The backend
 * relays it to the customer as `mechanic:location` and persists it. Everything
 * is best-effort: no-ops on web / when permission is denied, and never throws
 * into the job screen.
 *
 * Streaming should run only while the mechanic is en route or on-site — the
 * caller passes `active` accordingly so we stop watching once the job ends.
 */
export function useLocationStream(
  bookingId: string | null,
  active: boolean,
  onPosition?: (loc: { latitude: number; longitude: number }) => void,
) {
  useEffect(() => {
    if (!bookingId || !active) return;
    if (!Capacitor.isNativePlatform()) return; // GPS only on device

    let watchId: string | null = null;
    let cancelled = false;
    let socketRef: any = null;

    (async () => {
      try {
        const { Geolocation } = await import('@capacitor/geolocation');

        // Ensure location permission before watching.
        let perm = await Geolocation.checkPermissions();
        if (perm.location !== 'granted') {
          perm = await Geolocation.requestPermissions({ permissions: ['location'] });
        }
        if (perm.location !== 'granted' || cancelled) return;

        socketRef = await getSocket();

        watchId = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
          (position, err) => {
            if (err || !position || !socketRef) return;
            const { latitude, longitude } = position.coords;
            if (typeof latitude !== 'number' || typeof longitude !== 'number') return;
            socketRef.emit('mechanic:location_update', { bookingId, latitude, longitude });
            // Feed the same fix to the on-screen map, so we don't run a second
            // GPS watcher just for rendering.
            if (onPosition) onPosition({ latitude, longitude });
          }
        );
      } catch {
        /* best-effort: tracking is optional */
      }
    })();

    return () => {
      cancelled = true;
      if (watchId) {
        import('@capacitor/geolocation')
          .then(({ Geolocation }) => Geolocation.clearWatch({ id: watchId as string }))
          .catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, active]);
}
