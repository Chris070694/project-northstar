
let fitnessPlans=[];
let fitnessPlanExercises=[];
let fitnessSessions=[];
let fitnessSessionExercises=[];
let legacyExercises=[];
let selectedFitnessPlanId=null;
let activeFitnessSession=null;
let fitnessReady=true;

function fitnessDateKey(date=new Date()){
  const year=date.getFullYear();
  const month=String(date.getMonth()+1).padStart(2,'0');
  const day=String(date.getDate()).padStart(2,'0');
  return `${year}-${month}-${day}`;
}

function isMissingFitnessTable(error){
  const message=String(error?.message||'');
  return error?.code==='42P01'||(/fitness_(plans|plan_exercises|sessions|session_exercises)/.test(message)&&/does not exist|schema cache/i.test(message));
}

async function loadFitness(){
  const [legacyResult,plansResult,exerciseResult,sessionResult]=await Promise.all([
    sb.from('fitness_exercises').select('*').order('created_at',{ascending:true}),
    sb.from('fitness_plans').select('*').order('position',{ascending:true}),
    sb.from('fitness_plan_exercises').select('*').order('position',{ascending:true}).order('created_at',{ascending:true}),
    sb.from('fitness_sessions').select('*').order('started_at',{ascending:false}).limit(30)
  ]);

  legacyExercises=legacyResult.error?[]:(legacyResult.data||[]);

  const schemaError=[plansResult.error,exerciseResult.error,sessionResult.error].find(Boolean);
  if(schemaError){
    if(!isMissingFitnessTable(schemaError))throw schemaError;
    fitnessReady=false;
    fitnessPlans=[];
    fitnessPlanExercises=[];
    fitnessSessions=[];
    fitnessSessionExercises=[];
    activeFitnessSession=null;
    return;
  }

  fitnessReady=true;
  fitnessPlans=plansResult.data||[];
  fitnessPlanExercises=exerciseResult.data||[];
  fitnessSessions=sessionResult.data||[];
  activeFitnessSession=fitnessSessions.find(session=>session.status==='active')||null;

  if(activeFitnessSession){
    const {data,error}=await sb.from('fitness_session_exercises').select('*').eq('session_id',activeFitnessSession.id).order('position',{ascending:true});
    if(error)throw error;
    fitnessSessionExercises=data||[];
  }else{
    fitnessSessionExercises=[];
  }

  const saved=localStorage.getItem(`northstar-fitness-plan-${currentUser.id}`);
  selectedFitnessPlanId=(saved&&fitnessPlans.some(plan=>plan.id===saved))?saved:(fitnessPlans[0]?.id||null);
}

async function refreshFitness(){
  await loadFitness();
  renderFitness();
}

async function createDefaultFitnessPlans(){
  if(!fitnessReady)return alert('Bitte zuerst die Fitness-Migration in Supabase ausführen.');
  if(fitnessPlans.length)return;
  const {data,error}=await sb.from('fitness_plans').insert([
    {user_id:currentUser.id,name:'Training A',position:0,accent:'cyan'},
    {user_id:currentUser.id,name:'Training B',position:1,accent:'violet'}
  ]).select();
  if(error)return alert(error.message);

  const planA=(data||[]).find(plan=>plan.name==='Training A')||data?.[0];
  if(planA&&legacyExercises.length){
    const rows=legacyExercises.map((exercise,index)=>({
      user_id:currentUser.id,
      plan_id:planA.id,
      name:exercise.name,
      muscle_group:exercise.muscle_group||'',
      target_sets:Number(exercise.default_sets)||3,
      target_reps:Number(exercise.default_reps)||10,
      target_weight:Number(exercise.default_weight)||0,
      position:index
    }));
    const {error:importError}=await sb.from('fitness_plan_exercises').insert(rows);
    if(importError)alert('Pläne wurden erstellt, alte Übungen konnten aber nicht übernommen werden: '+importError.message);
  }

  selectedFitnessPlanId=planA?.id||data?.[0]?.id||null;
  await refreshFitness();
}

function selectFitnessPlan(id){
  selectedFitnessPlanId=id;
  localStorage.setItem(`northstar-fitness-plan-${currentUser.id}`,id);
  renderFitness();
}

