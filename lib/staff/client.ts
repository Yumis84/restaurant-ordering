export type OrderStatus =
  | 'pending' | 'accepted' | 'preparing' | 'ready'
  | 'completed' | 'rejected' | 'cancelled'

export type ActiveOrder = {
  id: string
  order_number: number
  location_id: string
  status: OrderStatus
  revision: number
  created_at: string
  updated_at: string
  customer_name: string | null
  customer_phone: string | null
  notes: string | null
  total: number
}

export class OrderConflictError extends Error {
  constructor() {
    super('ORDER_CONFLICT')
  }
}

async function jsonOrError(response: Response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const code = typeof payload?.error === 'string' ? payload.error : 'STAFF_API_ERROR'
    if (response.status === 409 && code === 'ORDER_CONFLICT') throw new OrderConflictError()
    throw new Error(code)
  }
  return payload
}

export async function loadActiveOrders(): Promise<ActiveOrder[]> {
  const response = await fetch('/staff/api/orders/active', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
  })
  const payload = await jsonOrError(response)
  return payload.orders ?? []
}

export async function transitionOrder(input: {
  id: string
  toStatus: OrderStatus
  expectedStatus: OrderStatus
  expectedRevision: number
  reason?: string
}) {
  // Generate once per user action. A transport retry of this same request must
  // reuse the same requestId; a new user action must generate a new one.
  const requestId = crypto.randomUUID()

  const send = () => fetch(`/staff/api/orders/${encodeURIComponent(input.id)}/transition`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to_status: input.toStatus,
      expected_status: input.expectedStatus,
      expected_revision: input.expectedRevision,
      request_id: requestId,
      reason: input.reason,
    }),
  })

  try {
    return await jsonOrError(await send())
  } catch (error) {
    if (error instanceof OrderConflictError) {
      // Conflict is not retried blindly. Caller receives canonical state and
      // must render it before another operator action is allowed.
      const orders = await loadActiveOrders()
      return { conflict: true as const, orders }
    }
    throw error
  }
}
