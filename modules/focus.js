let dailyTasks=[];
let dailyTasksReady=true;
let taskPriorityReady=true;
let persistentTasksReady=true;
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

function isMissingTaskPrioritySchema(error){
  const message=`${error?.code||''} ${error?.message||''} ${error?.details||''}`.toLowerCase();
  return message.includes('42703')||message.includes('pgrst204')||
    (message.includes('is_priority')&&/does not exist|schema cache|not find/i.test(message));
}

function isMissingPersistentTasksSchema(error){
  const message=`${error?.code||''} ${error?.message||''} ${error?.details||''}`.toLowerCase();
  return message.includes('42703')||message.includes('pgrst204')||
    (message.includes('keep_until_done')&&/does not exist|schema cache|not find/i.test(message));
}

async function loadFocus(){
  const d=focusDateKey();
  const [taskResult,priorityResult,persistentResult,recurringResult,skipResult]=await Promise.all([
    sb.from('daily_tasks').select('*').eq('task_date',d).order('position',{ascending:true}).order('created_at',{ascending:true}),
    sb.from('daily_tasks').select('is_priority').limit(1),
    sb.from('daily_tasks').select('*').eq('keep_until_done',true).eq('is_completed',false).lt('task_date',d).order('created_at',{ascending:true}),
    sb.from('recurring_tasks').select('*').eq('is_active',true).order('position',{ascending:true}).order('created_at',{ascending:true}),
    sb.from('recurring_task_skips').select('recurring_task_id').eq('skip_date',d)
  ]);
  focus=null;

  if(taskResult.error){
    if(!isMissingDailyTasksTable(taskResult.error)&&!isMissingRecurringTasksSchema(taskResult.error))throw taskResult.error;
    dailyTasksReady=!isMissingDailyTasksTable(taskResult.error);
    recurringTasksReady=false;
    dailyTasks=[];
    recurringTasks=[];
    taskPriorityReady=false;
    persistentTasksReady=false;
    return;
  }
  dailyTasksReady=true;
  dailyTasks=taskResult.data||[];
  if(priorityResult.error){
    if(!isMissingTaskPrioritySchema(priorityResult.error)&&!isMissingDailyTasksTable(priorityResult.error))throw priorityResult.error;
    taskPriorityReady=false;
  }else{
    taskPriorityReady=true;
  }

  if(persistentResult.error){
    if(!isMissingPersistentTasksSchema(persistentResult.error)&&!isMissingDailyTasksTable(persistentResult.error))throw persistentResult.error;
    persistentTasksReady=false;
  }else{
    persistentTasksReady=true;
    const carriedTasks=persistentResult.data||[];
    if(carriedTasks.length){
      const {error:carryError}=await sb.from('daily_tasks').update({
        task_date:d,
        is_priority:false,
        updated_at:new Date().toISOString()
      }).in('id',carriedTasks.map(task=>task.id));
      if(carryError)throw carryError;
      const refreshed=await sb.from('daily_tasks').select('*').eq('task_date',d).order('position',{ascending:true}).order('created_at',{ascending:true});
      if(refreshed.error)throw refreshed.error;
      dailyTasks=refreshed.data||[];
    }
  }

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

$('#taskForm').onsubmit=async e=>{
  e.preventDefault();
  if(!dailyTasksReady)return alert('Bitte zuerst die daily_tasks-Migration in Supabase ausführen.');
  const title=$('#taskTitle').value.trim();
  if(!title)return;
  const category=$('#taskCategory').value;
  const repeats=$('#taskRepeatDaily').checked;
  const keepUntilDone=$('#taskKeepUntilDone').checked;
  const position=dailyTasks.length?Math.max(...dailyTasks.map(task=>Number(task.position)||0))+1:0;
  let recurringTask=null;

  if(keepUntilDone&&!persistentTasksReady)return alert('Bitte zuerst die Migration für offene Aufgaben in Supabase ausführen.');
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

  const payload={
    user_id:currentUser.id,
    task_date:focusDateKey(),
    title,
    category,
    position,
    source_recurring_task_id:recurringTask?.id||null
  };
  if(persistentTasksReady)payload.keep_until_done=keepUntilDone&&!repeats;
  const {data,error}=await sb.from('daily_tasks').insert(payload).select().single();
  if(error){
    if(recurringTask)await sb.from('recurring_tasks').delete().eq('id',recurringTask.id);
    return alert(error.message);
  }
  dailyTasks.push(data);
  if(recurringTask)recurringTasks.push(recurringTask);
  $('#taskTitle').value='';
  $('#taskRepeatDaily').checked=false;
  $('#taskKeepUntilDone').checked=false;
  $('#taskTitle').focus();
  renderDailyTasks();
};

$('#taskRepeatDaily').onchange=event=>{
  if(event.target.checked)$('#taskKeepUntilDone').checked=false;
};

$('#taskKeepUntilDone').onchange=event=>{
  if(event.target.checked)$('#taskRepeatDaily').checked=false;
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

async function toggleTaskPriority(id){
  if(!taskPriorityReady)return alert('Bitte zuerst die To-do-Prioritäts-Migration in Supabase ausführen.');
  const task=dailyTasks.find(item=>item.id===id);
  if(!task)return;
  const nextValue=!task.is_priority;
  if(nextValue){
    const {error:clearError}=await sb.from('daily_tasks').update({
      is_priority:false,
      updated_at:new Date().toISOString()
    }).eq('task_date',focusDateKey()).eq('is_priority',true);
    if(clearError)return alert(clearError.message);
  }
  const {error}=await sb.from('daily_tasks').update({
    is_priority:nextValue,
    updated_at:new Date().toISOString()
  }).eq('id',id);
  if(error){
    if(isMissingTaskPrioritySchema(error))taskPriorityReady=false;
    alert(error.message);
    await loadFocus();
  }else{
    dailyTasks.forEach(item=>{item.is_priority=item.id===id?nextValue:false});
  }
  renderFocus();
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

function taskMeta(task){
  const parts=[escapeHtml(task.category||'Allgemein')];
  if(task.keep_until_done)parts.push('◎ Bleibt offen');
  if(task.source_recurring_task_id)parts.push('↻ Täglich');
  return parts.join(' · ');
}

function dailyTaskMarkup(task){
  return `
    <div class="daily-task ${task.is_completed?'done':''} ${task.is_priority?'priority':''} ${task.keep_until_done?'persistent':''}">
      <input class="task-check" type="checkbox" ${task.is_completed?'checked':''} onchange="toggleDailyTask('${task.id}',this.checked)" aria-label="Aufgabe erledigt">
      <button class="task-priority ${task.is_priority?'active':''}" type="button" onclick="toggleTaskPriority('${task.id}')" ${taskPriorityReady?'':'disabled'} aria-label="${task.is_priority?'Top-Priorität entfernen':'Als Top-Priorität markieren'}" title="${task.is_priority?'Top-Priorität entfernen':'Als Top-Priorität markieren'}">${task.is_priority?'★':'☆'}</button>
      <div class="task-copy"><b>${escapeHtml(task.title)}</b><span>${taskMeta(task)}</span></div>
      <button class="task-delete" onclick="deleteDailyTask('${task.id}')" aria-label="${task.source_recurring_task_id?'Nur heute entfernen':'Aufgabe löschen'}" title="${task.source_recurring_task_id?'Nur heute entfernen – die Serie bleibt aktiv':'Aufgabe löschen'}">✕</button>
    </div>
  `;
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
  $('#taskPrioritySetupNotice')?.classList.toggle('hide',taskPriorityReady||!dailyTasksReady);
  $('#persistentTaskSetupNotice')?.classList.toggle('hide',persistentTasksReady||!dailyTasksReady);
  $('#taskKeepUntilDone').disabled=!persistentTasksReady;

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

  const openTasks=dailyTasks.filter(task=>!task.is_completed);
  const completedTasks=dailyTasks.filter(task=>task.is_completed);
  const openMarkup=openTasks.length?openTasks.map(dailyTaskMarkup).join(''):'<div class="empty task-all-done">Alles erledigt ✓</div>';
  const completedMarkup=completedTasks.length?`<details class="task-completed-group"><summary>Erledigt (${completedTasks.length})</summary><div>${completedTasks.map(dailyTaskMarkup).join('')}</div></details>`:'';
  list.innerHTML=openMarkup+completedMarkup;

  const homeTasks=openTasks.slice(0,5);
  homeList.innerHTML=homeTasks.length?homeTasks.map(task=>`
    <div class="home-task ${task.is_completed?'done':''} ${task.is_priority?'priority':''}">
      <input class="task-check" type="checkbox" ${task.is_completed?'checked':''} onchange="toggleDailyTask('${task.id}',this.checked)" aria-label="Aufgabe erledigt">
      <button class="task-priority ${task.is_priority?'active':''}" type="button" onclick="toggleTaskPriority('${task.id}')" ${taskPriorityReady?'':'disabled'} aria-label="${task.is_priority?'Top-Priorität entfernen':'Als Top-Priorität markieren'}" title="${task.is_priority?'Top-Priorität entfernen':'Als Top-Priorität markieren'}">${task.is_priority?'★':'☆'}</button>
      <div class="home-task-copy"><b>${escapeHtml(task.title)}</b><small>${taskMeta(task)}</small></div>
    </div>
  `).join(''):'<div class="home-task-empty">Alles erledigt für heute ✓</div>';
  renderRecurringTasks();
}

function renderFocus(){
  const priorityTask=dailyTasks.find(task=>task.is_priority&&!task.is_completed);
  const openCount=dailyTasks.filter(task=>!task.is_completed).length;
  if(priorityTask){
    $('#mainFocus').textContent=priorityTask.title;
    $('#nextFocus').textContent=priorityTask.is_completed?'Top-Priorität erledigt ✓':`★ Top-Priorität · ${priorityTask.category||'Allgemein'}`;
  }else if(openCount){
    $('#mainFocus').textContent='Wähle deine Top-Priorität.';
    $('#nextFocus').textContent=taskPriorityReady?`${openCount} offene Aufgabe${openCount===1?'':'n'} · Tippe auf ☆`:'Prioritätsfunktion noch einrichten';
  }else{
    $('#mainFocus').textContent=dailyTasks.length?'Alles erledigt für heute ✓':'Plane deinen Tag mit einer Aufgabe.';
    $('#nextFocus').textContent=dailyTasks.length?'Deine offenen Aufgaben sind geschafft.':'Noch keine Aufgaben angelegt.';
  }
  renderDailyTasks();
}
