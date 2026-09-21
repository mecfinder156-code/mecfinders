import { io, type Socket } from 'socket.io-client';
import { Preferences } from '@capacitor/preferences';

/**
 * Realtime client (Socket.IO). Connects to the API origin (the base URL with
 * the trailing `/api` stripped) authenticated with the same Bearer access
 * token the REST client uses. A single shared socket is reused across screens.
 *
 * Booking screens call `joinBooking(id)` and subscribe to booking events; the
 * server pushes lightweight signals and the screen refetches via SWR — REST
 * stays the source of truth.
 */

const API_URL = 'https://opacity-twisted-rocklike.ngrok-free.dev/api';
const SOCKET_ORIGIN = API_URL.replace(/\/api\/?$/, '');

let socket: Socket | null = null;

export async function getSocket(): Promise<Socket> {
  const { value: token } = await Preferences.get({ key: 'accessToken' });

  if (socket && socket.connected) return socket;

  if (!socket) {
    socket = io(SOCKET_ORIGIN, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: { token: token || '' },
    });
  } else {
    // Refresh auth token and reconnect if needed.
    socket.auth = { token: token || '' };
    if (!socket.connected) socket.connect();
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
