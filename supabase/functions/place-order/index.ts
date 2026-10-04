import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
function normalizePhone(value:unknown){if(typeof value!=="string")return null;const digits=value.replace(/\D/g,"");if(digits.length===11&&(digits[0]==="7"||digits[0]==="8"))return "+7"+digits.slice(1);if(digits.length===10)return "+7"+digits;return null;}
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 if(req.method!=="POST") return Response.json({error:"METHOD_NOT_ALLOWED"},{status:405,headers:cors});
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); if(!url||!key)return Response.json({error:"CONFIG"},{status:500,headers:cors});
 const db=createClient(url,key,{auth:{persistSession:false}}),b=await req.json().catch(()=>null); if(!b?.location_id||!Array.isArray(b?.items))return Response.json({error:"INVALID_REQUEST"},{status:400,headers:cors});
 const customerPhone=normalizePhone(b.customer_phone); if(!customerPhone)return Response.json({error:"CUSTOMER_PHONE_REQUIRED"},{status:400,headers:cors});
 const {data,error}=await db.rpc("place_order",{p_location_id:b.location_id,p_items:b.items,p_customer_name:b.customer_name??null,p_customer_phone:customerPhone,p_notes:b.notes??null});
 if(error)return Response.json({error:error.message},{status:400,headers:cors}); let telegram:any=null;
 if(data?.order_id){try{const rr=await fetch(url+"/functions/v1/telegram-orders?action=order&id="+encodeURIComponent(data.order_id));telegram=await rr.json().catch(()=>({ok:false}));}catch{telegram={ok:false};}}
 return Response.json({...data,telegram_notified:telegram?.ok===true},{headers:{...cors,"content-type":"application/json"}});
});
