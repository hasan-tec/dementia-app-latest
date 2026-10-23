/**
 * Authentication Context & Provider
 * Manages Supabase Auth session lifecycle, startup states, and account switching.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { clearLocalCache } from '../db/database';

export type AuthStatus = 'initializing' | 'signedIn' | 'signedOut';

export interface AuthContextType {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
  isRecoveryMode: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null; needsEmailConfirmation: boolean }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  resetPasswordForEmail: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('initializing');
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // 1. Initial session restoration
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!isMounted) return;
      if (error) {
        console.warn('[Auth] Error getting initial session:', error);
      }
      setSession(session);
      setUser(session?.user ?? null);
      setStatus(session?.user ? 'signedIn' : 'signedOut');
    });

    // 2. Auth state subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!isMounted) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);
      setStatus(newSession?.user ? 'signedIn' : 'signedOut');

      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
      } else if (event === 'SIGNED_OUT') {
        setIsRecoveryMode(false);
        clearLocalCache();
      } else if (event === 'SIGNED_IN') {
        clearLocalCache();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const baseUrl = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, '');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${baseUrl}/auth/callback`,
      },
    });

    // Supabase returns user with empty identities or null session when email confirmation is required
    const needsEmailConfirmation = !error && !data.session;
    return { error, needsEmailConfirmation };
  }, []);

  const signOut = useCallback(async () => {
    // Stop any active camera streams upon logout
    try {
      const mediaDevices = navigator.mediaDevices as unknown as { _streams?: MediaStream[] };
      if (mediaDevices?._streams) {
        mediaDevices._streams.forEach(s => s.getTracks().forEach(t => t.stop()));
      }
    } catch {
      // Ignore
    }

    await clearLocalCache();
    const { error } = await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setStatus('signedOut');
    setIsRecoveryMode(false);
    return { error };
  }, []);

  const resetPasswordForEmail = useCallback(async (email: string) => {
    const baseUrl = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, '');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${baseUrl}/reset-password`,
    });
    return { error };
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error) {
      setIsRecoveryMode(false);
    }
    return { error };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        session,
        isRecoveryMode,
        isConfigured: isSupabaseConfigured,
        signIn,
        signUp,
        signOut,
        resetPasswordForEmail,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
