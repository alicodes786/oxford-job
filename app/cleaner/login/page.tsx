'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authenticateCleaner } from '@/lib/models';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

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

export default function CleanerLoginPage() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Clear any existing auth data when the login page loads
  useEffect(() => {
    try {
      sessionStorage.removeItem('cleanerAuth');
      localStorage.removeItem('cleanerAuth');
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !password) {
      toast.error('Please enter your name and password');
      return;
    }
    
    setIsLoading(true);
    try {
      console.log('Attempting login for cleaner:', name);
      const cleaner = await authenticateCleaner(name, password);
      
      if (cleaner) {
        console.log('Authentication successful, storing credentials');
        // Store cleaner details in storage
        const storageSuccess = storeAuthData(cleaner);
        
        if (!storageSuccess) {
          toast.error('Could not store login information. Please check your browser settings.');
          setIsLoading(false);
          return;
        }
        
        toast.success('Login successful');
        console.log('Redirecting to dashboard...');
        
        // Use replace to avoid history issues
        setTimeout(() => {
          router.replace('/cleaner/dashboard');
        }, 100);
      } else {
        console.log('Authentication failed for cleaner:', name);
        toast.error('Invalid name or password');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('An error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Cleaner Login</CardTitle>
          <CardDescription className="text-center">
            Enter your credentials to access your cleaning schedule
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="name"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                'Log in'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 