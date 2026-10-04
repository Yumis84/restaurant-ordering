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
  const [cancelId,setCancelId]=useState<string|null>(null)
  const [cancelReason,setCancelReason]=useState('')

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

  async function mutate(order: ActiveOrder, toStatus: OrderStatus, reason?: string) {
    if (offline || busy) return
    setBusy(order.id)
    try {
      const result=await transitionOrder({
        id:order.id,
        toStatus,
        expectedStatus:order.status,
        expectedRevision:order.revision,
        reason,
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

  async function advance(order: ActiveOrder) {
    const toStatus=next[order.status]
    if (!toStatus || offline || busy) return
    await mutate(order,toStatus)
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
            {(order.customer_name||order.customer_phone) && <p className="mt-3 text-sm"><span className="font-bold">{order.customer_name||'Клиент'}</span>{order.customer_phone ? ` · ${order.customer_phone}` : ''}</p>}
            <div className="my-4 space-y-3">{order.order_items.map(item=><div key={item.id} className="border-t pt-3">
              <div className="flex justify-between gap-3"><span className="font-bold">{item.quantity} × {item.name_snapshot}</span><span>{Number(item.line_total).toFixed(0)} ₽</span></div>
              {item.order_item_modifiers?.length>0 && <ul className="mt-1 text-sm text-slate-600">{item.order_item_modifiers.map(mod=><li key={mod.id}>+ {mod.name_snapshot}{Number(mod.price_delta)!==0 ? ` · ${Number(mod.price_delta).toFixed(0)} ₽` : ''}</li>)}</ul>}
            </div>)}</div>
            {order.notes && <p className="my-4 rounded-xl bg-amber-50 p-3"><span className="font-bold">Комментарий: </span>{order.notes}</p>}
            <p className="my-4 text-lg font-bold">Итого: {Number(order.total).toFixed(0)} ₽</p>
            {next[order.status] && <button disabled={offline||busy!==null} onClick={()=>void advance(order)} className="min-h-14 w-full rounded-xl bg-slate-900 px-4 text-lg font-bold text-white disabled:opacity-40">{busy===order.id?'Сохраняю…':action[order.status]}</button>}
            {['pending','accepted','preparing'].includes(order.status) && <button disabled={offline||busy!==null} onClick={()=>{setCancelId(order.id);setCancelReason('')}} className="mt-2 min-h-12 w-full rounded-xl text-slate-500 disabled:opacity-40">Отменить заказ</button>}
          </article>
        )}
      </section>}
    {cancelId && <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"><section role="dialog" aria-modal="true" aria-labelledby="live-cancel-title" className="w-full max-w-md rounded-2xl bg-white p-6">
      <h2 id="live-cancel-title" className="text-xl font-bold">Отменить заказ?</h2>
      <label className="mt-4 block">Причина<textarea autoFocus value={cancelReason} onChange={e=>setCancelReason(e.target.value)} className="mt-2 min-h-24 w-full rounded-xl border p-3" /></label>
      <div className="mt-4 flex gap-3"><button onClick={()=>setCancelId(null)} className="min-h-14 flex-1 rounded-xl border">Назад</button><button disabled={offline||busy!==null||!cancelReason.trim()} onClick={()=>{const order=orders.find(o=>o.id===cancelId);if(order) void mutate(order,'cancelled',cancelReason.trim()).then(()=>{setCancelId(null);setCancelReason('')})}} className="min-h-14 flex-1 rounded-xl bg-red-800 font-bold text-white disabled:opacity-40">Отменить</button></div>
    </section></div>}
  </main>
}
