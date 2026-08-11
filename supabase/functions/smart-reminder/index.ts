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
    due.push({type:'daily_focus',title:'Tagesplanung öffnen ✓',body:'Plane deine Aufgaben und wähle deine Top-Priorität für heute.',url:'./?page=tasks'})
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

function dueHydrationReminder(settings:any,hydration:any,now:Date){
  if(settings.hydration_enabled===false)return []
  const clock=localClock(now,settings.timezone||'Europe/Vienna')
  if(isQuiet(clock.time,shortTime(settings.quiet_start),shortTime(settings.quiet_end)))return []

  const checkpoints=[
    {time:'10:00',expected:0.20},
    {time:'12:00',expected:0.35},
    {time:'14:00',expected:0.50},
    {time:'16:00',expected:0.65},
    {time:'18:00',expected:0.80},
    {time:'20:00',expected:0.95}
  ]

  const toMinutes=(value:string)=>{
    const [hours,minutes]=value.split(':').map(Number)
    return hours*60+minutes
  }

  const nowMinutes=toMinutes(clock.time)
  const checkpoint=checkpoints.find(item=>{
    const checkpointMinutes=toMinutes(item.time)
    return nowMinutes>=checkpointMinutes&&nowMinutes<=checkpointMinutes+5
  })

  if(!checkpoint)return []

  const goal=Math.max(500,Number(hydration?.goal)||2500)
  const amount=Math.max(0,Number(hydration?.amount)||0)
  if(amount>=goal)return []
  const ratio=amount/goal
  if(ratio>=Math.max(0,checkpoint.expected-0.10))return []

  const remaining=Math.max(0,goal-amount)
  const amountLabel=(amount/1000).toFixed(2).replace('.',',')
  const remainingLabel=(remaining/1000).toFixed(2).replace('.',',')

  return [{
    type:'hydration',
    title:'Zeit für Wasser 💧',
    body:`Du bist heute bei ${amountLabel} L. Noch ${remainingLabel} L bis zu deinem Tagesziel.`,
    url:'./?page=home',
    deliveryKey:`${clock.date}-${checkpoint.time}`
  }]
}

function calendarEventOccursOnDate(event:any,date:string){
  if(event.event_date===date)return true
  return event.recurrence==='yearly'&&date>=event.event_date&&String(event.event_date).slice(5)===date.slice(5)
}

function dueCalendarReminders(events:any[],settings:any,now:Date){
  const clock=localClock(now,settings.timezone||'Europe/Vienna')
  if(isQuiet(clock.time,shortTime(settings.quiet_start),shortTime(settings.quiet_end)))return []
  return (events||[]).filter(event=>
    event.reminder_enabled&&
    clock.time===shortTime(event.reminder_time||'08:00')&&
    calendarEventOccursOnDate(event,clock.date)
  ).map(event=>({
    type:`calendar:${event.id}`,
    title:event.category==='Geburtstag'?`Geburtstag: ${event.title} 🎂`:`Kalender: ${event.title} 📅`,
    body:`Heute: ${event.title}${event.start_time?` um ${shortTime(event.start_time)} Uhr`:''}.`,
    url:`./?page=calendar&date=${clock.date}`,
    deliveryKey:clock.date
  }))
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
  const hydrationCutoff=new Date(Date.now()-36*60*60*1000).toISOString().slice(0,10)
  const [settingsResult,calendarResult,hydrationSettingsResult,hydrationDaysResult]=await Promise.all([
    admin.from('reminder_settings').select('*'),
    admin.from('calendar_events')
      .select('id,user_id,title,event_date,start_time,category,recurrence,reminder_enabled,reminder_time')
      .eq('reminder_enabled',true),
    admin.from('hydration_settings').select('user_id,daily_goal_ml'),
    admin.from('hydration_days').select('user_id,day,amount_ml').gte('day',hydrationCutoff)
  ])
  if(settingsResult.error)throw settingsResult.error
  if(calendarResult.error)throw calendarResult.error
  if(hydrationSettingsResult.error)throw hydrationSettingsResult.error
  if(hydrationDaysResult.error)throw hydrationDaysResult.error
  const now=new Date()
  const settingsByUser=new Map<string,any>((settingsResult.data||[]).map(row=>[row.user_id,row] as [string,any]))
  const calendarByUser=new Map<string,any[]>()
  for(const event of calendarResult.data||[]){
    const list=calendarByUser.get(event.user_id)||[]
    list.push(event)
    calendarByUser.set(event.user_id,list)
  }
  const hydrationGoalByUser=new Map<string,number>((hydrationSettingsResult.data||[]).map(row=>[row.user_id,Number(row.daily_goal_ml)||2500]))
  const hydrationByUserDate=new Map<string,number>()
  for(const day of hydrationDaysResult.data||[]){
    hydrationByUserDate.set(`${day.user_id}:${day.day}`,Number(day.amount_ml)||0)
  }
  const hydrationUserIds=[...new Set([
    ...(hydrationSettingsResult.data||[]).map(row=>row.user_id),
    ...(hydrationDaysResult.data||[]).map(row=>row.user_id)
  ])]
  const userIds=[...new Set([...settingsByUser.keys(),...calendarByUser.keys(),...hydrationUserIds])]
  const dueUsers=userIds.map(userId=>{
    const row=settingsByUser.get(userId)||{
      user_id:userId,
      timezone:'Europe/Vienna',
      hydration_enabled:true,
      quiet_start:'22:00',
      quiet_end:'07:00'
    }
    const clock=localClock(now,row.timezone||'Europe/Vienna')
    const hydration={
      goal:hydrationGoalByUser.get(userId)||2500,
      amount:hydrationByUserDate.get(`${userId}:${clock.date}`)||0
    }
    return {row,due:[
      ...dueReminders(row,now),
      ...dueCalendarReminders(calendarByUser.get(userId)||[],row,now),
      ...dueHydrationReminder(row,hydration,now)
    ]}
  }).filter(item=>item.due.length)
  if(!dueUsers.length)return {sent:0,due:0}
  const dueUserIds=dueUsers.map(item=>item.row.user_id)
  const {data:subscriptions,error:subscriptionError}=await admin.from('push_subscriptions').select('*').in('user_id',dueUserIds)
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
