import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { ensureProfile } from '../lib/goals';
import { signOut as doSignOut } from '../lib/auth';

interface AuthState {
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Idempotent: creates the profile on first sign-in and leaves it alone afterwards.
  useEffect(() => {
    const user = session?.user;
    if (!user) return;
    const name = (user.user_metadata?.full_name as string | undefined) ?? null;
    const avatar = (user.user_metadata?.avatar_url as string | undefined) ?? null;
    ensureProfile(user.id, name, avatar).catch(() => {
      // Not fatal: the database trigger also creates the profile on first sign-in.
    });
  }, [session?.user?.id]);

  const signOut = useCallback(async () => {
    await doSignOut();
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
