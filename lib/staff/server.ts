import 'server-only'
import { createHash } from 'crypto'
import { cookies, headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export type StaffContext = {
  staffId: string
  locationIds: string[]
  memberships: Array<{ locationId: string; role: 'staff'|'manager'|'owner' }>
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
    .select('location_id,role')
    .eq('staff_id', session.staff_id)
    .eq('active', true)

  if (membershipError || !memberships?.length) throw new Error('STAFF_FORBIDDEN')

  return {
    staffId: session.staff_id,
    locationIds: memberships.map(row => row.location_id),
    memberships: memberships.map(row => ({
      locationId: row.location_id,
      role: row.role as 'staff'|'manager'|'owner',
    })),
  }
}

export function staffSessionCookieName() {
  return SESSION_COOKIE
}

export async function requireLocationManager(locationId: string) {
  const staff = await requireStaffContext()
  const membership = staff.memberships.find(row => row.locationId === locationId)
  if (!membership || !['manager','owner'].includes(membership.role)) {
    throw new Error('STAFF_FORBIDDEN')
  }
  return staff
}

export async function requireSameOrigin() {
  const h = await headers()
  const origin = h.get('origin')
  const host = h.get('x-forwarded-host') || h.get('host')
  const proto = h.get('x-forwarded-proto') || 'https'

  if (!origin || !host) throw new Error('INVALID_ORIGIN')

  let parsed: URL
  try { parsed = new URL(origin) } catch { throw new Error('INVALID_ORIGIN') }

  const expected = `${proto}://${host}`
  if (parsed.origin !== expected) throw new Error('INVALID_ORIGIN')
}

export function requireKdsLiveEnabled() {
  if (process.env.KDS_LIVE_ENABLED !== 'true') {
    throw new Error('KDS_NOT_ENABLED')
  }
}
