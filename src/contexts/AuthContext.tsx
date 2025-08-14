'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import pb, { pbHelpers, User } from '@/lib/pocketbase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (email: string, name: string, password: string) => Promise<User>;
  signOut: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize auth state
    const initAuth = async () => {
      try {
        // Check if we have a valid auth token
        if (pb.authStore.isValid) {
          // Refresh the auth token to make sure it's still valid
          await pb.collection('users').authRefresh();
          setUser(pb.authStore.model as User);
        }
      } catch (error) {
        // Token is invalid, clear it
        pb.authStore.clear();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const unsubscribe = pb.authStore.onChange((token, model) => {
      setUser(model as User | null);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string): Promise<User> => {
    try {
      const user = await pbHelpers.signIn(email, password);
      setUser(user);
      return user;
    } catch (error: any) {
      throw new Error(error.message || 'Sign in failed');
    }
  };

  const signUp = async (email: string, name: string, password: string): Promise<User> => {
    try {
      const user = await pbHelpers.signUp(email, name, password);
      setUser(user);
      return user;
    } catch (error: any) {
      throw new Error(error.message || 'Sign up failed');
    }
  };

  const signOut = () => {
    pbHelpers.signOut();
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      if (pb.authStore.isValid) {
        await pb.collection('users').authRefresh();
        setUser(pb.authStore.model as User);
      }
    } catch (error) {
      pb.authStore.clear();
      setUser(null);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
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