function openExercise(planId=selectedFitnessPlanId){
  if(!fitnessReady)return alert('Bitte zuerst die Fitness-Migration in Supabase ausführen.');
  if(!fitnessPlans.length)return alert('Erstelle zuerst deinen 2er-Split.');
  $('#exPlan').innerHTML=fitnessPlans.map(plan=>`<option value="${plan.id}" ${plan.id===planId?'selected':''}>${escapeHtml(plan.name)}</option>`).join('');
  $('#exerciseModal').classList.add('open');
}

function closeExercise(){
  $('#exerciseModal').classList.remove('open');
}

$('#exerciseForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const planId=$('#exPlan').value;
  const planRows=fitnessPlanExercises.filter(exercise=>exercise.plan_id===planId);
  const position=planRows.length?Math.max(...planRows.map(exercise=>Number(exercise.position)||0))+1:0;
  const {error}=await sb.from('fitness_plan_exercises').insert({
    user_id:currentUser.id,
    plan_id:planId,
    name:$('#exName').value.trim(),
    muscle_group:$('#exMuscle').value.trim(),
    target_sets:Number($('#exSets').value)||3,
    target_reps:Number($('#exReps').value)||10,
    target_weight:Number($('#exWeight').value)||0,
    position
  });
  if(error)return alert(error.message);
  e.target.reset();
  closeExercise();
  selectedFitnessPlanId=planId;
  await refreshFitness();
});

async function deleteExercise(id){
  if(!confirm('Übung aus dem Trainingsplan löschen?'))return;
  const {error}=await sb.from('fitness_plan_exercises').delete().eq('id',id);
  if(error)return alert(error.message);
  await refreshFitness();
}

async function moveFitnessExercise(id,direction){
  const current=fitnessPlanExercises.find(exercise=>exercise.id===id);
  if(!current)return;
  const rows=fitnessPlanExercises.filter(exercise=>exercise.plan_id===current.plan_id).sort((a,b)=>a.position-b.position);
  const index=rows.findIndex(exercise=>exercise.id===id);
  const swapIndex=index+direction;
  if(index<0||swapIndex<0||swapIndex>=rows.length)return;
  const other=rows[swapIndex];
  const currentPosition=current.position;
  const [first,second]=await Promise.all([
    sb.from('fitness_plan_exercises').update({position:other.position,updated_at:new Date().toISOString()}).eq('id',current.id),
    sb.from('fitness_plan_exercises').update({position:currentPosition,updated_at:new Date().toISOString()}).eq('id',other.id)
  ]);
  if(first.error||second.error)return alert(first.error?.message||second.error?.message);
  await refreshFitness();
}

async function startFitnessWorkout(planId=selectedFitnessPlanId){
  if(!fitnessReady)return alert('Bitte zuerst die Fitness-Migration in Supabase ausführen.');
  if(activeFitnessSession)return alert('Es läuft bereits ein Training.');
  const plan=fitnessPlans.find(item=>item.id===planId);
  if(!plan)return alert('Wähle zuerst einen Trainingsplan.');
  const exercises=fitnessPlanExercises.filter(exercise=>exercise.plan_id===plan.id).sort((a,b)=>a.position-b.position);
  if(!exercises.length)return alert('Füge diesem Plan zuerst mindestens eine Übung hinzu.');

  const {data:session,error}=await sb.from('fitness_sessions').insert({
    user_id:currentUser.id,
    plan_id:plan.id,
    plan_name_snapshot:plan.name,
    session_date:fitnessDateKey(),
    status:'active'
  }).select().single();
  if(error)return alert(error.message);

  const rows=exercises.map((exercise,index)=>({
    user_id:currentUser.id,
    session_id:session.id,
    plan_exercise_id:exercise.id,
    exercise_name:exercise.name,
    muscle_group:exercise.muscle_group||'',
    target_sets:exercise.target_sets,
    target_reps:exercise.target_reps,
    actual_weight:Number(exercise.target_weight)||0,
    is_completed:false,
    position:index
  }));
  const {error:exerciseError}=await sb.from('fitness_session_exercises').insert(rows);
  if(exerciseError){
    await sb.from('fitness_sessions').delete().eq('id',session.id);
    return alert(exerciseError.message);
  }
  await refreshFitness();
}

async function toggleFitnessExercise(id,isCompleted){
  const {error}=await sb.from('fitness_session_exercises').update({
    is_completed:isCompleted,
    completed_at:isCompleted?new Date().toISOString():null,
    updated_at:new Date().toISOString()
  }).eq('id',id);
  if(error)return alert(error.message);
  const exercise=fitnessSessionExercises.find(item=>item.id===id);
  if(exercise){
    exercise.is_completed=isCompleted;
    exercise.completed_at=isCompleted?new Date().toISOString():null;
  }
  renderFitness();
}

