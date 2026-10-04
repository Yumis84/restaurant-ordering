import { NextRequest, NextResponse } from 'next/server'
import { requireStaffContext } from '@/lib/staff/server'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  try {
    await requireStaffContext()
    const { id } = await params
    const body = await request.json().catch(() => null)

    if (!id || !body?.request_id || !body?.to_status || body?.expected_revision === undefined || !body?.expected_status) {
      return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 })
    }

    // Intentionally disabled until the canonical transition RPC has passed
    // isolated acceptance and location authorization is implemented.
    return NextResponse.json({ error: 'KDS_MUTATIONS_NOT_ENABLED' }, { status: 503 })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'STAFF_API_ERROR'
    const status = code === 'STAFF_AUTH_NOT_IMPLEMENTED' ? 503 : 500
    return NextResponse.json({ error: code }, { status })
  }
}
