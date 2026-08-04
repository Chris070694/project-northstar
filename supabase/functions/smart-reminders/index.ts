import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
}

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
  status,
  headers:{...corsHeaders,'Content-Type':'application/json'}
})

const supabaseUrl=Deno.env.get('SUPABASE_URL')!
const serviceRoleKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin=createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false}})

async function authenticatedUser(request:Request){
  const authorization=request.headers.get('Authorization')||''
  const token=authorization.replace(/^Bearer\s+/i,'')
  if(!token)return null
  const {data,error}=await admin.auth.getUser(token)
  return error?null:data.user
}

async function ensureVapidKeys(){
  const existing=await admin.from('push_server_config').select('*').eq('id',1).maybeSingle()
  if(existing.error)throw existing.error
  if(existing.data)return existing.data
  const generated=webpush.generateVAPIDKeys()
  const inserted=await admin.from('push_server_config').insert({
    id:1,
    public_key:generated.publicKey,
    private_key:generated.privateKey
  }).select().single()
  if(!inserted.error)return inserted.data
  const retry=await admin.from('push_server_config').select('*').eq('id',1).single()
  if(retry.error)throw retry.error
  return retry.data
}

function localClock(now:Date,timeZone:string){
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone,
    weekday:'short',
    year:'numeric',
    month:'2-digit',
    day:'2-digit',
    hour:'2-digit',
    minute:'2-digit',
    hourCycle:'h23'
  }).formatToParts(now)
  const part=(type:string)=>parts.find(item=>item.type===type)?.value||''
  const weekdayMap:Record<string,number>={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}
  return {
    day:weekdayMap[part('weekday')],
    date:`${part('year')}-${part('month')}-${part('day')}`,
    time:`${part('hour')}:${part('minute')}`
  }
}

function shortTime(value:string|null|undefined){
  return String(value||'').slice(0,5)
}

function isQuiet(time:string,start:string,end:string){
  if(start===end)return false
  return start<end?(time>=start&&time<end):(time>=start||time<end)
}

function dueReminders(settings:any,now:Date){
  const clock=localClock(now,settings.timezone||'Europe/Vienna')
  if(isQuiet(clock.time,shortTime(settings.quiet_start),shortTime(settings.quiet_end)))return []
  const due=[]
  if(settings.daily_focus_enabled&&clock.time===shortTime(settings.daily_focus_time)){
    due.push({type:'daily_focus',title:'Daily Focus setzen ◎',body:'Was zählt heute wirklich? Starte deinen Tag mit einem klaren Fokus.',url:'./?page=focus'})
  }
  if(settings.trading_enabled&&clock.time===shortTime(settings.trading_time)){
    due.push({type:'trading',title:'Trading-Plan prüfen 📈',body:'Setup, Risiko und Regeln zuerst – dann erst den Trade.',url:'./?page=trading'})
  }
  if(settings.fitness_enabled&&(settings.fitness_days||[]).map(Number).includes(clock.day)&&clock.time===shortTime(settings.fitness_time)){
    due.push({type:'fitness',title:'Zeit für dein Training 💪',body:'Dein Plan ist bereit. Der nächste Satz bringt dich voran.',url:'./?page=fitness'})
  }
  if(settings.weekly_enabled&&Number(settings.weekly_day)===clock.day&&clock.time===shortTime(settings.weekly_time)){
    due.push({type:'weekly',title:'Weekly Review starten ↻',body:'Schließe deine Woche ab und setze die Top 3 für die nächste.',url:'./?page=weekly'})
  }
  return due.map(item=>({...item,deliveryKey:clock.date}))
}

async function dispatchReminders(){
  const cronSecret=Deno.env.get('CRON_SECRET')
  if(!cronSecret)throw new Error('CRON_SECRET is not configured')
  const config=await ensureVapidKeys()
  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT')||'mailto:notifications@cprb.app',
    config.public_key,
    config.private_key
  )
  const {data:settings,error:settingsError}=await admin.from('reminder_settings').select('*')
  if(settingsError)throw settingsError
  const now=new Date()
  const dueUsers=(settings||[]).map(row=>({row,due:dueReminders(row,now)})).filter(item=>item.due.length)
  if(!dueUsers.length)return {sent:0,due:0}
  const userIds=dueUsers.map(item=>item.row.user_id)
  const {data:subscriptions,error:subscriptionError}=await admin.from('push_subscriptions').select('*').in('user_id',userIds)
  if(subscriptionError)throw subscriptionError
  const byUser=new Map<string,any[]>()
  for(const subscription of subscriptions||[]){
    const list=byUser.get(subscription.user_id)||[]
    list.push(subscription)
    byUser.set(subscription.user_id,list)
  }

  let sent=0
  let dueCount=0
  for(const item of dueUsers){
    const userSubscriptions=byUser.get(item.row.user_id)||[]
    if(!userSubscriptions.length)continue
    for(const reminder of item.due){
      dueCount+=1
      const delivery=await admin.from('reminder_deliveries').insert({
        user_id:item.row.user_id,
        reminder_type:reminder.type,
        delivery_key:reminder.deliveryKey
      })
      if(delivery.error?.code==='23505')continue
      if(delivery.error)throw delivery.error
      const payload=JSON.stringify({
        title:reminder.title,
        body:reminder.body,
        url:reminder.url,
        tag:`cprb-${reminder.type}-${reminder.deliveryKey}`
      })
      for(const subscription of userSubscriptions){
        try{
          await webpush.sendNotification({
            endpoint:subscription.endpoint,
            keys:{p256dh:subscription.p256dh,auth:subscription.auth}
          },payload,{TTL:3600,urgency:'normal'})
          sent+=1
        }catch(error:any){
          const status=Number(error?.statusCode||error?.status)
          if(status===404||status===410){
            await admin.from('push_subscriptions').delete().eq('id',subscription.id)
          }else{
            console.error('Push delivery failed',status,error?.message)
          }
        }
      }
    }
  }
  const cutoff=new Date(Date.now()-45*24*60*60*1000).toISOString()
  await admin.from('reminder_deliveries').delete().lt('delivered_at',cutoff)
  return {sent,due:dueCount}
}

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  if(request.method!=='POST')return json({error:'Method not allowed'},405)
  try{
    const body=await request.json().catch(()=>({}))
    if(body.action==='public-key'){
      const user=await authenticatedUser(request)
      if(!user)return json({error:'Unauthorized'},401)
      const keys=await ensureVapidKeys()
      return json({publicKey:keys.public_key})
    }
    if(body.action==='dispatch'){
      const expected=Deno.env.get('CRON_SECRET')
      if(!expected||request.headers.get('x-cron-secret')!==expected)return json({error:'Unauthorized'},401)
      return json(await dispatchReminders())
    }
    return json({error:'Unknown action'},400)
  }catch(error:any){
    console.error(error)
    return json({error:error?.message||'Internal error'},500)
  }
})
