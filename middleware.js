import { NextResponse } from 'next/server';

function readTokenPayload(token) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('auth')?.value;

  if (!token) {
    if (pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/login?portal=admin', request.url));
    }
    if (pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/login?portal=user', request.url));
    }
    if (pathname.startsWith('/tags')) {
      return NextResponse.redirect(new URL('/login?portal=user', request.url));
    }
    return NextResponse.next();
  }

  const payload = readTokenPayload(token);
  const isExpired = payload?.exp ? payload.exp * 1000 <= Date.now() : true;
  if (isExpired) {
    const response = NextResponse.redirect(new URL('/login?portal=user', request.url));
    response.cookies.delete('auth');
    return response;
  }

  const role = payload?.role;
  if (pathname.startsWith('/admin') && role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (pathname.startsWith('/dashboard') && role === 'admin') {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  if (pathname.startsWith('/tags') && role === 'admin') {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  if (pathname === '/login' && role === 'admin') {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  if (pathname === '/login' && role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/dashboard/:path*', '/tags/:path*', '/login']
};
