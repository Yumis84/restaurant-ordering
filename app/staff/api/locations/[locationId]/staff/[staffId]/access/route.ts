import { NextRequest, NextResponse } from 'next/server'
import { requireLocationManager, staffDatabase } from '@/lib/staff/server'
export const dynamic='force-dynamic'
type Params={params:Promise<{locationId:string;staffId:string}>}

export async function POST(request:NextRequest,{params}:Params){
  try{
    const {locationId,staffId}=await params
    const actor=await requireLocationManager(locationId)
    if(actor.staffId===staffId) return NextResponse.json({error:'SELF_ACCESS_CHANGE_FORBIDDEN'},{status:400})
    const body=await request.json().catch(()=>null)
    if(typeof body?.active!=='boolean') return NextResponse.json({error:'INVALID_REQUEST'},{status:400})
    const db=staffDatabase()

    // Managers may not alter owners. Owner membership is deliberately protected.
    const {data:target,error:lookupError}=await db.from('staff_location_memberships')
      .select('role').eq('location_id',locationId).eq('staff_id',staffId).single()
    if(lookupError||!target) return NextResponse.json({error:'MEMBERSHIP_NOT_FOUND'},{status:404})
    if(target.role==='owner') return NextResponse.json({error:'OWNER_ACCESS_PROTECTED'},{status:403})
    const actorRole=actor.memberships.find(row=>row.locationId===locationId)?.role
    if(target.role==='manager'&&actorRole!=='owner')
      return NextResponse.json({error:'OWNER_REQUIRED_FOR_MANAGER_ACCESS'},{status:403})

    const {error}=await db.rpc('staff_set_location_access',{p_location_id:locationId,p_staff_id:staffId,p_active:body.active})
    if(error) return NextResponse.json({error:'ACCESS_CHANGE_FAILED'},{status:400})
    return NextResponse.json({ok:true})
  }catch(e){
    const code=e instanceof Error?e.message:'STAFF_API_ERROR'
    return NextResponse.json({error:code},{status:code==='STAFF_UNAUTHORIZED'?401:code==='STAFF_FORBIDDEN'?403:500})
  }
}
