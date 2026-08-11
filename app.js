function loadOptionalModule(src){
  return new Promise((resolve,reject)=>{
    if(document.querySelector(`script[src^="${src}"]`))return resolve();
    const script=document.createElement('script');
    script.src=`${src}?v=1`;
    script.onload=resolve;
    script.onerror=()=>reject(new Error(`${src} konnte nicht geladen werden.`));
    document.head.appendChild(script);
  });
}

async function loadAll(){try{await Promise.all([loadTrades(),loadFocus(),loadGoals(),loadFitness(),loadNotes(),loadAcademy(),loadCalendar(),loadWeeklyReview(),loadReminderSettings(),loadLibrary(),loadHydration()]);renderFocus();renderTrading();await renderGoals();renderFitness();renderNotes();await renderAcademy();await renderLibrary();renderCalendar();renderWeeklyReview();renderReminderSettings();renderHydration();renderBackupCenter();const h=new Date().getHours();$('#greeting').textContent=(h<11?'Guten Morgen':h<18?'Guten Tag':'Guten Abend')+' 👋';$('#todayText').textContent=new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}).format(new Date())}catch(err){console.error(err);alert('Daten konnten nicht geladen werden: '+err.message)}}
async function boot(){try{await loadOptionalModule('modules/hydration.js');sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY)}catch(err){$('#authMsg').textContent=err.message||'config.js konnte nicht geladen werden.';return}const{data:{session}}=await sb.auth.getSession();if(session){currentUser=session.user;showApp();await loadAll()}sb.auth.onAuthStateChange(async(_e,s)=>{if(s){currentUser=s.user;showApp();await loadAll()}else{currentUser=null;showAuth()}})}
boot();
