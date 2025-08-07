'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// Helper function to safely check auth data
const getAuthData = () => {
  try {
    // Try session storage first
    let authData = sessionStorage.getItem('cleanerAuth');
    
    // If not in session storage, try local storage
    if (!authData) {
      authData = localStorage.getItem('cleanerAuth');
    }
    
    if (!authData) return null;
    
    return JSON.parse(authData);
  } catch (error) {
    console.error('Error retrieving auth data:', error);
    return null;
  }
};

export default function CleanerRootPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  
  useEffect(() => {
    setTimeout(() => {
      try {
        console.log('Checking auth status at cleaner root');
        const authData = getAuthData();
        console.log('Auth data found:', authData ? 'yes' : 'no');
        
        if (authData && authData.uuid) {
          console.log('Redirecting authenticated user to dashboard');
          router.replace('/cleaner/dashboard');
        } else {
          console.log('Redirecting unauthenticated user to login');
          router.replace('/cleaner/login');
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        router.replace('/cleaner/login');
      } finally {
        setIsChecking(false);
      }
    }, 500); // Short delay to ensure browser loads properly
  }, [router]);
  
  if (!isChecking) {
    return null;
  }
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="animate-spin h-10 w-10 border-4 border-blue-500 rounded-full border-t-transparent mb-4"></div>
      <p className="text-gray-500">Redirecting to cleaner portal...</p>
    </div>
  );
} 