async function updateFitnessWeight(id,value){
  const weight=Math.max(0,Number(value)||0);
  const {error}=await sb.from('fitness_session_exercises').update({actual_weight:weight,updated_at:new Date().toISOString()}).eq('id',id);
  if(error)return alert(error.message);
  const exercise=fitnessSessionExercises.find(item=>item.id===id);
  if(exercise)exercise.actual_weight=weight;
}

async function finishFitnessWorkout(){
  if(!activeFitnessSession)return;
  const completed=fitnessSessionExercises.filter(exercise=>exercise.is_completed).length;
  if(!completed)return alert('Hake zuerst mindestens eine Übung ab.');
  if(completed<fitnessSessionExercises.length&&!confirm('Training mit offenen Übungen abschließen?'))return;

  const weightUpdates=fitnessSessionExercises
    .filter(exercise=>exercise.plan_exercise_id)
    .map(exercise=>sb.from('fitness_plan_exercises').update({
      target_weight:Number(exercise.actual_weight)||0,
      updated_at:new Date().toISOString()
    }).eq('id',exercise.plan_exercise_id));
  const results=await Promise.all(weightUpdates);
  const weightError=results.find(result=>result.error)?.error;
  if(weightError)return alert(weightError.message);

  const {error}=await sb.from('fitness_sessions').update({
    status:'completed',
    completed_at:new Date().toISOString(),
    updated_at:new Date().toISOString()
  }).eq('id',activeFitnessSession.id);
  if(error)return alert(error.message);
  await refreshFitness();
}

async function cancelFitnessWorkout(){
  if(!activeFitnessSession||!confirm('Laufendes Training wirklich verwerfen?'))return;
  const {error}=await sb.from('fitness_sessions').delete().eq('id',activeFitnessSession.id);
  if(error)return alert(error.message);
  await refreshFitness();
}

function formatFitnessDate(value){
  if(!value)return'–';
  const date=new Date(String(value).length===10?`${value}T12:00:00`:value);
  return new Intl.DateTimeFormat('de-AT',{day:'2-digit',month:'2-digit',year:'numeric'}).format(date);
}

function renderHomeFitness(){
  const plan=fitnessPlans.find(item=>item.id===selectedFitnessPlanId)||fitnessPlans[0];
  if(!fitnessReady){
    $('#homeFitnessPlan').textContent='Fitness-Datenbank einrichten';
    $('#homeFitnessStatus').textContent='Die neue Fitness-Version wartet auf die Supabase-Migration.';
    return;
  }
  if(activeFitnessSession){
    const completed=fitnessSessionExercises.filter(exercise=>exercise.is_completed).length;
    $('#homeFitnessPlan').textContent=activeFitnessSession.plan_name_snapshot+' läuft';
    $('#homeFitnessStatus').textContent=`${completed}/${fitnessSessionExercises.length} Übungen erledigt`;
    return;
  }
  if(!plan){
    $('#homeFitnessPlan').textContent='2er-Split einrichten';
    $('#homeFitnessStatus').textContent='Training A und B warten auf dich.';
    return;
  }
  const count=fitnessPlanExercises.filter(exercise=>exercise.plan_id===plan.id).length;
  $('#homeFitnessPlan').textContent=plan.name;
  $('#homeFitnessStatus').textContent=`${count} Übungen · bereit für dein nächstes Training`;
}

function renderActiveFitnessWorkout(){
  const container=$('#activeWorkout');
  if(!activeFitnessSession){
    container.classList.add('hide');
    container.innerHTML='';
    return;
  }
  const completed=fitnessSessionExercises.filter(exercise=>exercise.is_completed).length;
  const total=fitnessSessionExercises.length;
  const percent=total?Math.round(completed/total*100):0;
  container.classList.remove('hide');
  container.innerHTML=`
    <div class="active-workout-head">
      <div><div class="eyebrow">Training läuft</div><h2>${escapeHtml(activeFitnessSession.plan_name_snapshot)}</h2><div class="sub">${completed}/${total} Übungen abgeschlossen</div></div>
      <div class="actions"><button class="btn danger" onclick="cancelFitnessWorkout()">Verwerfen</button><button class="btn primary" onclick="finishFitnessWorkout()">Training abschließen</button></div>
    </div>
    <div class="fitness-progress"><div style="width:${percent}%"></div></div>
    <div class="workout-exercise-list">
      ${fitnessSessionExercises.map(exercise=>`
        <div class="workout-exercise ${exercise.is_completed?'done':''}">
          <input class="fit-check" type="checkbox" ${exercise.is_completed?'checked':''} onchange="toggleFitnessExercise('${exercise.id}',this.checked)" aria-label="Übung erledigt">
          <div class="workout-exercise-copy"><b>${escapeHtml(exercise.exercise_name)}</b><span>${escapeHtml(exercise.muscle_group||'Allgemein')} · ${exercise.target_sets} × ${exercise.target_reps}</span></div>
          <label class="workout-weight"><span>Gewicht</span><div><input type="number" min="0" step=".5" value="${Number(exercise.actual_weight)||0}" onchange="updateFitnessWeight('${exercise.id}',this.value)"><small>kg</small></div></label>
        </div>
      `).join('')}
    </div>
  `;
}

