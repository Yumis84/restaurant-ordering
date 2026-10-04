'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function StaffLoginPage() {
  const router=useRouter()
  const [staffId,setStaffId]=useState('')
  const [pin,setPin]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!staffId.trim() || !pin) return
    setBusy(true); setError('')
    try {
      const response=await fetch('/staff/api/session',{
        method:'POST',
        credentials:'same-origin',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({staff_id:staffId.trim(),pin}),
      })
      const payload=await response.json().catch(()=>({}))
      if (!response.ok) throw new Error(payload?.error||'LOGIN_FAILED')
      setPin('')
      router.replace('/orders/live')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error && e.message==='INVALID_CREDENTIALS'
        ? 'Неверный сотрудник или PIN.'
        : 'Не удалось войти. Попробуйте ещё раз.')
    } finally { setBusy(false) }
  }

  return <main className="grid min-h-screen place-items-center bg-slate-100 p-4 text-slate-900">
    <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-black">Вход сотрудника</h1>
      <p className="mt-1 text-sm text-slate-500">Restaurant Ordering · KDS</p>
      <label className="mt-6 block text-sm font-bold">ID сотрудника
        <input autoComplete="username" value={staffId} onChange={e=>setStaffId(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border px-3" />
      </label>
      <label className="mt-4 block text-sm font-bold">PIN
        <input type="password" inputMode="numeric" autoComplete="current-password" value={pin} onChange={e=>setPin(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border px-3 text-2xl tracking-widest" />
      </label>
      {error && <p role="alert" className="mt-4 text-sm text-red-800">{error}</p>}
      <button disabled={busy||!staffId.trim()||!pin} className="mt-6 min-h-14 w-full rounded-xl bg-slate-900 text-lg font-bold text-white disabled:opacity-40">{busy?'Вход…':'Войти'}</button>
    </form>
  </main>
}
