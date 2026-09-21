"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { FirebaseAuthentication, User } from '@capacitor-firebase/authentication';
import { api } from '../lib/api';

export interface Profile {
  firebaseUid: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  profileImage?: string;
  liveCapture?: string;
  age?: number | string;
  gender?: string;
  documents?: any[];
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  login: (phone: string) => Promise<{ verificationId: string }>;
  verifyOtp: (otp: string, verificationId: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  loadProfile: (firebaseUid?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (firebaseUid?: string) => {
    try {
      let uid = firebaseUid;
      if (!uid) {
        // If no uid passed, get it from current Firebase user
        const current = await FirebaseAuthentication.getCurrentUser();
        uid = current.user?.uid;
      }
      if (!uid) {
        setProfile(null);
        return;
      }
      
      const current = await FirebaseAuthentication.getCurrentUser();
      const phone = current.user?.phoneNumber;
      
      const response = await api.post('/auth/mobile/login', {
        firebaseUid: uid,
        phone: phone,
        role: 'mechanic'
      });

      const responseData = response.data.data;

      if (responseData && responseData.exists) {
        setProfile(responseData.user);
        if (responseData.accessToken) {
          const { Preferences } = await import('@capacitor/preferences');
          await Preferences.set({ key: 'accessToken', value: responseData.accessToken });
          
          // Setup push notifications after we have auth token
          const { setupPushNotifications } = await import('@/lib/pushSetup');
          await setupPushNotifications();
        }
      } else {
        setProfile(null);
      }
    } catch (e) {
      console.error('Error loading profile', e);
      setProfile(null);
    }
  };

  useEffect(() => {
    let unmounted = false;

    const initialize = async () => {
      try {
        const result = await FirebaseAuthentication.getCurrentUser();
        const currentUser = result.user;
        if (!unmounted) {
          setUser(currentUser);
          if (currentUser) {
            await loadProfile(currentUser.uid);
          }
        }
      } catch (error) {
        console.error('Auth initialization error', error);
      } finally {
        if (!unmounted) setLoading(false);
      }
    };

    initialize();

    const listener = FirebaseAuthentication.addListener('authStateChange', async (change) => {
      const currentUser = change.user;
      setUser(currentUser);
      if (currentUser) {
        await loadProfile(currentUser.uid);
      } else {
        setProfile(null);
      }
    });

    return () => {
      unmounted = true;
      listener.then(l => l.remove());
    };
  }, []);

  const login = async (phoneNumber: string) => {
    return new Promise<{ verificationId: string }>(async (resolve, reject) => {
      let codeSentListener: any;
      let verifyFailedListener: any;
      
      try {
        codeSentListener = await FirebaseAuthentication.addListener('phoneCodeSent', (event) => {
          if (codeSentListener) codeSentListener.remove();
          if (verifyFailedListener) verifyFailedListener.remove();
          resolve({ verificationId: event.verificationId });
        });

        verifyFailedListener = await FirebaseAuthentication.addListener('phoneVerificationFailed', (event) => {
          if (codeSentListener) codeSentListener.remove();
          if (verifyFailedListener) verifyFailedListener.remove();
          reject(new Error(event.message));
        });

        await FirebaseAuthentication.signInWithPhoneNumber({ phoneNumber });
      } catch (err) {
        if (codeSentListener) codeSentListener.remove();
        if (verifyFailedListener) verifyFailedListener.remove();
        reject(err);
      }
    });
  };

  const verifyOtp = async (smsCode: string, verificationId: string) => {
    const result = await FirebaseAuthentication.confirmVerificationCode({ verificationId, verificationCode: smsCode });
    if (result.user) {
      setUser(result.user);
      await loadProfile(result.user.uid);
    }
  };

  const logout = async () => {
    await FirebaseAuthentication.signOut();
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    // Attempt to load from current user
    const current = await FirebaseAuthentication.getCurrentUser();
    if (current.user) {
      setUser(current.user);
      await loadProfile(current.user.uid);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, verifyOtp, logout, refreshProfile, loadProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
