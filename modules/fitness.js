let fitnessPlans = [];
let fitnessPlanExercises = [];
let fitnessSessions = [];
let fitnessSessionExercises = [];
let fitnessSetLogs = [];
let legacyExercises = [];
let selectedFitnessPlanId = null;
let activeFitnessSession = null;
let fitnessReady = true;
let fitnessSetsReady = true;

function fitnessDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isMissingFitnessTable(error) {
  const message = String(error?.message || '');
  return (
    error?.code === '42P01' ||
    (/fitness_(plans|plan_exercises|sessions|session_exercises)/.test(message) &&
      /does not exist|schema cache/i.test(message))
  );
}

function isMissingFitnessSetsTable(error) {
  const message = `${error?.code || ''} ${error?.message || ''}`;
  return (
    /42P01|PGRST205/i.test(message) ||
    (/fitness_set_logs/i.test(message) &&
      /does not exist|schema cache|could not find/i.test(message))
  );
}

function latestCompletedFitnessSession(planId, excludeId = null) {
  return (
    fitnessSessions.find(
      session =>
        session.status === 'completed' && session.plan_id === planId && session.id !== excludeId,
    ) || null
  );
}

function setLogsForSession(sessionId) {
  return fitnessSetLogs
    .filter(set => set.session_id === sessionId)
    .sort((a, b) => a.set_number - b.set_number);
}

function setLogsForExercise(sessionId, planExerciseId) {
  return fitnessSetLogs
    .filter(set => set.session_id === sessionId && set.plan_exercise_id === planExerciseId)
    .sort((a, b) => a.set_number - b.set_number);
}

async function loadFitness() {
  const [legacyResult, plansResult, exerciseResult, sessionResult] = await Promise.all([
    sb.from('fitness_exercises').select('*').order('created_at', { ascending: true }),
    sb.from('fitness_plans').select('*').order('position', { ascending: true }),
    sb
      .from('fitness_plan_exercises')
      .select('*')
      .order('position', { ascending: true })
      .order('created_at', { ascending: true }),
    sb.from('fitness_sessions').select('*').order('started_at', { ascending: false }).limit(40),
  ]);

  legacyExercises = legacyResult.error ? [] : legacyResult.data || [];
  const schemaError = [plansResult.error, exerciseResult.error, sessionResult.error].find(Boolean);
  if (schemaError) {
    if (!isMissingFitnessTable(schemaError)) throw schemaError;
    fitnessReady = false;
    fitnessSetsReady = false;
    fitnessPlans = [];
    fitnessPlanExercises = [];
    fitnessSessions = [];
    fitnessSessionExercises = [];
    fitnessSetLogs = [];
    activeFitnessSession = null;
    return;
  }

  fitnessReady = true;
  fitnessPlans = plansResult.data || [];
  fitnessPlanExercises = exerciseResult.data || [];
  fitnessSessions = sessionResult.data || [];
  activeFitnessSession = fitnessSessions.find(session => session.status === 'active') || null;

  if (activeFitnessSession) {
    const { data, error } = await sb
      .from('fitness_session_exercises')
      .select('*')
      .eq('session_id', activeFitnessSession.id)
      .order('position', { ascending: true });
    if (error) throw error;
    fitnessSessionExercises = data || [];
  } else fitnessSessionExercises = [];

  fitnessSetsReady = true;
  fitnessSetLogs = [];
  const sessionIds = fitnessSessions.map(session => session.id);
  if (sessionIds.length) {
    const { data, error } = await sb
      .from('fitness_set_logs')
      .select('*')
      .in('session_id', sessionIds)
      .order('set_number', { ascending: true });
    if (error) {
      if (!isMissingFitnessSetsTable(error)) throw error;
      fitnessSetsReady = false;
    } else fitnessSetLogs = data || [];
  } else {
    const { error } = await sb.from('fitness_set_logs').select('id').limit(1);
    if (error) {
      if (!isMissingFitnessSetsTable(error)) throw error;
      fitnessSetsReady = false;
    }
  }

  await backfillActiveFitnessSets();

  const saved = localStorage.getItem(`northstar-fitness-plan-${currentUser.id}`);
  selectedFitnessPlanId =
    saved && fitnessPlans.some(plan => plan.id === saved) ? saved : fitnessPlans[0]?.id || null;
}

async function refreshFitness() {
  await loadFitness();
  renderFitness();
}

