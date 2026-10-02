import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const CHAT_ID="-1004316783581";
const SELF_URL="https://bspktoshbiyhfpmulfek.supabase.co/functions/v1/telegram-orders";
const esc=(s:any)=>String(s??"").replace(/[&<>]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]!));
Deno.serve(async(req:Request)=>{
 const token=Deno.env.get("TELEGRAM_BOT_TOKEN");
 const sbUrl=Deno.env.get("SUPABASE_URL");
 const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!token||!sbUrl||!service)return new Response("config",{status:500});
 const db=createClient(sbUrl,service,{auth:{persistSession:false}});
 const tg=async(method:string,body:any={})=>await (await fetch("https://api.telegram.org/bot"+token+"/"+method,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)})).json();
 const u=new URL(req.url);
 if(req.method==="GET"&&u.searchParams.get("action")==="register_webhook"){
   const d=await tg("setWebhook",{url:SELF_URL,drop_pending_updates:true});
   return Response.json({ok:d.ok,description:d.description??null});
 }
 if(req.method==="GET"&&u.searchParams.get("action")==="webhook_info"){
   const d=await tg("getWebhookInfo");
   return Response.json({ok:d.ok,url:d.result?.url??null,pending_update_count:d.result?.pending_update_count??null,last_error_message:d.result?.last_error_message??null});
 }
 if(req.method==="GET"&&u.searchParams.get("action")==="demo_card"){
  const d=await tg("sendMessage",{chat_id:CHAT_ID,text:"🆕 ТЕСТОВЫЙ ЗАКАЗ №1003\n\n• 1× Шаурма с курицей — 390 ₽\n• 1× Фри маленькая — 200 ₽\n\n💰 Итого: 590 ₽\n💳 Оплата при получении",reply_markup:{inline_keyboard:[[{text:"✅ Принять",callback_data:"demo_accept"},{text:"❌ Отклонить",callback_data:"demo_reject"}]]}});
  return Response.json({ok:d.ok,message_id:d.result?.message_id??null});
 }
 if(req.method==="GET"&&u.searchParams.get("action")==="order"){
   const id=u.searchParams.get("id"); if(!id)return Response.json({error:"id required"},{status:400});
   const {data:o,error}=await db.from("orders").select("id,order_number,status,total,payment_method,customer_name,customer_phone,notes,order_items(id,name_snapshot,quantity,line_total,order_item_modifiers(name_snapshot,price_delta))").eq("id",id).single();
   if(error||!o)return Response.json({error:"order not found"},{status:404});
   let text="🆕 <b>НОВЫЙ ЗАКАЗ №"+o.order_number+"</b>\n\n";
   for(const i of (o.order_items??[])){text+="• "+i.quantity+"× "+esc(i.name_snapshot)+" — "+Number(i.line_total)+" ₽\n"; for(const m of (i.order_item_modifiers??[]))text+="  + "+esc(m.name_snapshot)+(Number(m.price_delta)?(" +"+Number(m.price_delta)+" ₽"):"")+"\n";}
   text+="\n💰 <b>Итого: "+Number(o.total)+" ₽</b>\n💳 Оплата при получении";
   if(o.customer_name)text+="\n👤 "+esc(o.customer_name); if(o.customer_phone)text+="\n☎️ "+esc(o.customer_phone); if(o.notes)text+="\n📝 "+esc(o.notes);
   const d=await tg("sendMessage",{chat_id:CHAT_ID,text,parse_mode:"HTML",reply_markup:{inline_keyboard:[[{text:"✅ Принять",callback_data:"a:"+o.id},{text:"❌ Отклонить",callback_data:"x:"+o.id}]]}});
   return Response.json({ok:d.ok,message_id:d.result?.message_id??null});
 }
 if(req.method==="POST"){
  const x=await req.json().catch(()=>null); const cb=x?.callback_query;
  if(!cb)return Response.json({ok:true});
  if(String(cb.message?.chat?.id)!==CHAT_ID){await tg("answerCallbackQuery",{callback_query_id:cb.id,text:"Недоступно"});return Response.json({ok:true});}
  if(cb.data==="demo_accept"||cb.data==="demo_reject"){
   const accepted=cb.data==="demo_accept"; await tg("editMessageText",{chat_id:CHAT_ID,message_id:cb.message.message_id,text:cb.message.text+"\n\n"+(accepted?"✅ Принят":"❌ Отклонён"),reply_markup:{inline_keyboard:[]}}); await tg("answerCallbackQuery",{callback_query_id:cb.id,text:accepted?"Заказ принят":"Заказ отклонён"}); return Response.json({ok:true});
  }
  const mm=/^([axprd]):([0-9a-f-]{36})$/.exec(String(cb.data??"")); if(!mm){await tg("answerCallbackQuery",{callback_query_id:cb.id,text:"Неизвестное действие"});return Response.json({ok:true});}
  const map:any={a:"accepted",x:"rejected",p:"preparing",r:"ready",d:"completed"}; const status=map[mm[1]];
  const {data:res,error}=await db.rpc("staff_set_order_status",{p_order_id:mm[2],p_status:status});
  if(error){await tg("answerCallbackQuery",{callback_query_id:cb.id,text:"Ошибка: "+error.message.slice(0,120),show_alert:true});return Response.json({ok:false},{status:200});}
  const labels:any={accepted:"✅ Принят",rejected:"❌ Отклонён",preparing:"🔥 Готовится",ready:"✅ Готов",completed:"📦 Выдан"};
  const next:any={accepted:[{text:"🔥 Готовится",callback_data:"p:"+mm[2]}],preparing:[{text:"✅ Готов",callback_data:"r:"+mm[2]}],ready:[{text:"📦 Выдан",callback_data:"d:"+mm[2]}]};
  const base=String(cb.message.text??"").replace(/\n\n(?:✅ Принят|❌ Отклонён|🔥 Готовится|✅ Готов|📦 Выдан)$/,"");
  await tg("editMessageText",{chat_id:CHAT_ID,message_id:cb.message.message_id,text:base+"\n\n"+labels[status],reply_markup:{inline_keyboard:next[status]?[next[status]]:[]}});
  await tg("answerCallbackQuery",{callback_query_id:cb.id,text:labels[status]});
  return Response.json({ok:true,status:res?.status??status});
 }
 return Response.json({ok:true,service:"telegram-orders"});
});