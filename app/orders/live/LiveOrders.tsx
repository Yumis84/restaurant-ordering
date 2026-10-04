'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadActiveOrders, logoutStaff, transitionOrder, type ActiveOrder, type OrderStatus } from '@/lib/staff/client'

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
const columns: { status: OrderStatus; title: string; empty: string; accent: string }[] = [
  { status:'pending', title:'Новые', empty:'Новых заказов нет', accent:'border-amber-400' },
  { status:'accepted', title:'Приняты', empty:'Нет принятых заказов', accent:'border-sky-400' },
  { status:'preparing', title:'Готовятся', empty:'Ничего не готовится', accent:'border-violet-400' },
  { status:'ready', title:'Готовы', empty:'Нет готовых заказов', accent:'border-emerald-500' },
]
function ageMinutes(createdAt:string, now:number) {
  return Math.max(0,Math.floor((now-new Date(createdAt).getTime())/60000))
}

export default function LiveOrders() {
  const router=useRouter()
  const [orders,setOrders]=useState<ActiveOrder[]>([])
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState<string|null>(null)
  const [error,setError]=useState('')
  const [logoutError,setLogoutError]=useState('')
  const [loggingOut,setLoggingOut]=useState(false)
  const [offline,setOffline]=useState(false)
  const [canManageStaff,setCanManageStaff]=useState(false)
  const [cancelId,setCancelId]=useState<string|null>(null)
  const [cancelReason,setCancelReason]=useState('')
  const [now,setNow]=useState(()=>Date.now())
  const [mobileStatus,setMobileStatus]=useState<OrderStatus>('pending')
  const grouped=useMemo(()=>Object.fromEntries(columns.map(column=>[column.status,orders.filter(order=>order.status===column.status)])) as Partial<Record<OrderStatus,ActiveOrder[]>>,[orders])

  const reconcile=useCallback(async()=>{
    try {
      const fresh=await loadActiveOrders()
      setOrders(fresh)
      setOffline(false)
      setError('')
    } catch (e) {
      if (e instanceof Error && e.message==='STAFF_UNAUTHORIZED') {
        router.replace('/orders/live/login')
        return
      }
      setOffline(true)
      setError(e instanceof Error ? e.message : 'STAFF_API_ERROR')
    } finally {
      setLoading(false)
    }
  },[router])

  useEffect(()=>{
    void fetch('/staff/api/me',{credentials:'same-origin',cache:'no-store'})
      .then(r=>r.ok?r.json():null)
      .then(p=>setCanManageStaff(Boolean(p?.locations?.some((x:{role:string})=>x.role==='manager'||x.role==='owner'))))
      .catch(()=>setCanManageStaff(false))
    // Defer the initial reconciliation out of the effect body. Subsequent
    // reconciliations are driven by timer/network events or explicit actions.
    queueMicrotask(()=>void reconcile())
    const timer=setInterval(()=>void reconcile(),15000)
    const clock=setInterval(()=>setNow(Date.now()),30000)
    const onOnline=()=>void reconcile()
    const onOffline=()=>setOffline(true)
    window.addEventListener('online',onOnline)
    window.addEventListener('offline',onOffline)
    return ()=>{
      clearInterval(timer)
      clearInterval(clock)
      window.removeEventListener('online',onOnline)
      window.removeEventListener('offline',onOffline)
    }
  },[reconcile])

  async function mutate(order: ActiveOrder, toStatus: OrderStatus, reason?: string): Promise<boolean> {
    if (offline || busy) return false
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
        return false
      } else {
        await reconcile()
        return true
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'TRANSITION_FAILED')
      await reconcile()
      return false
    } finally {
      setBusy(null)
    }
  }

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    setLogoutError('')
    try {
      await logoutStaff()
      router.replace('/orders/live/login')
      router.refresh()
    } catch {
      setLogoutError('Не удалось подтвердить выход на сервере. Повторите выход.')
    } finally {
      setLoggingOut(false)
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
      <div className="flex gap-2">{canManageStaff&&<button onClick={()=>router.push('/orders/live/staff')} className="min-h-12 rounded-xl border px-4">Сотрудники</button>}<button onClick={()=>void reconcile()} disabled={loading} className="min-h-12 rounded-xl border px-4 font-bold">Обновить</button><button disabled={loggingOut} onClick={()=>void handleLogout()} className="min-h-12 rounded-xl border px-4">Выйти</button></div>
    </header>
    {offline && <div role="alert" className="bg-red-800 p-4 text-center font-bold text-white">Нет связи с сервером. Изменение заказов заблокировано.</div>}
    {logoutError && <p role="alert" className="px-5 pt-4 text-sm text-red-800">{logoutError}</p>}
    {error && <p role="status" className="px-5 pt-4 text-sm text-red-800">{error}</p>}
    {!loading && <nav aria-label="Статус заказов" className="sticky top-0 z-10 flex gap-2 overflow-x-auto border-b bg-white p-3 md:hidden">
      {columns.map(column=>{const count=(grouped[column.status]??[]).length;const selected=mobileStatus===column.status;return <button key={column.status} onClick={()=>setMobileStatus(column.status)} aria-pressed={selected} className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-black ${selected?'bg-slate-950 text-white':'bg-slate-100 text-slate-700'}`}>{column.title} <span className={`ml-1 rounded-full px-2 py-0.5 text-xs ${selected?'bg-white/20':'bg-white'}`}>{count}</span></button>})}
    </nav>}
    {loading ? <p className="p-8">Загрузка заказов…</p> :
      <section className="overflow-x-auto p-3 md:p-4 lg:p-6">
        <div className="grid grid-cols-1 gap-4 md:min-w-[1180px] md:grid-cols-4">
          {columns.map(column=>{
            const list=grouped[column.status]??[]
            return <section key={column.status} className={`rounded-2xl bg-slate-200/70 p-3 ${mobileStatus===column.status?'block':'hidden'} md:block`}>
              <header className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-lg font-black">{column.title}</h2>
                <span className="grid min-h-8 min-w-8 place-items-center rounded-full bg-white px-2 text-sm font-black shadow-sm">{list.length}</span>
              </header>
              <div className="space-y-3">
                {list.length===0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-6 text-center text-sm text-slate-500">{column.empty}</div>}
                {list.map(order=>{
                  const age=ageMinutes(order.created_at,now)
                  return <article key={order.id} className={`rounded-2xl border-t-4 ${column.accent} bg-white p-4 shadow-sm`}>
                    <div className="flex items-start justify-between gap-3">
                      <div><h3 className="text-3xl font-black leading-none">№ {order.order_number}</h3><p className="mt-2 text-xs font-medium text-slate-500">{new Date(order.created_at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</p></div>
                      <div className={`rounded-xl px-3 py-2 text-right ${age>=20?'bg-red-100 text-red-800':age>=10?'bg-amber-100 text-amber-900':'bg-slate-100 text-slate-700'}`}><div className="text-xl font-black">{age} мин</div><div className="text-[10px] font-bold uppercase tracking-wide">ожидание</div></div>
                    </div>
                    {(order.customer_name||order.customer_phone) && <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm"><span className="font-bold">{order.customer_name||'Клиент'}</span>{order.customer_phone && <div className="mt-1 text-slate-600">{order.customer_phone}</div>}</div>}
                    <div className="my-4 divide-y">
                      {order.order_items.map(item=><div key={item.id} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex justify-between gap-3"><span className="text-base font-extrabold"><span className="mr-2 text-xl">{item.quantity}×</span>{item.name_snapshot}</span><span className="shrink-0 text-sm font-semibold">{Number(item.line_total).toFixed(0)} ₽</span></div>
                        {item.order_item_modifiers?.length>0 && <ul className="mt-1 pl-8 text-sm text-slate-600">{item.order_item_modifiers.map(mod=><li key={mod.id}>+ {mod.name_snapshot}{Number(mod.price_delta)!==0 ? ` · ${Number(mod.price_delta).toFixed(0)} ₽` : ''}</li>)}</ul>}
                      </div>)}
                    </div>
                    {order.notes && <div className="my-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><div className="mb-1 font-black">Комментарий</div>{order.notes}</div>}
                    <div className="mb-3 flex items-end justify-between border-t pt-3"><span className="text-xs font-bold uppercase tracking-wide text-slate-400">{labels[order.status]}</span><span className="text-xl font-black">{Number(order.total).toFixed(0)} ₽</span></div>
                    {next[order.status] && <button disabled={offline||busy!==null} onClick={()=>void advance(order)} className="min-h-14 w-full rounded-xl bg-slate-950 px-4 text-lg font-black text-white shadow-sm disabled:opacity-40">{busy===order.id?'Сохраняю…':action[order.status]}</button>}
                    {['pending','accepted','preparing'].includes(order.status) && <button disabled={offline||busy!==null} onClick={()=>{setCancelId(order.id);setCancelReason('')}} className="mt-1 min-h-11 w-full rounded-xl text-sm font-semibold text-slate-500 disabled:opacity-40">Отменить</button>}
                  </article>
                })}
              </div>
            </section>
          })}
        </div>
      </section>}
    {cancelId && <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"><section role="dialog" aria-modal="true" aria-labelledby="live-cancel-title" className="w-full max-w-md rounded-2xl bg-white p-6">
      <h2 id="live-cancel-title" className="text-xl font-bold">Отменить заказ?</h2>
      <label className="mt-4 block">Причина<textarea autoFocus value={cancelReason} onChange={e=>setCancelReason(e.target.value)} className="mt-2 min-h-24 w-full rounded-xl border p-3" /></label>
      <div className="mt-4 flex gap-3"><button onClick={()=>setCancelId(null)} className="min-h-14 flex-1 rounded-xl border">Назад</button><button disabled={offline||busy!==null||!cancelReason.trim()} onClick={()=>{const order=orders.find(o=>o.id===cancelId);if(order) void mutate(order,'cancelled',cancelReason.trim()).then(ok=>{if(ok){setCancelId(null);setCancelReason('')}})}} className="min-h-14 flex-1 rounded-xl bg-red-800 font-bold text-white disabled:opacity-40">Отменить</button></div>
    </section></div>}
  </main>
}
