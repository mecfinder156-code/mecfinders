"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getSocket } from '@/lib/socket';
import { notificationsApi } from '@/lib/api';
import { useAuth } from './AuthContext';

interface NotificationContextType {
  unread: number;
  refreshUnread: () => Promise<void>;
  setUnread: React.Dispatch<React.SetStateAction<number>>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [unread, setUnread] = useState(0);

  const refreshUnread = useCallback(async () => {
    try {
      const count = await notificationsApi.unreadCount();
      setUnread(count);
    } catch {
      /* offline / not logged in — leave count as-is */
    }
  }, []);

  // Prime the badge once logged in.
  useEffect(() => {
    if (!profile) {
      setUnread(0);
      return;
    }
    refreshUnread();
  }, [profile, refreshUnread]);

  // Global socket listener: any incoming notification bumps the badge. Native
  // alerts arrive separately via FCM push (setupPushNotifications), so this
  // provider only owns the in-app unread count.
  useEffect(() => {
    if (!profile) return;
    let active = true;
    let cleanup = () => {};

    (async () => {
      try {
        const socket = await getSocket();
        if (!active) return;

        const handleNew = () => setUnread((c) => c + 1);
        socket.on('notification:new', handleNew);
        cleanup = () => socket.off('notification:new', handleNew);
      } catch {
        /* socket optional */
      }
    })();

    return () => {
      active = false;
      cleanup();
    };
  }, [profile]);

  return (
    <NotificationContext.Provider value={{ unread, refreshUnread, setUnread }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (ctx === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return ctx;
}
