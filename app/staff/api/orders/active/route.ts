import { NextResponse } from 'next/server'
import { requireStaffContext, staffDatabase } from '@/lib/staff/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const staff = await requireStaffContext()
    const db = staffDatabase()

    const { data, error } = await db
      .from('orders')
      .select('id,order_number,location_id,status,revision,created_at,updated_at,customer_name,customer_phone,notes,total,order_items(id,name_snapshot,unit_price,quantity,line_total,order_item_modifiers(id,name_snapshot,price_delta))')
      .in('location_id', staff.locationIds)
      .in('status', ['pending', 'accepted', 'preparing', 'ready'])
      .order('created_at', { ascending: true })

    if (error) throw error

    return NextResponse.json({
      server_time: new Date().toISOString(),
      orders: data ?? [],
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const code = error instanceof Error ? error.message : 'STAFF_API_ERROR'
    const status = code === 'STAFF_AUTH_NOT_IMPLEMENTED' ? 503 : 500
    return NextResponse.json({ error: code }, { status, headers: { 'Cache-Control': 'no-store' } })
  }
}
