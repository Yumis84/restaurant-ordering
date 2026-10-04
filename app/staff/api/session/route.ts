import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { staffDatabase, staffSessionCookieName } from '@/lib/staff/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  // Login intentionally remains disabled until a slow password/PIN hash
  // implementation and rate-limit/lockout acceptance tests are in place.
  return NextResponse.json({ error: 'STAFF_LOGIN_NOT_ENABLED' }, { status: 503 })
}

export async function DELETE() {
  const jar = await cookies()
  const token = jar.get(staffSessionCookieName())?.value

  if (token) {
    // Session revocation requires the token hash helper; until login is enabled,
    // there should be no valid cookie issued by this application.
    // Keep logout fail-closed rather than accepting a plaintext-token lookup.
    try {
      staffDatabase()
    } catch {
      // Cookie is still cleared below.
    }
  }

  jar.set(staffSessionCookieName(), '', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })

  return NextResponse.json({ ok: true })
}