async function createDefaultFitnessPlans() {
  if (!fitnessReady) return alert('Bitte zuerst die Fitness-Migration in Supabase ausführen.');
  if (fitnessPlans.length) return;
  const { data, error } = await sb
    .from('fitness_plans')
    .insert([
      { user_id: currentUser.id, name: 'Training A', position: 0, accent: 'cyan' },
      { user_id: currentUser.id, name: 'Training B', position: 1, accent: 'violet' },
    ])
    .select();
  if (error) return alert(error.message);

  const planA = (data || []).find(plan => plan.name === 'Training A') || data?.[0];
  if (planA && legacyExercises.length) {
    const rows = legacyExercises.map((exercise, index) => ({
      user_id: currentUser.id,
      plan_id: planA.id,
      name: exercise.name,
      muscle_group: exercise.muscle_group || '',
      target_sets: Number(exercise.default_sets) || 3,
      target_reps: Number(exercise.default_reps) || 10,
      target_weight: Number(exercise.default_weight) || 0,
      position: index,
    }));
    const { error: importError } = await sb.from('fitness_plan_exercises').insert(rows);
    if (importError)
      alert(
        'Pläne wurden erstellt, alte Übungen konnten aber nicht übernommen werden: ' +
          importError.message,
      );
  }

  selectedFitnessPlanId = planA?.id || data?.[0]?.id || null;
  await refreshFitness();
}

function selectFitnessPlan(id) {
  selectedFitnessPlanId = id;
  localStorage.setItem(`northstar-fitness-plan-${currentUser.id}`, id);
  renderFitness();
}

function openExercise(planId = selectedFitnessPlanId) {
  if (!fitnessReady) return alert('Bitte zuerst die Fitness-Migration in Supabase ausführen.');
  if (!fitnessPlans.length) return alert('Erstelle zuerst deinen 2er-Split.');
  $('#exPlan').innerHTML = fitnessPlans
    .map(
      plan =>
        `<option value="${plan.id}" ${plan.id === planId ? 'selected' : ''}>${escapeHtml(plan.name)}</option>`,
    )
    .join('');
  $('#exerciseModal').classList.add('open');
}

function closeExercise() {
  $('#exerciseModal').classList.remove('open');
}

$('#exerciseForm').addEventListener('submit', async event => {
  event.preventDefault();
  const planId = $('#exPlan').value;
  const planRows = fitnessPlanExercises.filter(exercise => exercise.plan_id === planId);
  const position = planRows.length
    ? Math.max(...planRows.map(exercise => Number(exercise.position) || 0)) + 1
    : 0;
  const { error } = await sb.from('fitness_plan_exercises').insert({
    user_id: currentUser.id,
    plan_id: planId,
    name: $('#exName').value.trim(),
    muscle_group: $('#exMuscle').value.trim(),
    target_sets: Number($('#exSets').value) || 3,
    target_reps: Number($('#exReps').value) || 10,
    target_weight: Number($('#exWeight').value) || 0,
    position,
  });
  if (error) return alert(error.message);
  event.target.reset();
  closeExercise();
  selectedFitnessPlanId = planId;
  await refreshFitness();
});

async function deleteExercise(id) {
  if (!confirm('Übung aus dem Trainingsplan löschen?')) return;
  const { error } = await sb.from('fitness_plan_exercises').delete().eq('id', id);
  if (error) return alert(error.message);
  await refreshFitness();
}

async function moveFitnessExercise(id, direction) {
  const current = fitnessPlanExercises.find(exercise => exercise.id === id);
  if (!current) return;
  const rows = fitnessPlanExercises
    .filter(exercise => exercise.plan_id === current.plan_id)
    .sort((a, b) => a.position - b.position);
  const index = rows.findIndex(exercise => exercise.id === id);
  const swapIndex = index + direction;
  if (index < 0 || swapIndex < 0 || swapIndex >= rows.length) return;
  const other = rows[swapIndex];
  const currentPosition = current.position;
  const [first, second] = await Promise.all([
    sb
      .from('fitness_plan_exercises')
      .update({ position: other.position, updated_at: new Date().toISOString() })
      .eq('id', current.id),
    sb
      .from('fitness_plan_exercises')
      .update({ position: currentPosition, updated_at: new Date().toISOString() })
      .eq('id', other.id),
  ]);
  if (first.error || second.error) return alert(first.error?.message || second.error?.message);
  await refreshFitness();
}

