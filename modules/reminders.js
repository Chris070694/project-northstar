let reminderSettings=null;
let reminderSettingsReady=true;
let pushSubscription=null;

function defaultReminderSettings(){
  return {
    timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'Europe/Vienna',
    daily_focus_enabled:false,
    daily_focus_time:'08:00',
    trading_enabled:false,
    trading_time:'08:30',
    fitness_enabled:false,
    fitness_time:'17:30',
    fitness_days:[1,3,5],
    weekly_enabled:false,
    weekly_day:0,
    weekly_time:'18:00',
    quiet_start:'22:00',
    quiet_end:'07:00'
  };
}

function isMissingReminderSchema(error){
  const message=`${error?.code||''} ${error?.message||''} ${error?.details||''}`.toLowerCase();
  return message.includes('42p01')||message.includes('pgrst205')||
    (message.includes('reminder_settings')&&/does not exist|schema cache|not find/i.test(message))||
    (message.includes('push_subscriptions')&&/does not exist|schema cache|not find/i.test(message));
}

function reminderTime(value,fallback){
  return String(value||fallback).slice(0,5);
}

async function loadReminderSettings(){
  let localPushEndpoint=null;
  try{
    const registration=await navigator.serviceWorker?.getRegistration();
    const localSubscription=await registration?.pushManager.getSubscription();
    localPushEndpoint=localSubscription?.endpoint||null;
  }catch(error){
    console.warn('Lokales Push-Abo konnte nicht geprüft werden.',error);
  }
  const [settingsResult,subscriptionResult]=await Promise.all([
    sb.from('reminder_settings').select('*').eq('user_id',currentUser.id).maybeSingle(),
    sb.from('push_subscriptions').select('id,endpoint').eq('user_id',currentUser.id)
  ]);
  const schemaError=settingsResult.error||subscriptionResult.error;
  if(schemaError){
    if(!isMissingReminderSchema(schemaError))throw schemaError;
    reminderSettingsReady=false;
    reminderSettings=defaultReminderSettings();
    pushSubscription=null;
    return;
  }
  reminderSettingsReady=true;
  reminderSettings={...defaultReminderSettings(),...(settingsResult.data||{})};
  pushSubscription=(subscriptionResult.data||[]).find(item=>item.endpoint===localPushEndpoint)||null;
}

function notificationCapability(){
  const supported='serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
  const standalone=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
  return {supported,standalone,permission:supported?Notification.permission:'unsupported'};
}

function renderReminderSettings(){
  const settings=reminderSettings||defaultReminderSettings();
  const capability=notificationCapability();
  const active=Boolean(pushSubscription)&&capability.permission==='granted';
  $('#reminderSetupNotice').classList.toggle('hide',reminderSettingsReady);
  $('#reminderTimezone').textContent=settings.timezone;
  $('#dailyFocusReminderEnabled').checked=Boolean(settings.daily_focus_enabled);
  $('#dailyFocusReminderTime').value=reminderTime(settings.daily_focus_time,'08:00');
  $('#tradingReminderEnabled').checked=Boolean(settings.trading_enabled);
  $('#tradingReminderTime').value=reminderTime(settings.trading_time,'08:30');
  $('#fitnessReminderEnabled').checked=Boolean(settings.fitness_enabled);
  $('#fitnessReminderTime').value=reminderTime(settings.fitness_time,'17:30');
  $('#weeklyReminderEnabled').checked=Boolean(settings.weekly_enabled);
  $('#weeklyReminderDay').value=String(settings.weekly_day??0);
  $('#weeklyReminderTime').value=reminderTime(settings.weekly_time,'18:00');
  $('#quietStart').value=reminderTime(settings.quiet_start,'22:00');
  $('#quietEnd').value=reminderTime(settings.quiet_end,'07:00');
  const fitnessDays=new Set((settings.fitness_days||[]).map(Number));
  $$('.fitness-reminder-day').forEach(input=>{input.checked=fitnessDays.has(Number(input.value))});

  const status=$('#notificationStatus');
  const copy=$('#notificationStatusCopy');
  const enable=$('#enableNotificationsBtn');
  const disable=$('#disableNotificationsBtn');
  const test=$('#testNotificationBtn');
  status.className='notification-state '+(active?'active':capability.permission==='denied'?'blocked':'');
  status.textContent=active?'Aktiv':capability.permission==='denied'?'Blockiert':'Nicht aktiviert';
  if(!capability.supported){
    copy.textContent='Dieser Browser unterstützt keine Web-Push-Benachrichtigungen.';
  }else if(!capability.standalone&&/iphone|ipad|ipod/i.test(navigator.userAgent)){
    copy.textContent='Auf dem iPhone muss CPRB zuerst zum Home-Bildschirm hinzugefügt und von dort geöffnet werden.';
  }else if(capability.permission==='denied'){
    copy.textContent='Benachrichtigungen sind in den Geräte-Einstellungen blockiert.';
  }else if(active){
    copy.textContent='Dieses Gerät empfängt deine CPRB-Erinnerungen – auch wenn die App geschlossen ist.';
  }else{
    copy.textContent='Aktiviere Push einmal auf diesem Gerät. CPRB fragt erst nach deinem Klick um Erlaubnis.';
  }
  enable.classList.toggle('hide',active);
  disable.classList.toggle('hide',!active);
  test.disabled=!active;
  $$('#reminderForm input,#reminderForm select,#reminderForm button').forEach(field=>{
    if(field.id!=='enableNotificationsBtn'&&field.id!=='disableNotificationsBtn'&&field.id!=='testNotificationBtn')field.disabled=!reminderSettingsReady;
  });
}

