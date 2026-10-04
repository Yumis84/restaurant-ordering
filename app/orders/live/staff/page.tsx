'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Location={id:string;name:string;role:'staff'|'manager'|'owner'}
type Member={staff_id:string;role:string;active:boolean;staff_users:{staff_code:string;display_name:string;active:boolean;last_login_at:string|null}|Array<{staff_code:string;display_name:string;active:boolean;last_login_at:string|null}>}

async function api(url:string,init?:RequestInit){
  const response=await fetch(url,{...init,credentials:'same-origin',cache:'no-store'})
  const payload=await response.json().catch(()=>({}))
  if(response.status===401) throw new Error('STAFF_UNAUTHORIZED')
  if(!response.ok) throw new Error(payload?.error||'STAFF_API_ERROR')
  return payload
}

export default function StaffAdminPage(){
  const router=useRouter()
  const [locations,setLocations]=useState<Location[]>([])
  const [locationId,setLocationId]=useState('')
  const [members,setMembers]=useState<Member[]>([])
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)

  const handleError=useCallback((e:unknown)=>{
    if(e instanceof Error&&e.message==='STAFF_UNAUTHORIZED'){router.replace('/orders/live/login');return}
    setError(e instanceof Error?e.message:'STAFF_API_ERROR')
  },[router])

  useEffect(()=>{void api('/staff/api/me').then(p=>{
    const manageable=(p.locations??[]).filter((x:Location)=>x.role==='manager'||x.role==='owner')
    setLocations(manageable); if(manageable[0]) setLocationId(manageable[0].id)
  }).catch(handleError)},[handleError])

  const load=useCallback(async()=>{
    if(!locationId)return
    try{const p=await api(`/staff/api/locations/${locationId}/staff`);setMembers(p.staff??[]);setError('')}catch(e){handleError(e)}
  },[locationId,handleError])
  useEffect(()=>{void load()},[load])

  async function create(event:FormEvent<HTMLFormElement>){
    event.preventDefault(); if(!locationId)return
    const form=new FormData(event.currentTarget)
    setBusy(true);setError('')
    try{
      await api(`/staff/api/locations/${locationId}/staff`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        staff_code:form.get('staff_code'),display_name:form.get('display_name'),pin:form.get('pin'),role:form.get('role')
      })})
      event.currentTarget.reset();await load()
    }catch(e){handleError(e)}finally{setBusy(false)}
  }

  async function access(member:Member,active:boolean){
    setBusy(true)
    try{await api(`/staff/api/locations/${locationId}/staff/${member.staff_id}/access`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({active})});await load()}
    catch(e){handleError(e)}finally{setBusy(false)}
  }

  return <main className="min-h-screen bg-slate-100 p-5 text-slate-900 lg:p-8">
    <div className="mx-auto max-w-4xl">
      <header className="flex items-center justify-between gap-3"><div><h1 className="text-3xl font-black">Сотрудники</h1><p className="text-sm text-slate-500">Доступ к KDS по точкам</p></div><button onClick={()=>router.push('/orders/live')} className="min-h-12 rounded-xl border bg-white px-4">К заказам</button></header>
      {locations.length>1&&<select value={locationId} onChange={e=>setLocationId(e.target.value)} className="mt-5 min-h-12 rounded-xl border bg-white px-3">{locations.map(x=><option key={x.id} value={x.id}>{x.name} · {x.role}</option>)}</select>}
      {locations.length===0&&<p className="mt-6 rounded-xl bg-white p-5">У вас нет прав управления сотрудниками.</p>}
      {error&&<p role="alert" className="mt-4 text-red-800">{error}</p>}

      {locationId&&<><form onSubmit={create} className="mt-6 grid gap-3 rounded-2xl bg-white p-5 md:grid-cols-2">
        <h2 className="text-xl font-bold md:col-span-2">Добавить сотрудника</h2>
        <input required name="display_name" maxLength={80} placeholder="Имя" className="min-h-12 rounded-xl border px-3"/>
        <input required name="staff_code" minLength={3} maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,31}" placeholder="Код: ivan" className="min-h-12 rounded-xl border px-3"/>
        <input required name="pin" type="password" inputMode="numeric" pattern="[0-9]{4,12}" placeholder="PIN, 4–12 цифр" className="min-h-12 rounded-xl border px-3"/>
        <select name="role" className="min-h-12 rounded-xl border px-3"><option value="staff">Сотрудник</option><option value="manager">Менеджер</option></select>
        <button disabled={busy} className="min-h-14 rounded-xl bg-slate-900 font-bold text-white disabled:opacity-40 md:col-span-2">Добавить</button>
      </form>

      <section className="mt-6 space-y-3">{members.map(member=>{const u=Array.isArray(member.staff_users)?member.staff_users[0]:member.staff_users;return <article key={member.staff_id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5">
        <div><h2 className="font-bold">{u?.display_name}</h2><p className="text-sm text-slate-500">{u?.staff_code} · {member.role}</p><p className="text-xs text-slate-400">{u?.last_login_at?`Последний вход: ${new Date(u.last_login_at).toLocaleString('ru-RU')}`:'Ещё не входил'}</p></div>
        {member.role==='owner'?<span className="text-sm font-bold">Владелец</span>:<button disabled={busy} onClick={()=>void access(member,!member.active)} className="min-h-12 rounded-xl border px-4 font-bold">{member.active?'Отключить':'Вернуть доступ'}</button>}
      </article>})}</section></>}
    </div>
  </main>
}
