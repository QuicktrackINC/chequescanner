import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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

  // Try to parse the role out of the token
  try {
    const payloadStr = atob(token.split('.')[1])
    const payload = JSON.parse(payloadStr)
    if (payload.role) {
      response.cookies.set('auth_role', payload.role, {
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
