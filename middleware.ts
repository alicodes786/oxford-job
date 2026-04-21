import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { DASHBOARD_SESSION_COOKIE, unsealSession } from '@/lib/auth-session';
import { CLEANER_SESSION_COOKIE, unsealCleanerSession } from '@/lib/cleaner-session';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const dashToken = request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value;
  const dashSession = await unsealSession(dashToken);

  const cleanerToken = request.cookies.get(CLEANER_SESSION_COOKIE)?.value;
  const cleanerSession = await unsealCleanerSession(cleanerToken);

  const isCleanerLogin =
    pathname === '/cleaner/login' || pathname.startsWith('/cleaner/login/');

  // Do not redirect /cleaner/login → dashboard when a cookie exists. If the cookie is stale
  // (valid signature but cleaner row gone), that redirect trapped users in a loop with the client.

  const cleanerNeedsAuth = pathname.startsWith('/cleaner') && !isCleanerLogin;

  if (cleanerNeedsAuth && !cleanerSession) {
    const loginUrl = new URL('/cleaner/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === '/login' && dashSession) {
    return NextResponse.redirect(new URL('/dashboard/calendar', request.url));
  }

  const needsDashAuth = pathname === '/' || pathname.startsWith('/dashboard');
  if (needsDashAuth && !dashSession) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('from', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/dashboard/:path*', '/cleaner', '/cleaner/:path*'],
};