function renderFitness(){
  $('#fitnessSetupNotice').classList.toggle('hide',fitnessReady);
  $('#fitnessEmptyState').classList.toggle('hide',!fitnessReady||fitnessPlans.length>0);
  $('#fitnessWorkspace').classList.toggle('hide',!fitnessReady||!fitnessPlans.length);
  $('#fitnessStartBtn').disabled=!fitnessReady||!fitnessPlans.length||Boolean(activeFitnessSession);

  const completedSessions=fitnessSessions.filter(session=>session.status==='completed');
  const weekStart=new Date();
  const dayOffset=(weekStart.getDay()+6)%7;
  weekStart.setDate(weekStart.getDate()-dayOffset);
  weekStart.setHours(0,0,0,0);
  const weekCount=completedSessions.filter(session=>new Date(session.completed_at||session.session_date)>=weekStart).length;
  const selectedPlan=fitnessPlans.find(plan=>plan.id===selectedFitnessPlanId)||fitnessPlans[0];
  const lastSession=completedSessions[0];

  $('#fitnessWeekCount').textContent=String(weekCount);
  $('#fitnessCurrentPlan').textContent=selectedPlan?.name||'–';
  $('#fitnessLastWorkout').textContent=lastSession?formatFitnessDate(lastSession.completed_at||lastSession.session_date):'–';

  if(fitnessReady&&fitnessPlans.length){
    $('#fitnessPlanTabs').innerHTML=fitnessPlans.map(plan=>`
      <button class="fitness-plan-tab ${plan.id===selectedFitnessPlanId?'active':''}" onclick="selectFitnessPlan('${plan.id}')">${escapeHtml(plan.name)}</button>
    `).join('');

    const rows=fitnessPlanExercises.filter(exercise=>exercise.plan_id===selectedFitnessPlanId).sort((a,b)=>a.position-b.position);
    $('#fitnessPlanList').innerHTML=rows.length?rows.map((exercise,index)=>`
      <div class="fitness-plan-exercise">
        <div class="fitness-order">${index+1}</div>
        <div class="fitness-exercise-copy"><b>${escapeHtml(exercise.name)}</b><span>${escapeHtml(exercise.muscle_group||'Allgemein')}</span></div>
        <div class="fitness-target"><small>Sätze × Wdh.</small><b>${exercise.target_sets} × ${exercise.target_reps}</b></div>
        <div class="fitness-target"><small>Letztes Gewicht</small><b>${Number(exercise.target_weight||0).toFixed(1)} kg</b></div>
        <div class="fitness-row-actions">
          <button class="mini-btn" onclick="moveFitnessExercise('${exercise.id}',-1)" ${index===0?'disabled':''}>↑</button>
          <button class="mini-btn" onclick="moveFitnessExercise('${exercise.id}',1)" ${index===rows.length-1?'disabled':''}>↓</button>
          <button class="mini-btn danger-text" onclick="deleteExercise('${exercise.id}')">✕</button>
        </div>
      </div>
    `).join(''):'<div class="empty">Noch keine Übungen in diesem Plan.</div>';

    $('#fitnessHistory').innerHTML=completedSessions.length?completedSessions.slice(0,8).map(session=>`
      <div class="fitness-history-item"><span>${formatFitnessDate(session.completed_at||session.session_date)}</span><b>${escapeHtml(session.plan_name_snapshot)}</b><small>Abgeschlossen</small></div>
    `).join(''):'<div class="empty">Noch kein Training abgeschlossen.</div>';
  }

  renderActiveFitnessWorkout();
  renderHomeFitness();
}
