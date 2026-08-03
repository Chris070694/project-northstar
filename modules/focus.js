
let dailyTasks=[];
let dailyTasksReady=true;

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

async function loadFocus(){
  const d=focusDateKey();
  const [focusResult,taskResult]=await Promise.all([
    sb.from('daily_focus').select('*').eq('focus_date',d).maybeSingle(),
    sb.from('daily_tasks').select('*').eq('task_date',d).order('position',{ascending:true}).order('created_at',{ascending:true})
  ]);
  if(focusResult.error)throw focusResult.error;
  focus=focusResult.data||null;
  if(taskResult.error){
    if(!isMissingDailyTasksTable(taskResult.error))throw taskResult.error;
    dailyTasksReady=false;
    dailyTasks=[];
    return;
  }
  dailyTasksReady=true;
  dailyTasks=taskResult.data||[];
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
  const position=dailyTasks.length?Math.max(...dailyTasks.map(task=>Number(task.position)||0))+1:0;
  const {data,error}=await sb.from('daily_tasks').insert({
    user_id:currentUser.id,
    task_date:focusDateKey(),
    title,
    category:$('#taskCategory').value,
    position
  }).select().single();
  if(error)return alert(error.message);
  dailyTasks.push(data);
  $('#taskTitle').value='';
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
  const {error}=await sb.from('daily_tasks').delete().eq('id',id);
  if(error)return alert(error.message);
  dailyTasks=dailyTasks.filter(item=>item.id!==id);
  renderDailyTasks();
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
    return;
  }

  if(!total){
    list.innerHTML='<div class="empty">Noch keine Aufgaben für heute.</div>';
    homeList.innerHTML='<div class="home-task-empty">Noch keine Aufgaben – plane deinen Tag.</div>';
    return;
  }

  list.innerHTML=dailyTasks.map(task=>`
    <div class="daily-task ${task.is_completed?'done':''}">
      <input class="task-check" type="checkbox" ${task.is_completed?'checked':''} onchange="toggleDailyTask('${task.id}',this.checked)" aria-label="Aufgabe erledigt">
      <div class="task-copy"><b>${escapeHtml(task.title)}</b><span>${escapeHtml(task.category||'Allgemein')}</span></div>
      <button class="task-delete" onclick="deleteDailyTask('${task.id}')" aria-label="Aufgabe löschen">✕</button>
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
