import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { staffDatabase, staffSessionCookieName, tokenHash } from '@/lib/staff/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (typeof body?.staff_code !== 'string' || typeof body?.pin !== 'string') {
    return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 })
  }

  const db = staffDatabase()
  const { data: verified, error } = await db.rpc('staff_verify_pin', {
    p_staff_code: body.staff_code.trim(),
    p_pin: body.pin,
  })

  if (error || !verified?.length) {
    return NextResponse.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 })
  }

  const token = randomBytes(32).toString('base64url')
  const expires = new Date(Date.now() + 12 * 60 * 60 * 1000)
  const { error: sessionError } = await db.from('staff_sessions').insert({
    staff_id: verified[0].staff_id,
    token_hash: tokenHash(token),
    expires_at: expires.toISOString(),
  })

  if (sessionError) {
    return NextResponse.json({ error: 'SESSION_CREATE_FAILED' }, { status: 500 })
  }

  const response = NextResponse.json({
    ok: true,
    staff: { id: verified[0].staff_id, display_name: verified[0].display_name },
    expires_at: expires.toISOString(),
  })

  response.cookies.set(staffSessionCookieName(), token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    expires,
  })

  return response
}

export async function DELETE() {
  const jar = await cookies()
  const token = jar.get(staffSessionCookieName())?.value

  if (token) {
    const db = staffDatabase()
    await db
      .from('staff_sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('token_hash', tokenHash(token))
      .is('revoked_at', null)
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
