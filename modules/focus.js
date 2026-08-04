let dailyTasks=[];
let dailyTasksReady=true;
let recurringTasks=[];
let recurringTasksReady=true;

function focusDateKey(date=new Date()){
  const year=date.getFullYear();
  const month=String(date.getMonth()+1).padStart(2,'0');
  const day=String(date.getDate()).padStart(2,'0');
  return `${year}-${month}-${day}`;
}

function isMissingDailyTasksTable(error){
  const message=String(error?.message||'');
  return error?.code==='42P01'||(message.includes('daily_tasks')&&/does not exist|schema cache/i.test(message));
}

function isMissingRecurringTasksSchema(error){
  const message=`${error?.code||''} ${error?.message||''} ${error?.details||''}`.toLowerCase();
  return message.includes('42p01')||message.includes('42703')||message.includes('pgrst205')||
    (message.includes('recurring_task')&&/does not exist|schema cache|not find/i.test(message))||
    (message.includes('source_recurring_task_id')&&/does not exist|schema cache|not find/i.test(message));
}

async function loadFocus(){
  const d=focusDateKey();
  const [focusResult,taskResult,recurringResult,skipResult]=await Promise.all([
    sb.from('daily_focus').select('*').eq('focus_date',d).maybeSingle(),
    sb.from('daily_tasks').select('*').eq('task_date',d).order('position',{ascending:true}).order('created_at',{ascending:true}),
    sb.from('recurring_tasks').select('*').eq('is_active',true).order('position',{ascending:true}).order('created_at',{ascending:true}),
    sb.from('recurring_task_skips').select('recurring_task_id').eq('skip_date',d)
  ]);
  if(focusResult.error)throw focusResult.error;
  focus=focusResult.data||null;

  if(taskResult.error){
    if(!isMissingDailyTasksTable(taskResult.error)&&!isMissingRecurringTasksSchema(taskResult.error))throw taskResult.error;
    dailyTasksReady=!isMissingDailyTasksTable(taskResult.error);
    recurringTasksReady=false;
    dailyTasks=[];
    recurringTasks=[];
    return;
  }
  dailyTasksReady=true;
  dailyTasks=taskResult.data||[];

  if(recurringResult.error){
    if(!isMissingRecurringTasksSchema(recurringResult.error))throw recurringResult.error;
    recurringTasksReady=false;
    recurringTasks=[];
    return;
  }

  recurringTasksReady=true;
  recurringTasks=(recurringResult.data||[]).filter(task=>task.starts_on<=d&&(!task.ends_on||task.ends_on>=d));
  if(skipResult.error){
    if(!isMissingRecurringTasksSchema(skipResult.error))throw skipResult.error;
    recurringTasksReady=false;
    return;
  }
  const skippedSources=new Set((skipResult.data||[]).map(item=>item.recurring_task_id));
  const existingSources=new Set(dailyTasks.map(task=>task.source_recurring_task_id).filter(Boolean));
  const missing=recurringTasks.filter(task=>!existingSources.has(task.id)&&!skippedSources.has(task.id));
  if(missing.length){
    const basePosition=dailyTasks.length?Math.max(...dailyTasks.map(task=>Number(task.position)||0))+1:0;
    const rows=missing.map((task,index)=>({
      user_id:currentUser.id,
      task_date:d,
      title:task.title,
      category:task.category,
      position:basePosition+index,
      source_recurring_task_id:task.id
    }));
    const {error}=await sb.from('daily_tasks').upsert(rows,{
      onConflict:'user_id,task_date,source_recurring_task_id',
      ignoreDuplicates:true
    });
    if(error){
      if(!isMissingRecurringTasksSchema(error))throw error;
      recurringTasksReady=false;
      return;
    }
    const refreshed=await sb.from('daily_tasks').select('*').eq('task_date',d).order('position',{ascending:true}).order('created_at',{ascending:true});
    if(refreshed.error)throw refreshed.error;
    dailyTasks=refreshed.data||[];
  }
}

