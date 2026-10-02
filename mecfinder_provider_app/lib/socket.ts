import { io, type Socket } from 'socket.io-client';
import { Preferences } from '@capacitor/preferences';

/**
 * Realtime client (Socket.IO) for the provider app. Connects to the API origin
 * (base URL minus the trailing `/api`) using the same Bearer token as REST.
 * Used to receive new dispatch offers and live booking updates without polling.
 */

// Drive the socket origin from the same env var as REST (lib/api.ts) so a
// release build points at production, not a leftover ngrok tunnel.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://opacity-twisted-rocklike.ngrok-free.dev/api';
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
