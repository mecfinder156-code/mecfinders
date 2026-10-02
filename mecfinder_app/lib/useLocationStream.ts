import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { getSocket } from '@/lib/socket';

/**
 * Customer-side GPS streamer. While `active` is true, watches the device's
 * position and pushes each fix to the booking room via `customer:location_update`.
 * The backend relays it to the assigned mechanic as `customer:location` so both
 * parties see each other live. Best-effort: no-ops on web / when permission is
 * denied, and never throws into the screen. `onPosition` feeds the same fix to
 * the on-screen map so we don't run a second GPS watcher just for rendering.
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
            socketRef.emit('customer:location_update', { bookingId, latitude, longitude });
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
