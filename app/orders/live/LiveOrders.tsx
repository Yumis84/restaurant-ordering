'use client'

import { useCallback, useEffect, useState } from 'react'
import { loadActiveOrders, transitionOrder, type ActiveOrder, type OrderStatus } from '@/lib/staff/client'

const next: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'accepted',
  accepted: 'preparing',
  preparing: 'ready',
  ready: 'completed',
}
const action: Partial<Record<OrderStatus, string>> = {
  pending: 'Принять',
  accepted: 'Начать готовить',
  preparing: 'Готов',
  ready: 'Выдан',
}
const labels: Record<OrderStatus, string> = {
  pending: 'Новый', accepted: 'Принят', preparing: 'Готовится', ready: 'Готов',
  completed: 'Выдан', rejected: 'Отклонён', cancelled: 'Отменён',
}

export default function LiveOrders() {
  const [orders,setOrders]=useState<ActiveOrder[]>([])
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState<string|null>(null)
  const [error,setError]=useState('')
  const [offline,setOffline]=useState(false)

  const reconcile=useCallback(async()=>{
    try {
      const fresh=await loadActiveOrders()
      setOrders(fresh)
      setOffline(false)
      setError('')
    } catch (e) {
      setOffline(true)
      setError(e instanceof Error ? e.message : 'STAFF_API_ERROR')
    } finally {
      setLoading(false)
    }
  },[])

  useEffect(()=>{
    void reconcile()
    const timer=setInterval(()=>void reconcile(),15000)
    const onOnline=()=>void reconcile()
    const onOffline=()=>setOffline(true)
    window.addEventListener('online',onOnline)
    window.addEventListener('offline',onOffline)
    return ()=>{
      clearInterval(timer)
      window.removeEventListener('online',onOnline)
      window.removeEventListener('offline',onOffline)
    }
  },[reconcile])

  async function advance(order: ActiveOrder) {
    const toStatus=next[order.status]
    if (!toStatus || offline || busy) return
    setBusy(order.id)
    try {
      const result=await transitionOrder({
        id:order.id,
        toStatus,
        expectedStatus:order.status,
        expectedRevision:order.revision,
      })
      if ('conflict' in result && result.conflict) {
        setOrders(result.orders)
        setError('Заказ уже изменён. Данные обновлены.')
      } else {
        await reconcile()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'TRANSITION_FAILED')
      await reconcile()
    } finally {
      setBusy(null)
    }
  }

  return <main className="min-h-screen bg-slate-100 text-slate-900">
    <header className="flex items-center justify-between gap-4 border-b bg-white p-5 lg:px-8">
      <div><h1 className="text-3xl font-black">Заказы</h1><p className="text-sm text-slate-500">Live KDS · защищённый режим</p></div>
      <button onClick={()=>void reconcile()} disabled={loading} className="min-h-12 rounded-xl border px-4 font-bold">Обновить</button>
    </header>
    {offline && <div role="alert" className="bg-red-800 p-4 text-center font-bold text-white">Нет связи с сервером. Изменение заказов заблокировано.</div>}
    {error && <p role="status" className="px-5 pt-4 text-sm text-red-800">{error}</p>}
    {loading ? <p className="p-8">Загрузка заказов…</p> :
      <section className="grid gap-4 p-5 md:grid-cols-2 lg:grid-cols-3">
        {orders.length===0 ? <p className="p-8 text-slate-500">Активных заказов нет.</p> : orders.map(order=>
          <article key={order.id} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3"><h2 className="text-3xl font-black">№ {order.order_number}</h2><span>{labels[order.status]}</span></div>
            <p className="mt-2 text-sm text-slate-500">rev {order.revision} · {new Date(order.created_at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</p>
            {order.notes && <p className="my-4 rounded-xl bg-amber-50 p-3">{order.notes}</p>}
            <p className="my-4 text-lg font-bold">{Number(order.total).toFixed(0)} ₽</p>
            {next[order.status] && <button disabled={offline||busy!==null} onClick={()=>void advance(order)} className="min-h-14 w-full rounded-xl bg-slate-900 px-4 text-lg font-bold text-white disabled:opacity-40">{busy===order.id?'Сохраняю…':action[order.status]}</button>}
          </article>
        )}
      </section>}
  </main>
}
