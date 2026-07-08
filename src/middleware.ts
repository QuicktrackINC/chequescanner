import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

// ─── Rate Limiting (in-memory, per-IP) ────────────────────────────────
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

// ─── Session timeout ──────────────────────────────────────────────────
const SESSION_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Ignore Next.js internals, static assets, favicon
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  // ─── Login page handling ─────────────────────────────────────────────
  if (pathname === '/login') {
    const token = request.cookies.get('auth_token');
    // Already authenticated → redirect home
    if (token?.value) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // POST to login page (form submission) — rate-limit check
    if (request.method === 'POST') {
      const record = loginAttempts.get(ip);
      const now = Date.now();

      if (record && record.lockedUntil > now) {
        const remaining = Math.ceil((record.lockedUntil - now) / 60000);
        return NextResponse.redirect(
          new URL(`/login?error=Too+many+attempts.+Try+again+in+${remaining}+min.`, request.url)
        );
      }
    }

    return NextResponse.next();
  }

  // ─── Track failed login attempts via cookie set by actions.ts ────────
  // (The action sets a cookie `login_failed` on bad creds; we read it here)
  const loginFailed = request.cookies.get('login_failed');
  if (loginFailed?.value === '1') {
    const now = Date.now();
    const record = loginAttempts.get(ip) ?? { count: 0, lockedUntil: 0 };
    record.count += 1;
    if (record.count >= MAX_ATTEMPTS) {
      record.lockedUntil = now + LOCKOUT_MS;
      record.count = 0;
    }
    loginAttempts.set(ip, record);
  }

  // ─── All other routes: require authentication ─────────────────────────
  const token = request.cookies.get('auth_token');
  const lastActive = request.cookies.get('last_active');

  if (!token?.value || token.value === 'authenticated') {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('auth_token');
    response.cookies.delete('auth_role');
    response.cookies.delete('last_active');
    return response;
  }

  // Session timeout check
  if (lastActive?.value) {
    const lastActiveTime = parseInt(lastActive.value, 10);
    if (Date.now() - lastActiveTime > SESSION_TIMEOUT_MS) {
      // Expired — clear cookies and redirect to login
      const response = NextResponse.redirect(new URL('/login?error=Session+expired.+Please+sign+in+again.', request.url));
      response.cookies.delete('auth_token');
      response.cookies.delete('auth_role');
      response.cookies.delete('last_active');
      return response;
    }
  }

  // Refresh last_active timestamp on every valid request
  const response = NextResponse.next();
  response.cookies.set('last_active', Date.now().toString(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 2, // 2 hours
    path: '/',
  });

  return response;
}

export const config = {
  matcher: ['/((?!api|sso-login|_next/static|_next/image|favicon.ico).*)'],
};
