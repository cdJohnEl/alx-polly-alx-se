'use client';

import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';

// Minimal local types to avoid external type dependency issues
type SupabaseSession = unknown | null;
type SupabaseUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
} | null;

const AuthContext = createContext<{
  session: SupabaseSession;
  user: SupabaseUser;
  signOut: () => void;
  loading: boolean;
}>({
  session: null,
  user: null,
  signOut: () => {},
  loading: true,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<SupabaseSession>(null);
  const [user, setUser] = useState<SupabaseUser>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      // Swallow error; do not log sensitive data to console in production
      if (error) {
        // noop
      }
      if (mounted) {
        setUser(data.user ?? null);
        setSession(null);
        setLoading(false);
        // Do not log user details
      }
    };

    getUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setSession(session);
      setUser(session?.user ?? null);
      // Do not set loading to false here, only after initial load
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // No console logging of user/session
  return (
    <AuthContext.Provider value={{ session, user, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
