import { NextResponse } from 'next/server'
import { requireStaffContext, staffDatabase } from '@/lib/staff/server'

export const dynamic='force-dynamic'

export async function GET(){
  try{
    const staff=await requireStaffContext()
    const db=staffDatabase()
    const {data:locations,error}=await db.from('locations')
      .select('id,name')
      .in('id',staff.locationIds)
      .eq('active',true)
    if(error) throw error

    const names=new Map((locations??[]).map(row=>[row.id,row.name]))
    return NextResponse.json({
      staff_id:staff.staffId,
      locations:staff.memberships
        .filter(row=>names.has(row.locationId))
        .map(row=>({id:row.locationId,name:names.get(row.locationId),role:row.role}))
    },{headers:{'Cache-Control':'no-store'}})
  }catch(e){
    const code=e instanceof Error?e.message:'STAFF_API_ERROR'
    return NextResponse.json({error:code},{status:code==='STAFF_UNAUTHORIZED'?401:code==='STAFF_FORBIDDEN'?403:500})
  }
}
