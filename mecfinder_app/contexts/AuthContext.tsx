"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { FirebaseAuthentication, User } from '@capacitor-firebase/authentication';
import { Preferences } from '@capacitor/preferences';
import { api } from '../lib/api';

export interface Profile {
  firebaseUid: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  login: (phone: string) => Promise<{ verificationId: string }>;
  verifyOtp: (otp: string, verificationId: string) => Promise<{ exists: boolean }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (firebaseUid?: string): Promise<boolean> => {
    try {
      if (!firebaseUid) {
        setProfile(null);
        return false;
      }

      const current = await FirebaseAuthentication.getCurrentUser();
      if (!current.user) {
        setProfile(null);
        await Preferences.remove({ key: 'accessToken' });
        return false;
      }

      // Send the VERIFIED Firebase ID token — the backend derives uid/phone from
      // it and never trusts client-supplied identity.
      const { token: idToken } = await FirebaseAuthentication.getIdToken();

      const response = await api.post('/auth/mobile/login', {
        idToken,
        role: 'customer'
      });

      const responseData = response.data.data; // ApiResponse puts payload in .data

      if (responseData && responseData.exists) {
        setProfile({
          ...responseData.user,
          avatar: responseData.user.profileImage
        });
        if (responseData.accessToken) {
          await Preferences.set({ key: 'accessToken', value: responseData.accessToken });
        }
        return true;
      } else {
        setProfile(null);
        await Preferences.remove({ key: 'accessToken' });
        return false;
      }
    } catch (e) {
      console.error('Error loading profile', e);
      setProfile(null);
      await Preferences.remove({ key: 'accessToken' });
      return false;
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
      // Returns whether this phone already has a customer account, so the OTP
      // screen can route to /dashboard (existing) or /register (new).
      const exists = await loadProfile(result.user.uid);
      return { exists };
    }
    return { exists: false };
  };

  const logout = async () => {
    await FirebaseAuthentication.signOut();
    await Preferences.remove({ key: 'accessToken' });
    await Preferences.remove({ key: 'permsOnboarded' }); // re-ask permissions on next login
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
    <AuthContext.Provider value={{ user, profile, loading, login, verifyOtp, logout, refreshProfile }}>
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
