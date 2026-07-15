import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import * as jose from 'jose';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  
  // If no token, redirect to login
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Create the redirect response first
  const response = NextResponse.redirect(new URL('/', request.url))
  
  // Attach cookies directly to the redirect response to ensure they are sent
  response.cookies.set('auth_token', token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/'
  })

  // Try to parse the role out of the token securely
  try {
    const secret = new TextEncoder().encode(process.env.SSO_SHARED_SECRET || 'quicktrack-dev-secret-change-in-production')
    const { payload } = await jose.jwtVerify(token, secret)
    
    if (payload.role) {
      let mappedRole = 'STAFF'
      if (payload.role === 'SUPERADMIN') mappedRole = 'SUPERADMIN'
      else if (payload.role === 'ADMIN') mappedRole = 'ADMIN'

      response.cookies.set('auth_role', mappedRole, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 24 hours
        path: '/'
      })
    }
  } catch (e) {
    console.error("Failed to parse SSO token role:", e)
  }
  
  response.cookies.set('last_active', Date.now().toString(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 2,
    path: '/'
  })

  return response
}
