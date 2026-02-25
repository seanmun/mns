import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { UserRole } from '../types';

// App-level user type — keeps the same interface the rest of the app expects
export interface AppUser {
  id: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  role: UserRole | null;
  signInWithGoogle: () => Promise<void>;
  sendEmailLink: (email: string) => Promise<void>;
  completeEmailLinkSignIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  // Map Supabase user to AppUser
  const mapUser = (supabaseUser: { id: string; email?: string; user_metadata?: Record<string, any> }): AppUser => ({
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    displayName: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || supabaseUser.email || null,
    photoURL: supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture || null,
  });

  // Fetch role from profiles table
  const fetchRole = async (userId: string, email: string): Promise<UserRole> => {
    // Hardcoded admin (matches existing Firebase behavior)
    if (email === 'smunley13@gmail.com') return 'admin';

    try {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      return (data?.role as UserRole) || 'owner';
    } catch {
      return 'owner';
    }
  };

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const appUser = mapUser(session.user);
        setUser(appUser);

        const userRole = await fetchRole(session.user.id, appUser.email);
        setRole(userRole);

        // Preload critical routes for authenticated users
        setTimeout(() => {
          import('../pages/TeamSelect');
          setTimeout(() => {
            import('../pages/LeagueHome');
            import('../pages/OwnerDashboard');
          }, 500);
          if (userRole === 'admin') {
            setTimeout(() => {
              import('../pages/AdminTeams');
            }, 1000);
          }
        }, 100);
      }
      setLoading(false);
    }).catch((error) => {
      console.error('Failed to get auth session:', error);
      setLoading(false);
    });

    // Listen for auth changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const appUser = mapUser(session.user);
        setUser(appUser);

        const userRole = await fetchRole(session.user.id, appUser.email);
        setRole(userRole);
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/teams',
        },
      });
      if (error) throw error;
    } catch (error: any) {
      console.error('Error signing in with Google:', error);
      throw new Error(error.message || 'Failed to sign in with Google');
    }
  }, []);

  const sendEmailLink = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin + '/finishSignIn',
        },
      });
      if (error) throw error;
      window.localStorage.setItem('emailForSignIn', email);
    } catch (error: any) {
      console.error('Error sending email link:', error);
      throw new Error(error.message || 'Failed to send email link');
    }
  }, []);

  // With Supabase, magic link verification is handled automatically
  // by onAuthStateChange when the user lands on the redirect URL.
  // This method is kept for API compatibility with FinishSignIn page.
  const completeEmailLinkSignIn = useCallback(async (_email: string) => {
    window.localStorage.removeItem('emailForSignIn');
    // Session is established automatically by the Supabase client
    // when it detects the auth tokens in the URL hash/params.
  }, []);

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setRole(null);
    } catch (error: any) {
      console.error('Error signing out:', error);
      throw new Error(error.message || 'Failed to sign out');
    }
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    role,
    signInWithGoogle,
    sendEmailLink,
    completeEmailLinkSignIn,
    signOut,
  }), [user, loading, role, signInWithGoogle, sendEmailLink, completeEmailLinkSignIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
