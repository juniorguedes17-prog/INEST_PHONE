import { NextRequest, NextResponse } from 'next/server';
import { isFeatureRouteEnabled } from './lib/features';

const protectedRoutes = [
  '/dashboard',
  '/price-radar',
  '/import-radar',
  '/pricing',
  '/offers',
  '/products',
  '/customers',
  '/suppliers',
  '/finance',
  '/bi',
  '/settings',
];
const authRoutes = ['/login', '/forgot-password'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessTokenState = getTokenState(request.cookies.get('access_token')?.value);
  const refreshTokenState = getTokenState(request.cookies.get('refresh_token')?.value);
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  if (!isFeatureRouteEnabled(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (isProtectedRoute && accessTokenState !== 'valid' && refreshTokenState !== 'valid') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isAuthRoute && accessTokenState === 'valid') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

function getTokenState(token: string | undefined): 'valid' | 'expired' | 'invalid' | 'missing' {
  if (!token) return 'missing';

  try {
    const payload = token.split('.')[1];
    if (!payload) return 'invalid';
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const parsed = JSON.parse(atob(padded)) as { exp?: unknown };
    if (typeof parsed.exp !== 'number') return 'invalid';
    return parsed.exp * 1000 > Date.now() ? 'valid' : 'expired';
  } catch {
    return 'invalid';
  }
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/price-radar/:path*',
    '/import-radar/:path*',
    '/pricing/:path*',
    '/offers/:path*',
    '/products/:path*',
    '/customers/:path*',
    '/suppliers/:path*',
    '/finance/:path*',
    '/integrations/:path*',
    '/bi/:path*',
    '/settings/:path*',
    '/login',
    '/forgot-password',
  ],
};