async function loadPreviousFitnessWorkout(planId) {
  const session = latestCompletedFitnessSession(planId);
  if (!session) return { session: null, exercises: [], sets: [] };
  const [exerciseResult, setResult] = await Promise.all([
    sb
      .from('fitness_session_exercises')
      .select('*')
      .eq('session_id', session.id)
      .order('position', { ascending: true }),
    sb
      .from('fitness_set_logs')
      .select('*')
      .eq('session_id', session.id)
      .order('set_number', { ascending: true }),
  ]);
  if (exerciseResult.error) throw exerciseResult.error;
  if (setResult.error) throw setResult.error;
  return { session, exercises: exerciseResult.data || [], sets: setResult.data || [] };
}

async function backfillActiveFitnessSets() {
  if (
    !activeFitnessSession ||
    !fitnessSetsReady ||
    !fitnessSessionExercises.length ||
    setLogsForSession(activeFitnessSession.id).length
  )
    return;
  const previous = await loadPreviousFitnessWorkout(activeFitnessSession.plan_id);
  const rows = [];
  for (const sessionExercise of fitnessSessionExercises) {
    const previousExercise = previous.exercises.find(
      item => item.plan_exercise_id === sessionExercise.plan_exercise_id,
    );
    for (let setNumber = 1; setNumber <= Number(sessionExercise.target_sets); setNumber += 1) {
      const previousSet = previous.sets.find(
        item =>
          item.plan_exercise_id === sessionExercise.plan_exercise_id &&
          Number(item.set_number) === setNumber,
      );
      const previousWeight = previousSet
        ? Number(previousSet.weight_kg)
        : previousExercise
          ? Number(previousExercise.actual_weight)
          : Number(sessionExercise.actual_weight) || 0;
      const previousReps =
        previousSet && Number(previousSet.actual_reps) > 0
          ? Number(previousSet.actual_reps)
          : Number(sessionExercise.target_reps);
      rows.push({
        user_id: currentUser.id,
        session_id: activeFitnessSession.id,
        session_exercise_id: sessionExercise.id,
        plan_id: activeFitnessSession.plan_id,
        plan_exercise_id: sessionExercise.plan_exercise_id,
        set_number: setNumber,
        target_reps: Number(sessionExercise.target_reps),
        actual_reps: previousReps,
        weight_kg: previousWeight,
        previous_session_id: previous.session?.id || null,
        previous_weight_kg: previous.session ? previousWeight : null,
        previous_reps: previous.session ? previousReps : null,
        source: 'app',
      });
    }
  }
  if (!rows.length) return;
  const { data, error } = await sb.from('fitness_set_logs').insert(rows).select();
  if (error) throw error;
  fitnessSetLogs.push(...(data || []));
}

