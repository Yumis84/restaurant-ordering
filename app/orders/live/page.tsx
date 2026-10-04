import { redirect } from 'next/navigation'
import LiveOrders from './LiveOrders'

export const dynamic = 'force-dynamic'

export default function LiveOrdersPage() {
  if (process.env.KDS_LIVE_ENABLED !== 'true') redirect('/orders')
  return <LiveOrders />
}
