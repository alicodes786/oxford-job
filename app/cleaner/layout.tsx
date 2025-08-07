'use client';

import { Toaster } from 'sonner';
import { CleanerAuthProvider } from '@/lib/cleaner-auth';

export default function CleanerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CleanerAuthProvider>
      <Toaster position="top-center" />
      {children}
    </CleanerAuthProvider>
  );
} 