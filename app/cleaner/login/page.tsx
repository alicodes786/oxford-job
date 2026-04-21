'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

function safeRedirectPath(from: string | null): string {
  if (!from || !from.startsWith('/cleaner/') || from.startsWith('//')) {
    return '/cleaner/dashboard';
  }
  return from;
}

function CleanerLoginForm() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const searchParams = useSearchParams();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !password) {
      toast.error('Please enter your name and password');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/cleaner/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: name.trim(), password }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        cleaner?: unknown;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || 'Invalid name or password');
      }

      toast.success('Login successful');
      const dest = safeRedirectPath(searchParams.get('from'));
      // Full navigation so the HttpOnly cookie from this response is applied before middleware runs.
      // router.replace() can race and hit /cleaner/dashboard without the cookie → bounce back to login.
      window.location.assign(dest);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'An error occurred during login';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-center text-2xl font-bold">Cleaner Login</CardTitle>
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
                name="name"
                autoComplete="username"
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
                name="password"
                type="password"
                autoComplete="current-password"
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
                  Logging in…
                </>
              ) : (
                'Log in'
              )}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Staff dashboard?{' '}
            <Link
              href="/login"
              className="font-medium text-blue-700 underline-offset-4 hover:text-blue-800 hover:underline"
            >
              Sign in here
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CleanerLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-100">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-hidden />
        </div>
      }
    >
      <CleanerLoginForm />
    </Suspense>
  );
}
