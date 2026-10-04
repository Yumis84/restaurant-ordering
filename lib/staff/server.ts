import 'server-only'
import { createClient } from '@supabase/supabase-js'

export type StaffContext = {
  staffId: string
  locationIds: string[]
}

export function staffDatabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('STAFF_BACKEND_NOT_CONFIGURED')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

// Fail closed until the approved staff-session mechanism is implemented.
// Never accept location authorization directly from request JSON/query params.
export async function requireStaffContext(): Promise<StaffContext> {
  throw new Error('STAFF_AUTH_NOT_IMPLEMENTED')
}
