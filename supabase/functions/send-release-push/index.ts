import {createClient} from 'npm:@supabase/supabase-js@2.58.0'
import webpush from 'npm:web-push@3.6.7'

const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}})
Deno.serve(async request=>{
 if(request.method!=='POST')return respond({error:'Method not allowed'},405)
 const secret=Deno.env.get('RELEASE_PUSH_JOB_SECRET')
 const auth=request.headers.get('authorization')
 if(!secret||!auth||auth!=='Bearer '+secret)return respond({error:'Unauthorized'},401)
 const url=Deno.env.get('SUPABASE_URL'),serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
 const publicKey=Deno.env.get('VAPID_PUBLIC_KEY'),privateKey=Deno.env.get('VAPID_PRIVATE_KEY'),subject=Deno.env.get('VAPID_SUBJECT')
 if(!url||!serviceKey||!publicKey||!privateKey||!subject)return respond({error:'Push sender is not configured'},503)
 webpush.setVapidDetails(subject,publicKey,privateKey)
 const db=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Zurich',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
 const {error:queueError}=await db.rpc('rc_queue_release_notifications',{p_date:today})
 if(queueError)return respond({error:'Could not queue due reminders'},500)
 const {data:jobs,error}=await db.rpc('rc_claim_release_deliveries',{p_date:today,p_limit:100})
 if(error)return respond({error:'Could not claim delivery jobs'},500)
 let sent=0,failed=0
 for(const job of jobs||[]){
  const {data:book}=await db.from('rc_books').select('id,title,author,release_on,release_alert_enabled,status,user_id').eq('id',job.book_id).eq('user_id',job.user_id).maybeSingle()
  const {data:device}=await db.from('rc_push_subscriptions').select('id,endpoint,p256dh,auth_secret,user_id').eq('id',job.subscription_id).eq('user_id',job.user_id).maybeSingle()
  if(!book||!device||!book.release_alert_enabled||book.status!=='to_read'||book.release_on!==job.release_on){await db.from('rc_release_delivery_log').update({status:'failed',updated_at:new Date().toISOString()}).eq('id',job.id);continue}
  try{
   await webpush.sendNotification({endpoint:device.endpoint,keys:{p256dh:device.p256dh,auth:device.auth_secret}},JSON.stringify({title:'Book release today',body:book.title+(book.author?' — '+book.author:''),tag:'release-'+book.id+'-'+job.release_on}),{TTL:86400})
   await db.from('rc_release_delivery_log').update({status:'sent',updated_at:new Date().toISOString()}).eq('id',job.id)
   sent++
  }catch(err){
   failed++
   const code=Number(err?.statusCode||0)
   if(code===404||code===410)await db.from('rc_push_subscriptions').delete().eq('id',device.id)
   await db.from('rc_release_delivery_log').update({status:'failed',updated_at:new Date().toISOString()}).eq('id',job.id)
  }
 }
 return respond({processed:(jobs||[]).length,sent,failed})
})
