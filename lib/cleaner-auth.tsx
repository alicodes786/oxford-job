'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import type { Cleaner } from './models';

interface CleanerAuthContextType {
  cleaner: Omit<Cleaner, 'password'> & { uuid: string } | null;
  isLoading: boolean;
  logout: () => Promise<void>;
}

const CleanerAuthContext = createContext<CleanerAuthContextType>({
  cleaner: null,
  isLoading: true,
  logout: async () => {},
});

export const useCleanerAuth = () => useContext(CleanerAuthContext);

export function CleanerAuthProvider({ children }: { children: ReactNode }) {
  const [cleaner, setCleaner] = useState<(Omit<Cleaner, 'password'> & { uuid: string }) | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/cleaner/auth/me', {
          credentials: 'include',
          cache: 'no-store',
        });
        const data = (await res.json()) as {
          cleaner: (Omit<Cleaner, 'password'> & { uuid: string }) | null;
        };
        if (!cancelled) {
          setCleaner(data.cleaner ?? null);
        }
      } catch {
        if (!cancelled) setCleaner(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/cleaner/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      setCleaner(null);
    }
  }, []);

  return (
    <CleanerAuthContext.Provider value={{ cleaner, isLoading, logout }}>
      {children}
    </CleanerAuthContext.Provider>
  );
}

export function CleanerProtectedRoute({ children }: { children: ReactNode }) {
  const { cleaner, isLoading } = useCleanerAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !cleaner) {
      router.replace('/cleaner/login');
    }
  }, [isLoading, cleaner, router]);

  if (isLoading || !cleaner) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
