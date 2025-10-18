import { createContext, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import type { UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  role: UserRole | null;
  signInWithGoogle: () => Promise<void>;
  sendEmailLink: (email: string) => Promise<void>;
  completeEmailLinkSignIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        // Get custom claims to determine role
        const idTokenResult = await firebaseUser.getIdTokenResult();

        // Temporary: Hardcode admin for specific email
        const userRole = firebaseUser.email === 'smunley13@gmail.com'
          ? 'admin'
          : (idTokenResult.claims.role as UserRole) || 'owner';

        setRole(userRole);

        // Preload critical routes for authenticated users
        // These are loaded during idle time to make navigation instant
        setTimeout(() => {
          // High priority - most users visit these immediately after login
          import('../pages/TeamSelect');

          // Medium priority - common navigation paths
          setTimeout(() => {
            import('../pages/LeagueHome');
            import('../pages/OwnerDashboard');
          }, 500);

          // Admin-specific preloading
          if (userRole === 'admin') {
            setTimeout(() => {
              // Preload admin chunk by importing any admin page
              import('../pages/AdminTeams');
            }, 1000);
          }
        }, 100); // Small delay to not interfere with initial auth flow
      } else {
        setRole(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error('Error signing in with Google:', error);
      // Provide helpful error message
      if (error.code === 'auth/popup-blocked') {
        throw new Error('Popup was blocked by browser. Please allow popups for this site.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in cancelled.');
      } else if (error.code === 'auth/unauthorized-domain') {
        throw new Error('This domain is not authorized. Please contact support.');
      }
      throw error;
    }
  };

  const sendEmailLink = async (email: string) => {
    try {
      const actionCodeSettings = {
        url: window.location.origin + '/finishSignIn',
        handleCodeInApp: true,
      };
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      window.localStorage.setItem('emailForSignIn', email);
    } catch (error) {
      console.error('Error sending email link:', error);
      throw error;
    }
  };

  const completeEmailLinkSignIn = async (email: string) => {
    try {
      if (isSignInWithEmailLink(auth, window.location.href)) {
        await signInWithEmailLink(auth, email, window.location.href);
        window.localStorage.removeItem('emailForSignIn');
      }
    } catch (error) {
      console.error('Error completing email link sign in:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setRole(null);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const value = {
    user,
    loading,
    role,
    signInWithGoogle,
    sendEmailLink,
    completeEmailLinkSignIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
