'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Cleaner, getCleanerById } from './models';

interface CleanerAuthContextType {
  cleaner: Omit<Cleaner, 'password'> | null;
  isLoading: boolean;
  logout: () => void;
}

const CleanerAuthContext = createContext<CleanerAuthContextType>({
  cleaner: null,
  isLoading: true,
  logout: () => {}
});

export const useCleanerAuth = () => useContext(CleanerAuthContext);

// Helper function to safely store auth data
export const storeAuthData = (data: unknown) => {
  try {
    const authData = JSON.stringify(data);
    sessionStorage.setItem('cleanerAuth', authData);
    localStorage.setItem('cleanerAuth', authData);
    return true;
  } catch (error) {
    console.error('Error storing auth data:', error);
    return false;
  }
};

// Helper function to retrieve auth data
const getAuthData = () => {
  try {
    let authData = sessionStorage.getItem('cleanerAuth');
    if (!authData) {
      authData = localStorage.getItem('cleanerAuth');
      if (authData) {
        try { sessionStorage.setItem('cleanerAuth', authData); } catch (_) {}
      }
    }
    if (!authData) return null;
    return JSON.parse(authData);
  } catch (error) {
    console.error('Error retrieving auth data:', error);
    return null;
  }
};

// Helper function to clear auth data
const clearAuthData = () => {
  try {
    sessionStorage.removeItem('cleanerAuth');
    localStorage.removeItem('cleanerAuth');
  } catch (error) {
    console.error('Error clearing auth data:', error);
  }
};

export function CleanerAuthProvider({ children }: { children: ReactNode }) {
  const [cleaner, setCleaner] = useState<Omit<Cleaner, 'password'> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const authData = getAuthData();

      if (!authData?.uuid) {
        setIsLoading(false);
        return;
      }

      try {
        const verifiedCleaner = await getCleanerById(authData.uuid);
        if (verifiedCleaner) {
          setCleaner(verifiedCleaner);
        } else {
          clearAuthData();
        }
      } catch (error) {
        console.error('Error verifying cleaner:', error);
        clearAuthData();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const logout = () => {
    clearAuthData();
    setCleaner(null);
  };

  return (
    <CleanerAuthContext.Provider value={{ cleaner, isLoading, logout }}>
      {children}
    </CleanerAuthContext.Provider>
  );
}

export function CleanerProtectedRoute({ children }: { children: ReactNode }) {
  return <>{children}</>;
} 