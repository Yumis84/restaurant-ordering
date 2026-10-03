'use client'

import { useEffect, useState } from 'react'

type Status = 'pending' | 'accepted' | 'preparing' | 'ready' | 'completed' | 'cancelled'
type Ticket = { id: number; status: Status; created: number; readyAt?: number; items: string[]; note?: string; changed?: boolean; reason?: string }
const next: Partial<Record<Status, Status>> = { pending: 'accepted', accepted: 'preparing', preparing: 'ready', ready: 'completed' }
const action: Partial<Record<Status, string>> = { pending: 'Принять', accepted: 'Начать готовить', preparing: 'Готов', ready: 'Выдан' }
const labels: Record<Status, string> = { pending: 'Новый', accepted: 'Принят', preparing: 'Готовится', ready: 'Готов', completed: 'Выдан', cancelled: 'Отменён' }
const columns: { title: string; states: Status[]; color: string }[] = [
  { title: 'Новые', states: ['pending'], color: 'border-amber-400' },
  { title: 'Готовятся', states: ['accepted', 'preparing'], color: 'border-blue-400' },
  { title: 'Готовы', states: ['ready'], color: 'border-emerald-400' },
]
function samples(now: number): Ticket[] {
  return [
    { id: 101, status: 'pending', created: now - 120000, items: ['2 × Шаверма классическая', '+ Сыр · без лука'], note: 'Пример: соус отдельно' },
    { id: 102, status: 'accepted', created: now - 300000, items: ['1 × Шаверма куриная', '1 × Чай'] },
    { id: 103, status: 'preparing', created: now - 540000, items: ['1 × Шаверма овощная'], changed: true, note: 'Пример изменения: без острого соуса' },
    { id: 104, status: 'ready', created: now - 1800000, readyAt: now - 960000, items: ['2 × Шаверма классическая'] },
  ]
}

