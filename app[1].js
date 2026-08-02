async function loadAll(){try{await Promise.all([loadTrades(),loadFocus(),loadGoals(),loadFitness(),loadNotes(),loadAcademy(),loadCalendar()]);renderFocus();renderTrading();await renderGoals();renderFitness();renderNotes();await renderAcademy();renderCalendar();const h=new Date().getHours();$('#greeting').textContent=(h<11?'Guten Morgen':h<18?'Guten Tag':'Guten Abend')+' 👋';$('#todayText').textContent=new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}).format(new Date())}catch(err){console.error(err);alert('Daten konnten nicht geladen werden: '+err.message)}}
async function boot(){try{sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY)}catch(err){$('#authMsg').textContent='config.js konnte nicht geladen werden.';return}const{data:{session}}=await sb.auth.getSession();if(session){currentUser=session.user;showApp();await loadAll()}sb.auth.onAuthStateChange(async(_e,s)=>{if(s){currentUser=s.user;showApp();await loadAll()}else{currentUser=null;showAuth()}})}


function startAuroraExperience(){
  const splash=document.getElementById('splashScreen');
  window.setTimeout(()=>splash?.classList.add('is-hidden'),900);
  window.setTimeout(()=>splash?.remove(),1700);

  document.addEventListener('click',event=>{
    const button=event.target.closest('.btn,.nav,.module-card');
    if(!button)return;
    button.animate(
      [{transform:'scale(1)'},{transform:'scale(.975)'},{transform:'scale(1)'}],
      {duration:180,easing:'ease-out'}
    );
  });

  const observer=new MutationObserver(()=>{
    document.querySelectorAll('.page.active .card:not([data-aurora-seen])').forEach((card,index)=>{
      card.dataset.auroraSeen='true';
      card.animate(
        [{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],
        {duration:360,delay:Math.min(index*35,220),easing:'cubic-bezier(.2,.8,.2,1)',fill:'both'}
      );
    });
  });
  observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
}
startAuroraExperience();
boot();
