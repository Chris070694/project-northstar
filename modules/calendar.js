
let calendarEvents=[];
let calendarCursor=new Date();
let selectedCalendarDate=new Date().toISOString().slice(0,10);

async function loadCalendar(){
  const {data,error}=await sb.from('calendar_events').select('*').order('event_date',{ascending:true}).order('start_time',{ascending:true});
  if(error)throw error;
  calendarEvents=data||[];
}

function openCalendarEvent(date){
  $('#cDate').value=date||selectedCalendarDate||new Date().toISOString().slice(0,10);
  $('#calendarModal').classList.add('open');
}
function closeCalendarEvent(){ $('#calendarModal').classList.remove('open'); }

$('#calendarForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const {error}=await sb.from('calendar_events').insert({
    user_id:currentUser.id,title:$('#cTitle').value,event_date:$('#cDate').value,
    start_time:$('#cStart').value||null,end_time:$('#cEnd').value||null,
    category:$('#cCategory').value,description:$('#cDescription').value
  });
  if(error)return alert(error.message);
  e.target.reset();closeCalendarEvent();await loadAll();showPage('calendar');
});

async function toggleCalendarEvent(id,value){
  await sb.from('calendar_events').update({completed:!value}).eq('id',id);
  await loadAll();
}
async function deleteCalendarEvent(id){
  if(!confirm('Termin löschen?'))return;
  await sb.from('calendar_events').delete().eq('id',id);
  await loadAll();
}
function shiftCalendar(n){
  calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+n,1);
  renderCalendar();
}
function selectCalendarDate(date){
  selectedCalendarDate=date;
  renderCalendarSelectedDay();
}
function categoryClass(cat){return 'cat-'+(cat||'Privat').toLowerCase().replace('ä','a').replace(' ','-')}

function renderCalendar(){
  const y=calendarCursor.getFullYear(),m=calendarCursor.getMonth();
  $('#calendarTitle').textContent=new Intl.DateTimeFormat('de-DE',{month:'long',year:'numeric'}).format(calendarCursor);
  let html=['Mo','Di','Mi','Do','Fr','Sa','So'].map(x=>`<div class="cal-head">${x}</div>`).join('');
  const first=new Date(y,m,1),offset=(first.getDay()+6)%7,days=new Date(y,m+1,0).getDate();
  const prevDays=new Date(y,m,0).getDate();
  for(let i=offset-1;i>=0;i--){
    const d=prevDays-i,date=isoDate(new Date(y,m-1,d));
    html+=calendarDay(date,d,true);
  }
  for(let d=1;d<=days;d++){
    const date=isoDate(new Date(y,m,d));
    html+=calendarDay(date,d,false);
  }
  const cells=offset+days,remain=(7-(cells%7))%7;
  for(let d=1;d<=remain;d++){
    const date=isoDate(new Date(y,m+1,d));
    html+=calendarDay(date,d,true);
  }
  $('#calendarGrid').innerHTML=html;
  renderCalendarSelectedDay();
}
function calendarDay(date,num,outside){
  const events=calendarEvents.filter(e=>e.event_date===date);
  const today=date===new Date().toISOString().slice(0,10);
  return `<div class="cal-day ${outside?'outside':''} ${today?'today':''}" onclick="selectCalendarDate('${date}')">
    <div class="cal-num">${num}</div>
    <div class="cal-events">${events.slice(0,3).map(e=>`<div class="cal-event ${categoryClass(e.category)}">${escapeHtml(e.title)}</div>`).join('')}${events.length>3?`<div class="sub">+${events.length-3}</div>`:''}</div>
  </div>`;
}
function renderCalendarSelectedDay(){
  const date=new Date(selectedCalendarDate+'T12:00:00');
  $('#selectedDateTitle').textContent=new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'2-digit',month:'long'}).format(date);
  const events=calendarEvents.filter(e=>e.event_date===selectedCalendarDate);
  $('#selectedDateEvents').innerHTML=events.map(e=>`<div class="event-item ${e.completed?'done':''}">
    <div class="calendar-title-row"><b>${escapeHtml(e.title)}</b><span class="pill">${escapeHtml(e.category)}</span></div>
    <div class="sub">${e.start_time?e.start_time.slice(0,5):'Ganztägig'}${e.end_time?' – '+e.end_time.slice(0,5):''}</div>
    ${e.description?`<p>${escapeHtml(e.description)}</p>`:''}
    <div class="actions"><button class="btn" onclick="toggleCalendarEvent('${e.id}',${e.completed})">${e.completed?'Wieder öffnen':'Erledigt'}</button><button class="btn danger" onclick="deleteCalendarEvent('${e.id}')">Löschen</button></div>
  </div>`).join('')||'<div class="empty">Keine Termine an diesem Tag.</div>';
}
function isoDate(d){
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