export default function OrdersPreview() {
  const [orders, setOrders] = useState<Ticket[]>([])
  const [now, setNow] = useState(0)
  const [history, setHistory] = useState(false)
  const [tab, setTab] = useState(0)
  const [offline, setOffline] = useState(false)
  const [notice, setNotice] = useState('')
  const [cancelId, setCancelId] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  useEffect(() => {
    const tick = () => setNow(Date.now())
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [])
  function advance(id: number, expected: Status) {
    if (offline) return
    setOrders(current => current.map(order => {
      if (order.id !== id || order.status !== expected || order.changed) return order
      const status = next[order.status]
      return status ? { ...order, status, ...(status === 'ready' ? { readyAt: Date.now() } : {}) } : order
    }))
  }
  function cancel() {
    if (offline || !reason.trim()) return
    setOrders(current => current.map(order => order.id === cancelId && ['pending', 'accepted', 'preparing'].includes(order.status)
      ? { ...order, status: 'cancelled', reason: reason.trim() } : order))
    setCancelId(null)
    setReason('')
  }
  const finished = orders.filter(o => ['completed', 'cancelled'].includes(o.status))
  function card(order: Ticket) {
    const minutes = Math.max(0, Math.floor((now - (order.status === 'ready' ? order.readyAt ?? order.created : order.created)) / 60000))
    const done = ['completed', 'cancelled'].includes(order.status)
    return <article key={order.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3"><h3 className="text-3xl font-black">№ {order.id}</h3><span className={order.status === 'ready' && minutes >= 15 ? 'font-bold text-red-700' : 'text-slate-600'}>{order.status === 'ready' ? 'Готов ' : ''}{minutes} мин</span></div>
      <p className="mt-2 text-sm text-slate-500">Самовывоз · {labels[order.status]}</p>
      <ul className="my-5 space-y-2 text-lg font-semibold">{order.items.map((item, i) => <li key={i}>{item}</li>)}</ul>
      {order.note && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-amber-950">{order.note}</p>}
      {order.changed && !done && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3"><p className="font-bold text-red-800">Заказ изменён</p><button disabled={offline} onClick={() => setOrders(current => current.map(o => o.id === order.id ? { ...o, changed: false } : o))} className="mt-3 min-h-14 w-full rounded-xl bg-red-800 px-3 font-bold text-white disabled:opacity-40">Подтвердить изменения</button></div>}
      <p className="mb-4 text-sm text-slate-500">Оплата при получении</p>
      {order.reason && <p className="mb-4 text-sm">Причина отмены: {order.reason}</p>}
      {!done && <button disabled={offline || order.changed} onClick={() => advance(order.id, order.status)} className="min-h-14 w-full rounded-xl bg-slate-900 px-4 text-lg font-bold text-white disabled:opacity-40">{action[order.status]}</button>}
      {['pending', 'accepted', 'preparing'].includes(order.status) && <button disabled={offline} onClick={() => { setCancelId(order.id); setReason('') }} className="mt-2 min-h-12 w-full rounded-xl text-slate-500 disabled:opacity-40">Отменить заказ</button>}
    </article>
  }
  return <main className="min-h-screen bg-slate-100 text-slate-900">
    <div className="bg-amber-100 px-5 py-3 text-center text-sm font-semibold">Демонстрация интерфейса · реальные заказы не подключены · изменения сбросятся при обновлении</div>
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white p-5 lg:px-8">
      <div><h1 className="text-3xl font-black">Заказы</h1><p className="text-sm text-slate-500">Шаваллея · Каштановая Аллея, 73а</p></div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setHistory(false)} aria-pressed={!history} className="min-h-12 rounded-xl border px-4 font-bold">Активные</button>
        <button onClick={() => setHistory(true)} aria-pressed={history} className="min-h-12 rounded-xl border px-4 font-bold">История · {finished.length}</button>
        <button onClick={() => { setOrders(samples(Date.now())); setHistory(false); setNotice('Загружены вымышленные заказы для проверки интерфейса') }} className="min-h-12 rounded-xl bg-slate-900 px-4 font-bold text-white">Загрузить примеры</button>
        <button onClick={() => setOffline(v => !v)} aria-pressed={offline} className="min-h-12 rounded-xl border px-4">{offline ? 'Убрать имитацию обрыва' : 'Проверить обрыв связи'}</button>
      </div>
    </header>
    {offline && <div role="alert" className="bg-red-800 p-4 text-center font-bold text-white">Имитация: нет связи. Действия заблокированы, последние данные сохранены на экране.</div>}
    <p role="status" className="px-5 pt-3 text-sm text-slate-600">{notice}</p>
    {!history && <nav aria-label="Статусы заказов" className="flex gap-2 overflow-auto p-4 lg:hidden">{columns.map((column, i) => <button key={column.title} aria-pressed={tab === i} onClick={() => setTab(i)} className={'min-h-12 whitespace-nowrap rounded-xl px-4 font-bold ' + (tab === i ? 'bg-slate-900 text-white' : 'bg-white')}>{column.title} · {orders.filter(o => column.states.includes(o.status)).length}</button>)}</nav>}
    {history ? <section aria-label="История" className="grid gap-4 p-5 md:grid-cols-2 lg:grid-cols-3">{finished.length ? finished.map(card) : <p className="p-8 text-slate-500">Завершённых заказов пока нет.</p>}</section>
      : <div className="grid gap-5 p-5 lg:grid-cols-3 lg:p-8">{columns.map((column, i) => {
        const tickets = orders.filter(o => column.states.includes(o.status))
        return <section key={column.title} className={(tab === i ? '' : 'hidden lg:block ') + 'rounded-2xl border-t-4 ' + column.color}>
          <h2 className="flex items-center justify-between p-4 text-xl font-bold">{column.title}<span className="rounded-full bg-white px-3 py-1">{tickets.length}</span></h2>
          <div className="space-y-4">{tickets.length ? tickets.map(card) : <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">Заказов нет</p>}</div>
        </section>
      })}</div>}
    {cancelId !== null && <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"><section role="dialog" aria-modal="true" aria-labelledby="cancel-title" className="w-full max-w-md rounded-2xl bg-white p-6" onKeyDown={e => { if (e.key === 'Escape') setCancelId(null) }}>
      <h2 id="cancel-title" className="text-xl font-bold">Отменить заказ № {cancelId}?</h2>
      <label className="mt-4 block">Причина отмены<textarea autoFocus value={reason} onChange={e => setReason(e.target.value)} className="mt-2 min-h-24 w-full rounded-xl border p-3" /></label>
      <div className="mt-4 flex gap-3"><button onClick={() => setCancelId(null)} className="min-h-14 flex-1 rounded-xl border">Назад</button><button disabled={offline || !reason.trim()} onClick={cancel} className="min-h-14 flex-1 rounded-xl bg-red-800 font-bold text-white disabled:opacity-40">Отменить заказ</button></div>
    </section></div>}
  </main>
}
