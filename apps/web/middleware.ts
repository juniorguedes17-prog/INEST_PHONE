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
  const hasAccessToken = Boolean(request.cookies.get('access_token'));
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  if (!isFeatureRouteEnabled(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (isProtectedRoute && !hasAccessToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isAuthRoute && hasAccessToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
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