$('#focusForm').onsubmit=async e=>{
  e.preventDefault();
  const d=focusDateKey();
  const {error}=await sb.from('daily_focus').upsert({
    user_id:currentUser.id,
    focus_date:d,
    main_focus:$('#fMain').value.trim(),
    trading_focus:$('#fTrading').value.trim(),
    fitness_focus:$('#fFitness').value.trim(),
    learning_focus:$('#fLearning').value.trim(),
    next_action:$('#fNext').value.trim(),
    reflection:$('#fReflection').value.trim(),
    updated_at:new Date().toISOString()
  },{onConflict:'user_id,focus_date'});
  if(error)return alert(error.message);
  await loadFocus();
  renderFocus();
  showPage('home');
};

$('#taskForm').onsubmit=async e=>{
  e.preventDefault();
  if(!dailyTasksReady)return alert('Bitte zuerst die daily_tasks-Migration in Supabase ausführen.');
  const title=$('#taskTitle').value.trim();
  if(!title)return;
  const category=$('#taskCategory').value;
  const repeats=$('#taskRepeatDaily').checked;
  const position=dailyTasks.length?Math.max(...dailyTasks.map(task=>Number(task.position)||0))+1:0;
  let recurringTask=null;

  if(repeats){
    if(!recurringTasksReady)return alert('Bitte zuerst die Habits-&-Reminders-Migration in Supabase ausführen.');
    const recurringPosition=recurringTasks.length?Math.max(...recurringTasks.map(task=>Number(task.position)||0))+1:0;
    const recurringResult=await sb.from('recurring_tasks').insert({
      user_id:currentUser.id,
      title,
      category,
      starts_on:focusDateKey(),
      position:recurringPosition
    }).select().single();
    if(recurringResult.error)return alert(recurringResult.error.message);
    recurringTask=recurringResult.data;
  }

  const {data,error}=await sb.from('daily_tasks').insert({
    user_id:currentUser.id,
    task_date:focusDateKey(),
    title,
    category,
    position,
    source_recurring_task_id:recurringTask?.id||null
  }).select().single();
  if(error){
    if(recurringTask)await sb.from('recurring_tasks').delete().eq('id',recurringTask.id);
    return alert(error.message);
  }
  dailyTasks.push(data);
  if(recurringTask)recurringTasks.push(recurringTask);
  $('#taskTitle').value='';
  $('#taskRepeatDaily').checked=false;
  $('#taskTitle').focus();
  renderDailyTasks();
};

async function toggleDailyTask(id,isCompleted){
  const {error}=await sb.from('daily_tasks').update({
    is_completed:isCompleted,
    updated_at:new Date().toISOString()
  }).eq('id',id);
  if(error){
    alert(error.message);
    await loadFocus();
  }else{
    const task=dailyTasks.find(item=>item.id===id);
    if(task)task.is_completed=isCompleted;
  }
  renderDailyTasks();
}

async function deleteDailyTask(id){
  const task=dailyTasks.find(item=>item.id===id);
  if(task?.source_recurring_task_id){
    const {error:skipError}=await sb.from('recurring_task_skips').upsert({
      user_id:currentUser.id,
      recurring_task_id:task.source_recurring_task_id,
      skip_date:focusDateKey()
    },{onConflict:'user_id,recurring_task_id,skip_date',ignoreDuplicates:true});
    if(skipError)return alert(skipError.message);
  }
  const {error}=await sb.from('daily_tasks').delete().eq('id',id);
  if(error)return alert(error.message);
  dailyTasks=dailyTasks.filter(item=>item.id!==id);
  renderDailyTasks();
}

async function stopRecurringTask(id){
  const task=recurringTasks.find(item=>item.id===id);
  if(!task||!confirm(`„${task.title}“ nicht mehr täglich erstellen?`))return;
  const {error}=await sb.from('recurring_tasks').update({
    is_active:false,
    updated_at:new Date().toISOString()
  }).eq('id',id);
  if(error)return alert(error.message);
  recurringTasks=recurringTasks.filter(item=>item.id!==id);
  renderRecurringTasks();
}

