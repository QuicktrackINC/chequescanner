'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

interface LoginResponse {
  access_token: string
  role: string
}

export async function login(formData: FormData) {
  const username = formData.get('username') as string
  const password = formData.get('password') as string

  const apiUrl = process.env.NEXT_PUBLIC_API_URL 
    ? process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '') 
    : process.env.VERCEL_PROJECT_PRODUCTION_URL 
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` 
      : 'http://127.0.0.1:8000'
  
  let success = false
  let data: LoginResponse | null = null

  try {
    const res = await fetch(`${apiUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    })

    if (res.ok) {
      success = true
      data = await res.json()
    }
  } catch (err) {
    console.error('Login fetch failed:', err)
  }

  if (!success || !data) {
    redirect('/login?error=Invalid+username+or+password')
  }

  const cookieStore = await cookies()
  cookieStore.set('auth_token', data.access_token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 1 week
  })
  cookieStore.set('auth_role', data.role, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 1 week
  })
  cookieStore.set('last_active', Date.now().toString(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 2,
  })

  redirect('/')
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete('auth_token')
  cookieStore.delete('auth_role')
  cookieStore.delete('last_active')
  redirect('/login')
}

