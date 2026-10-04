import { NextRequest, NextResponse } from 'next/server'
import { requireLocationManager, staffDatabase, requireSameOrigin, requireKdsLiveEnabled, isUuid, rejectOversizedJson } from '@/lib/staff/server'
export const dynamic='force-dynamic'
type Params={params:Promise<{locationId:string}>}

export async function GET(_:NextRequest,{params}:Params) {
  try { requireKdsLiveEnabled() } catch { return NextResponse.json({ error: 'KDS_NOT_ENABLED' }, { status: 404 }) }
  try{
    const {locationId}=await params
    if(!isUuid(locationId)) return NextResponse.json({error:'INVALID_LOCATION_ID'},{status:400})
    await requireLocationManager(locationId)
    const db=staffDatabase()
    const {data,error}=await db.from('staff_location_memberships')
      .select('staff_id,role,active,staff_users!inner(staff_code,display_name,active,last_login_at)')
      .eq('location_id',locationId)
    if(error) throw error
    return NextResponse.json({staff:data},{headers:{'Cache-Control':'no-store'}})
  }catch(e){
    const code=e instanceof Error?e.message:'STAFF_API_ERROR'
    return NextResponse.json({error:code},{status:code==='STAFF_UNAUTHORIZED'?401:code==='STAFF_FORBIDDEN'?403:500})
  }
}

export async function POST(request:NextRequest,{params}:Params) {
  try { requireKdsLiveEnabled() } catch { return NextResponse.json({ error: 'KDS_NOT_ENABLED' }, { status: 404 }) }
  try{
    await requireSameOrigin(); rejectOversizedJson(request, 4096)
    const {locationId}=await params
    if(!isUuid(locationId)) return NextResponse.json({error:'INVALID_LOCATION_ID'},{status:400})
    const actor=await requireLocationManager(locationId)
    const body=await request.json().catch(()=>null)
    if(typeof body?.staff_code!=='string'||typeof body?.display_name!=='string'||typeof body?.pin!=='string')
      return NextResponse.json({error:'INVALID_REQUEST'},{status:400})
    const staffCode=body.staff_code.trim().toLowerCase()
    const displayName=body.display_name.trim()
    if(!/^[a-z0-9][a-z0-9_-]{2,31}$/.test(staffCode))
      return NextResponse.json({error:'INVALID_STAFF_CODE'},{status:400})
    if(displayName.length<1||displayName.length>80)
      return NextResponse.json({error:'INVALID_DISPLAY_NAME'},{status:400})
    if(!/^[0-9]{6,12}$/.test(body.pin))
      return NextResponse.json({error:'INVALID_PIN'},{status:400})
    const actorRole=actor.memberships.find(row=>row.locationId===locationId)?.role
    if(body.role!==undefined && body.role!=='staff' && body.role!=='manager')
      return NextResponse.json({error:'INVALID_ROLE'},{status:400})
    const role=body.role ?? 'staff'
    if(role==='manager'&&actorRole!=='owner')
      return NextResponse.json({error:'OWNER_REQUIRED_FOR_MANAGER_ROLE'},{status:403})
    const {data,error}=await staffDatabase().rpc('staff_create_for_location',{
      p_location_id:locationId,p_staff_code:staffCode,p_display_name:displayName,p_pin:body.pin,p_role:role
    })
    if(error){
      const code=error.message.includes('STAFF_CODE_EXISTS')?'STAFF_CODE_EXISTS':'STAFF_CREATE_FAILED'
      return NextResponse.json({error:code},{status:code==='STAFF_CODE_EXISTS'?409:400})
    }
    return NextResponse.json({staff:Array.isArray(data)?data[0]:data},{status:201})
  }catch(e){
    const code=e instanceof Error?e.message:'STAFF_API_ERROR'
    return NextResponse.json({error:code},{status:code==='STAFF_UNAUTHORIZED'?401:code==='STAFF_FORBIDDEN'?403:500})
  }
}
