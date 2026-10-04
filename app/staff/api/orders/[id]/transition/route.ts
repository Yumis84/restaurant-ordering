import { NextRequest, NextResponse } from 'next/server'
import { requireStaffContext, staffDatabase } from '@/lib/staff/server'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }
const statuses = new Set(['pending','accepted','preparing','ready','completed','rejected','cancelled'])

function rpcErrorCode(message: string) {
  for (const code of ['ORDER_CONFLICT','ORDER_NOT_FOUND','INVALID_STATUS_TRANSITION','REASON_REQUIRED','FORBIDDEN']) {
    if (message.includes(code)) return code
  }
  return 'TRANSITION_FAILED'
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const staff = await requireStaffContext()
    const { id } = await params
    const body = await request.json().catch(() => null)

    if (
      !id ||
      typeof body?.request_id !== 'string' ||
      typeof body?.to_status !== 'string' ||
      typeof body?.expected_status !== 'string' ||
      !Number.isSafeInteger(body?.expected_revision) ||
      body.expected_revision < 0 ||
      !statuses.has(body.to_status) ||
      !statuses.has(body.expected_status)
    ) {
      return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 })
    }

    const reason = typeof body.reason === 'string' ? body.reason.trim() : null
    if (['rejected','cancelled'].includes(body.to_status) && !reason) {
      return NextResponse.json({ error: 'REASON_REQUIRED' }, { status: 400 })
    }

    const db = staffDatabase()

    // Authorization is server-derived. Never trust a location_id from the client.
    const { data: authorizedOrder, error: lookupError } = await db
      .from('orders')
      .select('id')
      .eq('id', id)
      .in('location_id', staff.locationIds)
      .maybeSingle()

    if (lookupError) throw lookupError
    if (!authorizedOrder) {
      // Do not reveal whether an order exists at another location.
      return NextResponse.json({ error: 'ORDER_NOT_FOUND' }, { status: 404 })
    }

    const { data, error } = await db.rpc('staff_transition_order', {
      p_order_id: id,
      p_to_status: body.to_status,
      p_expected_status: body.expected_status,
      p_expected_revision: body.expected_revision,
      p_request_id: body.request_id,
      p_actor_type: 'staff',
      p_actor_id: staff.staffId,
      p_channel: 'kds',
      p_reason: reason,
    })

    if (error) {
      const code = rpcErrorCode(error.message)
      const status =
        code === 'ORDER_CONFLICT' ? 409 :
        code === 'ORDER_NOT_FOUND' ? 404 :
        ['INVALID_STATUS_TRANSITION','REASON_REQUIRED'].includes(code) ? 400 :
        code === 'FORBIDDEN' ? 403 : 500
      return NextResponse.json({ error: code }, { status, headers: { 'Cache-Control': 'no-store' } })
    }

    const result = Array.isArray(data) ? data[0] : data
    return NextResponse.json({ order: result }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'STAFF_API_ERROR'
    const status =
      code === 'STAFF_UNAUTHORIZED' ? 401 :
      code === 'STAFF_FORBIDDEN' ? 403 :
      code === 'STAFF_BACKEND_NOT_CONFIGURED' ? 503 : 500
    return NextResponse.json({ error: code }, { status, headers: { 'Cache-Control': 'no-store' } })
  }
}