async function startFitnessWorkout(planId = selectedFitnessPlanId) {
  if (!fitnessReady) return alert('Bitte zuerst die Fitness-Migration in Supabase ausführen.');
  if (!fitnessSetsReady)
    return alert('Für die Satz-Aufzeichnung fehlt noch die Fitness-v2-Migration in Supabase.');
  if (activeFitnessSession) return alert('Es läuft bereits ein Training.');
  const plan = fitnessPlans.find(item => item.id === planId);
  if (!plan) return alert('Wähle zuerst einen Trainingsplan.');
  const exercises = fitnessPlanExercises
    .filter(exercise => exercise.plan_id === plan.id)
    .sort((a, b) => a.position - b.position);
  if (!exercises.length) return alert('Füge diesem Plan zuerst mindestens eine Übung hinzu.');

  let previous;
  try {
    previous = await loadPreviousFitnessWorkout(plan.id);
  } catch (error) {
    return alert(error.message);
  }

  const { data: session, error } = await sb
    .from('fitness_sessions')
    .insert({
      user_id: currentUser.id,
      plan_id: plan.id,
      plan_name_snapshot: plan.name,
      session_date: fitnessDateKey(),
      status: 'active',
    })
    .select()
    .single();
  if (error) return alert(error.message);

  const exerciseRows = exercises.map((exercise, index) => ({
    user_id: currentUser.id,
    session_id: session.id,
    plan_exercise_id: exercise.id,
    exercise_name: exercise.name,
    muscle_group: exercise.muscle_group || '',
    target_sets: exercise.target_sets,
    target_reps: exercise.target_reps,
    actual_weight: Number(exercise.target_weight) || 0,
    is_completed: false,
    position: index,
  }));
  const { data: createdExercises, error: exerciseError } = await sb
    .from('fitness_session_exercises')
    .insert(exerciseRows)
    .select();
  if (exerciseError) {
    await sb.from('fitness_sessions').delete().eq('id', session.id);
    return alert(exerciseError.message);
  }

  const setRows = [];
  for (const sessionExercise of createdExercises || []) {
    const planExercise = exercises.find(item => item.id === sessionExercise.plan_exercise_id);
    const previousExercise = previous.exercises.find(
      item => item.plan_exercise_id === sessionExercise.plan_exercise_id,
    );
    for (let setNumber = 1; setNumber <= Number(sessionExercise.target_sets); setNumber += 1) {
      const previousSet = previous.sets.find(
        item =>
          item.plan_exercise_id === sessionExercise.plan_exercise_id &&
          Number(item.set_number) === setNumber,
      );
      const previousWeight = previousSet
        ? Number(previousSet.weight_kg)
        : previousExercise
          ? Number(previousExercise.actual_weight)
          : null;
      const previousReps =
        previousSet && Number(previousSet.actual_reps) > 0
          ? Number(previousSet.actual_reps)
          : Number(sessionExercise.target_reps);
      setRows.push({
        user_id: currentUser.id,
        session_id: session.id,
        session_exercise_id: sessionExercise.id,
        plan_id: plan.id,
        plan_exercise_id: sessionExercise.plan_exercise_id,
        set_number: setNumber,
        target_reps: Number(sessionExercise.target_reps),
        actual_reps: previousReps,
        weight_kg: previousWeight ?? (Number(planExercise?.target_weight) || 0),
        previous_session_id: previous.session?.id || null,
        previous_weight_kg: previousWeight,
        previous_reps: previous.session ? previousReps : null,
        source: 'app',
      });
    }
  }
  const { error: setError } = await sb.from('fitness_set_logs').insert(setRows);
  if (setError) {
    await sb.from('fitness_sessions').delete().eq('id', session.id);
    return alert(setError.message);
  }
  await refreshFitness();
}

