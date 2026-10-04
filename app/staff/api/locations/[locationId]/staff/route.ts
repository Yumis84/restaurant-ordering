import { NextRequest, NextResponse } from 'next/server'
import { requireLocationManager, staffDatabase } from '@/lib/staff/server'
export const dynamic='force-dynamic'
type Params={params:Promise<{locationId:string}>}

export async function GET(_:NextRequest,{params}:Params){
  try{
    const {locationId}=await params
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

export async function POST(request:NextRequest,{params}:Params){
  try{
    const {locationId}=await params
    await requireLocationManager(locationId)
    const body=await request.json().catch(()=>null)
    if(typeof body?.staff_code!=='string'||typeof body?.display_name!=='string'||typeof body?.pin!=='string')
      return NextResponse.json({error:'INVALID_REQUEST'},{status:400})
    const role=body.role==='manager'?'manager':'staff'
    const {data,error}=await staffDatabase().rpc('staff_create_for_location',{
      p_location_id:locationId,p_staff_code:body.staff_code,p_display_name:body.display_name,p_pin:body.pin,p_role:role
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
