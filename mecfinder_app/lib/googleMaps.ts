/**
 * Lightweight Google Maps JS API loader.
 *
 * Loads the Maps script exactly once (subsequent callers await the same
 * promise) and resolves with the global `google.maps` namespace. The API key
 * is read from NEXT_PUBLIC_GOOGLE_MAPS_API_KEY at build time — never hardcoded.
 * Because the customer app is a static export, the key is inlined into the
 * bundle at build; there is no server to keep it secret, so restrict the key
 * by app package / HTTP referrer in the Google Cloud console.
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
    const callbackName = '__initGoogleMaps__';
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