function renderRecurringTasks(){
  const container=$('#recurringTaskList');
  if(!container)return;
  $('#recurringSetupNotice').classList.toggle('hide',recurringTasksReady);
  $('#taskRepeatDaily').disabled=!recurringTasksReady;
  if(!recurringTasksReady){
    container.innerHTML='<div class="recurring-empty">Nach der Habits-Migration kannst du tägliche Aufgaben anlegen.</div>';
    return;
  }
  container.innerHTML=recurringTasks.length?recurringTasks.map(task=>`
    <div class="recurring-task-item">
      <span>↻</span>
      <div><b>${escapeHtml(task.title)}</b><small>${escapeHtml(task.category||'Allgemein')} · jeden Tag</small></div>
      <button type="button" onclick="stopRecurringTask('${task.id}')" aria-label="Wiederholung beenden">Serie beenden</button>
    </div>
  `).join(''):'<div class="recurring-empty">Noch keine täglichen Aufgaben. Aktiviere beim Hinzufügen „Jeden Tag wiederholen“.</div>';
}

function renderDailyTasks(){
  const list=$('#dailyTaskList');
  const homeList=$('#homeTaskList');
  const completed=dailyTasks.filter(task=>task.is_completed).length;
  const total=dailyTasks.length;
  const percent=total?Math.round(completed/total*100):0;

  $('#taskCounter').textContent=`${completed}/${total}`;
  $('#homeTaskProgress').textContent=`${completed}/${total} erledigt`;
  $('#taskProgressBar').style.width=`${percent}%`;
  $('#taskSetupNotice').classList.toggle('hide',dailyTasksReady);

  if(!dailyTasksReady){
    list.innerHTML='<div class="empty">Nach der Supabase-Einrichtung erscheinen hier deine Aufgaben.</div>';
    homeList.innerHTML='<div class="home-task-empty">To-do-Liste noch nicht eingerichtet</div>';
    renderRecurringTasks();
    return;
  }

  if(!total){
    list.innerHTML='<div class="empty">Noch keine Aufgaben für heute.</div>';
    homeList.innerHTML='<div class="home-task-empty">Noch keine Aufgaben – plane deinen Tag.</div>';
    renderRecurringTasks();
    return;
  }

  list.innerHTML=dailyTasks.map(task=>`
    <div class="daily-task ${task.is_completed?'done':''}">
      <input class="task-check" type="checkbox" ${task.is_completed?'checked':''} onchange="toggleDailyTask('${task.id}',this.checked)" aria-label="Aufgabe erledigt">
      <div class="task-copy"><b>${escapeHtml(task.title)}</b><span>${escapeHtml(task.category||'Allgemein')}${task.source_recurring_task_id?' · ↻ Täglich':''}</span></div>
      <button class="task-delete" onclick="deleteDailyTask('${task.id}')" aria-label="${task.source_recurring_task_id?'Nur heute entfernen':'Aufgabe löschen'}" title="${task.source_recurring_task_id?'Nur heute entfernen – die Serie bleibt aktiv':'Aufgabe löschen'}">✕</button>
    </div>
  `).join('');

  const openTasks=dailyTasks.filter(task=>!task.is_completed);
  const homeTasks=(openTasks.length?openTasks:dailyTasks).slice(0,4);
  homeList.innerHTML=homeTasks.map(task=>`
    <button class="home-task ${task.is_completed?'done':''}" onclick="showPage('focus')">
      <span>${task.is_completed?'✓':'○'}</span>
      <b>${escapeHtml(task.title)}</b>
    </button>
  `).join('');
  renderRecurringTasks();
}

function renderFocus(){
  $('#mainFocus').textContent=focus?.main_focus||'Definiere deinen Fokus.';
  $('#nextFocus').textContent=focus?.next_action||'Der nächste kleine Schritt zählt.';
  $('#tradingFocus').textContent=focus?.trading_focus||'Offen';
  $('#fitnessFocus').textContent=focus?.fitness_focus||'Offen';
  $('#learningFocus').textContent=focus?.learning_focus||'Offen';
  $('#fMain').value=focus?.main_focus||'';
  $('#fTrading').value=focus?.trading_focus||'';
  $('#fFitness').value=focus?.fitness_focus||'';
  $('#fLearning').value=focus?.learning_focus||'';
  $('#fNext').value=focus?.next_action||'';
  $('#fReflection').value=focus?.reflection||'';
  renderDailyTasks();
}