async function updateFitnessSet(id, field, value) {
  if (!['weight_kg', 'actual_reps'].includes(field)) return;
  const numeric =
    field === 'actual_reps'
      ? Math.max(0, Math.min(200, Math.round(Number(value) || 0)))
      : Math.max(0, Number(value) || 0);
  const { error } = await sb
    .from('fitness_set_logs')
    .update({ [field]: numeric, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return alert(error.message);
  const set = fitnessSetLogs.find(item => item.id === id);
  if (set) set[field] = numeric;
}

async function toggleFitnessSet(id, isCompleted) {
  const set = fitnessSetLogs.find(item => item.id === id);
  if (!set) return;
  const completedAt = isCompleted ? new Date().toISOString() : null;
  const { error } = await sb
    .from('fitness_set_logs')
    .update({
      is_completed: isCompleted,
      completed_at: completedAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) return alert(error.message);
  set.is_completed = isCompleted;
  set.completed_at = completedAt;

  const exerciseSets = fitnessSetLogs.filter(
    item => item.session_exercise_id === set.session_exercise_id,
  );
  const exerciseComplete = exerciseSets.length > 0 && exerciseSets.every(item => item.is_completed);
  const completedWeights = exerciseSets
    .filter(item => item.is_completed)
    .map(item => Number(item.weight_kg) || 0);
  const actualWeight = completedWeights.length ? Math.max(...completedWeights) : 0;
  const { error: exerciseError } = await sb
    .from('fitness_session_exercises')
    .update({
      is_completed: exerciseComplete,
      completed_at: exerciseComplete ? new Date().toISOString() : null,
      actual_weight: actualWeight,
      updated_at: new Date().toISOString(),
    })
    .eq('id', set.session_exercise_id);
  if (exerciseError) return alert(exerciseError.message);
  const exercise = fitnessSessionExercises.find(item => item.id === set.session_exercise_id);
  if (exercise) {
    exercise.is_completed = exerciseComplete;
    exercise.completed_at = exerciseComplete ? new Date().toISOString() : null;
    exercise.actual_weight = actualWeight;
  }
  renderFitness();
}

async function finishFitnessWorkout() {
  if (!activeFitnessSession) return;
  const activeSets = setLogsForSession(activeFitnessSession.id);
  const completedSets = activeSets.filter(set => set.is_completed);
  if (!completedSets.length) return alert('Hake zuerst mindestens einen Satz ab.');
  if (
    completedSets.length < activeSets.length &&
    !confirm('Training mit offenen Sätzen abschließen?')
  )
    return;

  const weightUpdates = fitnessSessionExercises
    .filter(exercise => exercise.plan_exercise_id)
    .map(exercise => {
      const weights = activeSets
        .filter(set => set.session_exercise_id === exercise.id && set.is_completed)
        .map(set => Number(set.weight_kg) || 0);
      if (!weights.length) return Promise.resolve({ error: null });
      return sb
        .from('fitness_plan_exercises')
        .update({ target_weight: Math.max(...weights), updated_at: new Date().toISOString() })
        .eq('id', exercise.plan_exercise_id);
    });
  const results = await Promise.all(weightUpdates);
  const weightError = results.find(result => result.error)?.error;
  if (weightError) return alert(weightError.message);

  const { error } = await sb
    .from('fitness_sessions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', activeFitnessSession.id);
  if (error) return alert(error.message);
  await refreshFitness();
}

async function cancelFitnessWorkout() {
  if (!activeFitnessSession || !confirm('Laufendes Training wirklich verwerfen?')) return;
  const { error } = await sb.from('fitness_sessions').delete().eq('id', activeFitnessSession.id);
  if (error) return alert(error.message);
  await refreshFitness();
}

function formatFitnessDate(value) {
  if (!value) return '–';
  const date = new Date(String(value).length === 10 ? `${value}T12:00:00` : value);
  return new Intl.DateTimeFormat('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatFitnessTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('de-AT', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(value),
  );
}

function formatFitnessWeight(value) {
  return Number(value || 0).toLocaleString('de-AT', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function renderSetSummary(sets) {
  const completed = sets.filter(set => set.is_completed);
  if (!completed.length) return 'Noch keine Sätze';
  const labels = completed.map(
    set => `${formatFitnessWeight(set.weight_kg)} kg × ${Number(set.actual_reps) || 0}`,
  );
  return `${labels.slice(0, 3).join(' · ')}${labels.length > 3 ? ` · +${labels.length - 3}` : ''}`;
}

function renderHomeFitness() {
  const plan = fitnessPlans.find(item => item.id === selectedFitnessPlanId) || fitnessPlans[0];
  if (!fitnessReady) {
    $('#homeFitnessPlan').textContent = 'Fitness-Datenbank einrichten';
    $('#homeFitnessStatus').textContent =
      'Die neue Fitness-Version wartet auf die Supabase-Migration.';
    return;
  }
  if (activeFitnessSession) {
    const activeSets = setLogsForSession(activeFitnessSession.id);
    const completed = activeSets.filter(set => set.is_completed).length;
    $('#homeFitnessPlan').textContent = activeFitnessSession.plan_name_snapshot + ' läuft';
    $('#homeFitnessStatus').textContent = `${completed}/${activeSets.length} Sätze erledigt`;
    return;
  }
  if (!plan) {
    $('#homeFitnessPlan').textContent = '2er-Split einrichten';
    $('#homeFitnessStatus').textContent = 'Training A und B warten auf dich.';
    return;
  }
  const count = fitnessPlanExercises.filter(exercise => exercise.plan_id === plan.id).length;
  $('#homeFitnessPlan').textContent = plan.name;
  $('#homeFitnessStatus').textContent = `${count} Übungen · bereit für dein nächstes Training`;
}

function renderActiveFitnessWorkout() {
  const container = $('#activeWorkout');
  if (!activeFitnessSession) {
    container.classList.add('hide');
    container.innerHTML = '';
    return;
  }
  const activeSets = setLogsForSession(activeFitnessSession.id);
  const completed = activeSets.filter(set => set.is_completed).length;
  const total = activeSets.length;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  container.classList.remove('hide');
  container.innerHTML = `
    <div class="active-workout-head">
      <div><div class="eyebrow">Training läuft</div><h2>${escapeHtml(activeFitnessSession.plan_name_snapshot)}</h2><div class="sub">${completed}/${total} Sätze abgeschlossen · Vergleich nur mit dem letzten ${escapeHtml(activeFitnessSession.plan_name_snapshot)}</div></div>
      <div class="actions"><button class="btn danger" onclick="cancelFitnessWorkout()">Verwerfen</button><button class="btn primary" onclick="finishFitnessWorkout()">Training abschließen</button></div>
    </div>
    <div class="fitness-progress"><div style="width:${percent}%"></div></div>
    <div class="workout-exercise-list">
      ${fitnessSessionExercises
        .map(exercise => {
          const sets = activeSets.filter(set => set.session_exercise_id === exercise.id);
          const done = sets.length > 0 && sets.every(set => set.is_completed);
          return `<article class="workout-exercise ${done ? 'done' : ''}">
          <div class="workout-exercise-head"><div class="workout-exercise-copy"><b>${escapeHtml(exercise.exercise_name)}</b><span>${escapeHtml(exercise.muscle_group || 'Allgemein')} · ${exercise.target_sets} Sätze</span></div><button class="mini-btn history-btn" onclick="openFitnessProgress('${exercise.plan_exercise_id}')">Verlauf</button></div>
          <div class="workout-set-list">
            ${sets
              .map(
                set => `<div class="workout-set-row ${set.is_completed ? 'done' : ''}">
              <input class="fit-check" type="checkbox" ${set.is_completed ? 'checked' : ''} onchange="toggleFitnessSet('${set.id}',this.checked)" aria-label="Satz ${set.set_number} erledigt">
              <b>Satz ${set.set_number}</b>
              <label><span>Gewicht</span><div><input type="number" min="0" step=".5" value="${Number(set.weight_kg) || 0}" onchange="updateFitnessSet('${set.id}','weight_kg',this.value)"><small>kg</small></div></label>
              <label><span>Wiederholungen</span><div><input type="number" min="0" max="200" step="1" value="${Number(set.actual_reps) || 0}" onchange="updateFitnessSet('${set.id}','actual_reps',this.value)"><small>Wdh.</small></div></label>
              <small class="previous-set">${set.previous_session_id ? `Letztes ${escapeHtml(activeFitnessSession.plan_name_snapshot)}: ${formatFitnessWeight(set.previous_weight_kg)} kg × ${Number(set.previous_reps) || 0}` : 'Erster gespeicherter Vergleich'}${set.completed_at ? ` · ✓ ${formatFitnessTime(set.completed_at)}` : ''}</small>
            </div>`,
              )
              .join('')}
          </div>
        </article>`;
        })
        .join('')}
    </div>`;
}

function closeFitnessProgress() {
  $('#fitnessProgressModal').classList.remove('open');
}

function openFitnessProgress(exerciseId) {
  const exercise = fitnessPlanExercises.find(item => item.id === exerciseId);
  if (!exercise) return;
  const sessions = fitnessSessions.filter(
    session => session.status === 'completed' && session.plan_id === exercise.plan_id,
  );
  const entries = sessions
    .map(session => ({
      session,
      sets: setLogsForExercise(session.id, exercise.id).filter(set => set.is_completed),
    }))
    .filter(entry => entry.sets.length);
  $('#fitnessProgressTitle').textContent = exercise.name;
  $('#fitnessProgressContent').innerHTML = entries.length
    ? entries
        .map((entry, index) => {
          const currentMax = Math.max(...entry.sets.map(set => Number(set.weight_kg) || 0));
          const older = entries[index + 1];
          const olderMax = older?.sets.length
            ? Math.max(...older.sets.map(set => Number(set.weight_kg) || 0))
            : null;
          const change =
            olderMax !== null && currentMax > olderMax
              ? `<span class="progress-gain">+${formatFitnessWeight(currentMax - olderMax)} kg</span>`
              : '';
          return `<div class="fitness-progress-entry"><div><b>${formatFitnessDate(entry.session.completed_at || entry.session.session_date)}</b><small>${escapeHtml(entry.session.plan_name_snapshot)} ${change}</small></div><p>${entry.sets.map(set => `Satz ${set.set_number}: ${formatFitnessWeight(set.weight_kg)} kg × ${Number(set.actual_reps) || 0}${set.completed_at ? ` (${formatFitnessTime(set.completed_at)})` : ''}`).join(' · ')}</p></div>`;
        })
        .join('')
    : '<div class="empty">Nach dem ersten abgeschlossenen Training erscheint hier dein satzgenauer Verlauf.</div>';
  $('#fitnessProgressModal').classList.add('open');
}

function renderFitness() {
  $('#fitnessSetupNotice').classList.toggle('hide', fitnessReady);
  $('#fitnessSetSetupNotice').classList.toggle('hide', !fitnessReady || fitnessSetsReady);
  $('#fitnessEmptyState').classList.toggle('hide', !fitnessReady || fitnessPlans.length > 0);
  $('#fitnessWorkspace').classList.toggle('hide', !fitnessReady || !fitnessPlans.length);
  $('#fitnessStartBtn').disabled =
    !fitnessReady || !fitnessSetsReady || !fitnessPlans.length || Boolean(activeFitnessSession);

  const completedSessions = fitnessSessions.filter(session => session.status === 'completed');
  const weekStart = new Date();
  const dayOffset = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - dayOffset);
  weekStart.setHours(0, 0, 0, 0);
  const weekCount = completedSessions.filter(
    session => new Date(session.completed_at || session.session_date) >= weekStart,
  ).length;
  const selectedPlan =
    fitnessPlans.find(plan => plan.id === selectedFitnessPlanId) || fitnessPlans[0];
  const lastPlanSession = selectedPlan ? latestCompletedFitnessSession(selectedPlan.id) : null;

  $('#fitnessWeekCount').textContent = String(weekCount);
  $('#fitnessCurrentPlan').textContent = selectedPlan?.name || '–';
  $('#fitnessLastWorkout').textContent = lastPlanSession
    ? `${formatFitnessDate(lastPlanSession.completed_at || lastPlanSession.session_date)} · ${selectedPlan.name}`
    : '–';

  if (fitnessReady && fitnessPlans.length) {
    $('#fitnessPlanTabs').innerHTML = fitnessPlans
      .map(
        plan => `
      <button class="fitness-plan-tab ${plan.id === selectedFitnessPlanId ? 'active' : ''}" onclick="selectFitnessPlan('${plan.id}')">${escapeHtml(plan.name)}</button>
    `,
      )
      .join('');

    const rows = fitnessPlanExercises
      .filter(exercise => exercise.plan_id === selectedFitnessPlanId)
      .sort((a, b) => a.position - b.position);
    $('#fitnessPlanList').innerHTML = rows.length
      ? rows
          .map((exercise, index) => {
            const lastSets = lastPlanSession
              ? setLogsForExercise(lastPlanSession.id, exercise.id)
              : [];
            return `<div class="fitness-plan-exercise">
        <div class="fitness-order">${index + 1}</div>
        <div class="fitness-exercise-copy"><b>${escapeHtml(exercise.name)}</b><span>${escapeHtml(exercise.muscle_group || 'Allgemein')}</span></div>
        <div class="fitness-target"><small>Sätze × Wdh.</small><b>${exercise.target_sets} × ${exercise.target_reps}</b></div>
        <div class="fitness-target fitness-last-sets"><small>Letztes ${escapeHtml(selectedPlan?.name || 'Training')}</small><b>${lastSets.length ? renderSetSummary(lastSets) : `${formatFitnessWeight(exercise.target_weight)} kg · Startwert`}</b></div>
        <div class="fitness-row-actions">
          <button class="mini-btn history-btn" onclick="openFitnessProgress('${exercise.id}')" title="Satzverlauf">↗</button>
          <button class="mini-btn" onclick="moveFitnessExercise('${exercise.id}',-1)" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button class="mini-btn" onclick="moveFitnessExercise('${exercise.id}',1)" ${index === rows.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="mini-btn danger-text" onclick="deleteExercise('${exercise.id}')">✕</button>
        </div>
      </div>`;
          })
          .join('')
      : '<div class="empty">Noch keine Übungen in diesem Plan.</div>';

    $('#fitnessHistory').innerHTML = completedSessions.length
      ? completedSessions
          .slice(0, 8)
          .map(session => {
            const sessionSets = setLogsForSession(session.id).filter(set => set.is_completed);
            return `<div class="fitness-history-item"><span>${formatFitnessDate(session.completed_at || session.session_date)}</span><b>${escapeHtml(session.plan_name_snapshot)}</b><small>${sessionSets.length ? `${sessionSets.length} Sätze gespeichert` : 'Abgeschlossen'}</small></div>`;
          })
          .join('')
      : '<div class="empty">Noch kein Training abgeschlossen.</div>';
  }

  renderActiveFitnessWorkout();
  renderHomeFitness();
}
