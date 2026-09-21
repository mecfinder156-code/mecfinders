/**
 * Lightweight Google Maps JS API loader (web fallback only).
 *
 * On a real device the provider app renders the NATIVE Maps SDK via
 * `@capacitor/google-maps`; this loader is only used for the browser dev
 * preview. Loads the Maps script exactly once and resolves with the global
 * `google.maps` namespace. The key is read from NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
 *
 * Typed loosely (`any`) so the app needs no @types/google.maps dependency.
 */

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

let loaderPromise: Promise<any> | null = null;

export function isMapsConfigured(): boolean {
  return Boolean(GOOGLE_MAPS_API_KEY);
}

export function loadGoogleMaps(): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps can only load in the browser'));
  }
  const w = window as any;
  if (w.google?.maps) {
    return Promise.resolve(w.google.maps);
  }
  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(new Error('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'));
  }
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    const callbackName = '__initGoogleMapsProvider__';
    w[callbackName] = () => {
      resolve(w.google.maps);
      delete w[callbackName];
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      GOOGLE_MAPS_API_KEY
    )}&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      loaderPromise = null;
      reject(new Error('Failed to load Google Maps'));
    };
    document.head.appendChild(script);
  });

  return loaderPromise;
}
