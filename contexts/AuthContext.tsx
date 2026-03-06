'use client';

import { createContext, useContext, ReactNode } from 'react';
import { User } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const DEFAULT_USER: User = {
  id: 0,
  username: 'Admin',
  role: 'admin',
  email: '',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const login = async (_username: string, _password: string) => {};
  const logout = async () => {};

  return (
    <AuthContext.Provider value={{ user: DEFAULT_USER, loading: false, login, logout }}>
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