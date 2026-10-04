import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function LiveOrdersLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (process.env.KDS_LIVE_ENABLED !== 'true') redirect('/orders')
  return children
}
