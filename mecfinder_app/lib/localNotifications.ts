import { Capacitor } from '@capacitor/core';

/**
 * Thin wrapper around @capacitor/local-notifications.
 *
 * Everything here is best-effort and safe to call on the web (where the plugin
 * isn't available) — it silently no-ops rather than throwing, so the in-app
 * notification feed still works even when native notifications don't.
 */

let permissionGranted: boolean | null = null;

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  if (permissionGranted !== null) return permissionGranted;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const status = await LocalNotifications.checkPermissions();
    if (status.display === 'granted') {
      permissionGranted = true;
    } else {
      const req = await LocalNotifications.requestPermissions();
      permissionGranted = req.display === 'granted';
    }
  } catch {
    permissionGranted = false;
  }
  return permissionGranted;
}

/**
 * Fire a native device notification. No-op on web or when permission is denied.
 */
export async function showLocalNotification(title: string, body: string, extra?: Record<string, unknown>) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const granted = await ensureNotificationPermission();
    if (!granted) return;
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.schedule({
      notifications: [
        {
          // Random-ish 32-bit id; native requires an integer id.
          id: Math.floor(Math.random() * 2_000_000_000),
          title,
          body,
          schedule: { at: new Date(Date.now() + 100) },
          extra: extra || {},
        },
      ],
    });
  } catch {
    /* best-effort */
  }
}
