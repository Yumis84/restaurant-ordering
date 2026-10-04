import 'server-only'
import { createHash } from 'crypto'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export type StaffContext = {
  staffId: string
  locationIds: string[]
}

const SESSION_COOKIE = 'ro_staff_session'

export function staffDatabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('STAFF_BACKEND_NOT_CONFIGURED')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function requireStaffContext(): Promise<StaffContext> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) throw new Error('STAFF_UNAUTHORIZED')

  const db = staffDatabase()
  const now = new Date().toISOString()
  const { data: session, error } = await db
    .from('staff_sessions')
    .select('id,staff_id,expires_at,revoked_at,staff_users!inner(active)')
    .eq('token_hash', tokenHash(token))
    .is('revoked_at', null)
    .gt('expires_at', now)
    .single()

  if (error || !session) throw new Error('STAFF_UNAUTHORIZED')
  const user = Array.isArray(session.staff_users) ? session.staff_users[0] : session.staff_users
  if (!user?.active) throw new Error('STAFF_UNAUTHORIZED')

  const { data: memberships, error: membershipError } = await db
    .from('staff_location_memberships')
    .select('location_id')
    .eq('staff_id', session.staff_id)
    .eq('active', true)

  if (membershipError || !memberships?.length) throw new Error('STAFF_FORBIDDEN')

  return {
    staffId: session.staff_id,
    locationIds: memberships.map(row => row.location_id),
  }
}

export function staffSessionCookieName() {
  return SESSION_COOKIE
}