function urlBase64ToUint8Array(base64String){
  const padding='='.repeat((4-base64String.length%4)%4);
  const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');
  const rawData=atob(base64);
  return Uint8Array.from([...rawData].map(char=>char.charCodeAt(0)));
}

async function getPushPublicKey(){
  const {data,error}=await sb.functions.invoke('smart-reminder',{body:{action:'public-key'}});
  if(error)throw new Error('Der Push-Server ist noch nicht aktiviert.');
  if(!data?.publicKey)throw new Error('Der Push-Server hat keinen öffentlichen Schlüssel geliefert.');
  return data.publicKey;
}

async function enableSmartNotifications(){
  if(!reminderSettingsReady)return alert('Bitte zuerst die Habits-&-Reminders-Migration in Supabase ausführen.');
  const capability=notificationCapability();
  if(!capability.supported)return alert('Web Push wird auf diesem Gerät oder Browser nicht unterstützt.');
  if(!capability.standalone&&/iphone|ipad|ipod/i.test(navigator.userAgent)){
    return alert('Bitte CPRB zuerst zum Home-Bildschirm hinzufügen, von dort öffnen und dann Push aktivieren.');
  }
  if(Notification.permission==='denied')return alert('Bitte Benachrichtigungen in den Geräte-Einstellungen für CPRB erlauben.');

  const button=$('#enableNotificationsBtn');
  button.disabled=true;
  button.textContent='Wird aktiviert…';
  try{
    const permission=await Notification.requestPermission();
    if(permission!=='granted')throw new Error('Benachrichtigungen wurden nicht erlaubt.');
    const registration=await navigator.serviceWorker.ready;
    const publicKey=await getPushPublicKey();
    let subscription=await registration.pushManager.getSubscription();
    if(!subscription){
      subscription=await registration.pushManager.subscribe({
        userVisibleOnly:true,
        applicationServerKey:urlBase64ToUint8Array(publicKey)
      });
    }
    const json=subscription.toJSON();
    const {error}=await sb.from('push_subscriptions').upsert({
      user_id:currentUser.id,
      endpoint:json.endpoint,
      p256dh:json.keys?.p256dh,
      auth:json.keys?.auth,
      user_agent:navigator.userAgent,
      updated_at:new Date().toISOString()
    },{onConflict:'endpoint'});
    if(error)throw error;
    pushSubscription={endpoint:json.endpoint};
    renderReminderSettings();
    await registration.showNotification('CPRB Erinnerungen sind aktiv ✓',{
      body:'Dein persönliches System meldet sich ab jetzt zu den von dir gewählten Zeiten.',
      icon:'./icons/cprb-og-192.png',
      badge:'./icons/cprb-og-192.png',
      tag:'cprb-push-enabled',
      data:{url:'./?page=reminders'}
    });
  }catch(error){
    console.error(error);
    alert(error.message);
  }finally{
    button.disabled=false;
    button.textContent='Push aktivieren';
  }
}

async function disableSmartNotifications(){
  if(!confirm('Push-Benachrichtigungen auf diesem Gerät deaktivieren?'))return;
  try{
    const registration=await navigator.serviceWorker.ready;
    const subscription=await registration.pushManager.getSubscription();
    const endpoint=subscription?.endpoint||pushSubscription?.endpoint;
    if(subscription)await subscription.unsubscribe();
    if(endpoint){
      const {error}=await sb.from('push_subscriptions').delete().eq('endpoint',endpoint);
      if(error)throw error;
    }
    pushSubscription=null;
    renderReminderSettings();
  }catch(error){
    alert(error.message);
  }
}

async function testSmartNotification(){
  if(Notification.permission!=='granted')return alert('Bitte Push zuerst aktivieren.');
  const registration=await navigator.serviceWorker.ready;
  await registration.showNotification('CPRB Test-Erinnerung 🔔',{
    body:'Perfekt – Benachrichtigungen funktionieren auf diesem Gerät.',
    icon:'./icons/cprb-og-192.png',
    badge:'./icons/cprb-og-192.png',
    tag:'cprb-test',
    data:{url:'./?page=reminders'}
  });
}

$('#reminderForm')?.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!reminderSettingsReady)return alert('Bitte zuerst die Habits-&-Reminders-Migration in Supabase ausführen.');
  const fitnessDays=$$('.fitness-reminder-day:checked').map(input=>Number(input.value));
  const payload={
    user_id:currentUser.id,
    timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'Europe/Vienna',
    daily_focus_enabled:$('#dailyFocusReminderEnabled').checked,
    daily_focus_time:$('#dailyFocusReminderTime').value,
    trading_enabled:$('#tradingReminderEnabled').checked,
    trading_time:$('#tradingReminderTime').value,
    fitness_enabled:$('#fitnessReminderEnabled').checked,
    fitness_time:$('#fitnessReminderTime').value,
    fitness_days:fitnessDays,
    weekly_enabled:$('#weeklyReminderEnabled').checked,
    weekly_day:Number($('#weeklyReminderDay').value),
    weekly_time:$('#weeklyReminderTime').value,
    quiet_start:$('#quietStart').value,
    quiet_end:$('#quietEnd').value,
    updated_at:new Date().toISOString()
  };
  const button=$('#saveRemindersBtn');
  button.disabled=true;
  button.textContent='Wird gespeichert…';
  const {error}=await sb.from('reminder_settings').upsert(payload,{onConflict:'user_id'});
  if(error){
    button.disabled=false;
    button.textContent='Erinnerungen speichern';
    return alert(error.message);
  }
  reminderSettings={...defaultReminderSettings(),...payload};
  renderReminderSettings();
  button.textContent='Gespeichert ✓';
  setTimeout(()=>{button.disabled=false;button.textContent='Erinnerungen speichern'},1400);
});
