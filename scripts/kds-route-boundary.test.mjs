// Run with Node >=22.13: node --test scripts/kds-route-boundary.test.mjs
// Executes real route bodies with mocked framework/database dependencies.
// This is not HTTP, PostgreSQL, RLS, or browser acceptance.
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import assert from 'node:assert/strict'
import { test } from 'node:test'

function loadRoute(path, dependencies) {
  const source = stripTypeScriptTypes(readFileSync(path, 'utf8'))
    .replace(/^import .*$/gm, '')
    .replace(/export /g, '')
  return new Function(...Object.keys(dependencies),
    source + '\nreturn { POST, ' + (source.includes('async function DELETE(') ? 'DELETE' : '') + ' };'
  )(...Object.values(dependencies))
}
const response = { json: (body, options={}) => ({ body, status: options.status ?? 200 }) }
const sessionPath = process.env.KDS_TEST_SESSION || 'app/staff/api/session/route.ts'
const transitionPath = process.env.KDS_TEST_TRANSITION || 'app/staff/api/orders/[id]/transition/route.ts'

test('failed revocation preserves token; retry revokes same session before cookie removal', async () => {
  let fail = true, token = 'session-token'
  const hashes = []
  const db = { from: () => ({ update: () => ({ eq: (_column, hash) => {
    hashes.push(hash)
    return { is: async () => ({error: fail ? {message:'database unavailable'} : null}) }
  } }) }) }
  const jar = { get: () => token ? {value:token} : undefined, set: (_name,value) => { token=value } }
  const route = loadRoute(sessionPath, {
    NextResponse: response, cookies: async()=>jar,
    requireSameOrigin: async()=>{}, staffDatabase:()=>db,
    staffSessionCookieName:()=> 'session', tokenHash:v=>'hash:'+v,
  })
  assert.equal((await route.DELETE()).status,503)
  assert.equal(token,'session-token')
  fail=false
  assert.equal((await route.DELETE()).status,200)
  assert.deepEqual(hashes,['hash:session-token','hash:session-token'])
  assert.equal(token,'')
})

test('cross-origin transition returns 403 before auth or database access', async()=>{
  const route=loadRoute(transitionPath,{
    NextResponse:response,requireKdsLiveEnabled:()=>{},
    requireSameOrigin:async()=>{throw Error('INVALID_ORIGIN')},
    requireStaffContext:async()=>{assert.fail('auth must not run')},
    staffDatabase:()=>{assert.fail('database must not run')},
  })
  const result=await route.POST({}, {params:Promise.resolve({id:'unused'})})
  assert.equal(result.status,403)
  assert.equal(result.body.error,'INVALID_ORIGIN')
})

test('missing session returns 401 before order lookup', async()=>{
  const route=loadRoute(transitionPath,{
    NextResponse:response,requireKdsLiveEnabled:()=>{},
    requireSameOrigin:async()=>{},rejectOversizedJson:()=>{},
    requireStaffContext:async()=>{throw Error('STAFF_UNAUTHORIZED')},
    staffDatabase:()=>{assert.fail('database must not run')},
  })
  assert.equal((await route.POST({}, {params:Promise.resolve({id:'unused'})})).status,401)
})

test('order outside server-derived locations is not exposed or transitioned', async()=>{
  let scoped=false
  const route=loadRoute(transitionPath,{
    NextResponse:response,requireKdsLiveEnabled:()=>{},
    requireSameOrigin:async()=>{},rejectOversizedJson:()=>{},isUuid:()=>true,
    requireStaffContext:async()=>({staffId:'staff-a',locationIds:['location-a']}),
    staffDatabase:()=>({
      from:()=>({select:()=>({eq:()=>({in:(column,ids)=>{
        assert.equal(column,'location_id');assert.deepEqual(ids,['location-a']);scoped=true
        return {maybeSingle:async()=>({data:null,error:null})}
      }})})}),
      rpc:()=>{assert.fail('unauthorized order must not reach transition RPC')},
    }),
  })
  const req={json:async()=>({request_id:'request',to_status:'accepted',
    expected_status:'pending',expected_revision:0,location_id:'location-b'})}
  const result=await route.POST(req,{params:Promise.resolve({id:'other-order'})})
  assert.equal(scoped,true)
  assert.equal(result.status,404)
  assert.equal(result.body.error,'ORDER_NOT_FOUND')
})
