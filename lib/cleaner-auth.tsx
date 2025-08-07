'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
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
const storeAuthData = (data: any) => {
  try {
    const authData = JSON.stringify(data);
    // Try session storage first
    sessionStorage.setItem('cleanerAuth', authData);
    // Also store in local storage as fallback
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
    // Try session storage first
    let authData = sessionStorage.getItem('cleanerAuth');
    
    // If not in session storage, try local storage
    if (!authData) {
      authData = localStorage.getItem('cleanerAuth');
      // If found in local storage, restore to session storage if possible
      if (authData) {
        try {
          sessionStorage.setItem('cleanerAuth', authData);
        } catch (e) {
          console.warn('Could not restore auth data to session storage');
        }
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
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const initAuth = async () => {
      console.log('Initializing cleaner auth, pathname:', pathname);
      
      // Don't redirect if we're already on the login page
      if (pathname === '/cleaner/login') {
        setIsLoading(false);
        return;
      }

      // Check if we have auth data
      const authData = getAuthData();
      console.log('Auth data from storage:', authData ? 'exists' : 'none');
      
      if (!authData || !authData.uuid) {
        console.log('No valid auth data, redirecting to login');
        clearAuthData();
        router.replace('/cleaner/login');
        setIsLoading(false);
        return;
      }
      
      try {
        // Verify cleaner still exists in the database
        const verifiedCleaner = await getCleanerById(authData.uuid);
        
        if (!verifiedCleaner) {
          console.log('Cleaner not found in database, redirecting to login');
          clearAuthData();
          router.replace('/cleaner/login');
          setIsLoading(false);
          return;
        }
        
        console.log('Cleaner verified, setting auth state');
        setCleaner(verifiedCleaner);
        setIsLoading(false);
      } catch (error) {
        console.error('Error verifying cleaner:', error);
        clearAuthData();
        router.replace('/cleaner/login');
        setIsLoading(false);
      }
    };
    
    initAuth();
  }, [pathname, router]);

  const logout = () => {
    console.log('Logging out cleaner');
    clearAuthData();
    setCleaner(null);
    router.replace('/cleaner/login');
  };

  return (
    <CleanerAuthContext.Provider value={{ cleaner, isLoading, logout }}>
      {children}
    </CleanerAuthContext.Provider>
  );
}

export function CleanerProtectedRoute({ children }: { children: ReactNode }) {
  const { cleaner, isLoading } = useCleanerAuth();
  const pathname = usePathname();
  
  // Only show loading state during initial load
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
      </div>
    );
  }

  // If on login page or authenticated, render children
  if (pathname === '/cleaner/login' || cleaner) {
    return <>{children}</>;
  }
  
  // Not authenticated and not on login page, render nothing while redirect happens
  return null;
} 