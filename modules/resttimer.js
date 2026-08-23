const REST_TIMER_DEFAULT_SECONDS = 90;
const REST_TIMER_PRESETS = [60, 90, 120, 180];
const REST_TIMER_MIN = 10;
const REST_TIMER_MAX = 900;

let restTimerEndsAt = 0;
let restTimerTotal = 0;
let restTimerExerciseId = null;
let restTimerExerciseName = '';
let restTimerInterval = null;
let restTimerTimeout = null;
let restTimerAudio = null;
let restSecondsColumnReady = true;

function clampRestSeconds(value) {
  const seconds = Math.round(Number(value) || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return REST_TIMER_DEFAULT_SECONDS;
  return Math.max(REST_TIMER_MIN, Math.min(REST_TIMER_MAX, seconds));
}

function isMissingRestSecondsColumn(error) {
  const message = `${error?.code || ''} ${error?.message || ''}`;
  return (
    /rest_seconds/i.test(message) &&
    /does not exist|schema cache|could not find/i.test(message)
  );
}

function restSecondsStorageKey(planExerciseId) {
  return `northstar-rest-${planExerciseId}`;
}

// Quelle der Wahrheit ist die Spalte rest_seconds an fitness_plan_exercises.
// Fehlt die Migration noch, faellt der Wert auf localStorage zurueck -- der Timer
// funktioniert dann nur auf diesem Geraet, aber er funktioniert.
function restSecondsForExercise(planExerciseId) {
  const exercise =
    typeof fitnessPlanExercises !== 'undefined'
      ? fitnessPlanExercises.find(item => item.id === planExerciseId)
      : null;
  if (exercise && Number(exercise.rest_seconds) > 0) return clampRestSeconds(exercise.rest_seconds);
  const stored = Number(localStorage.getItem(restSecondsStorageKey(planExerciseId)));
  if (stored > 0) return clampRestSeconds(stored);
  return REST_TIMER_DEFAULT_SECONDS;
}

async function rememberRestSeconds(planExerciseId, seconds) {
  if (!planExerciseId) return;
  const value = clampRestSeconds(seconds);
  localStorage.setItem(restSecondsStorageKey(planExerciseId), String(value));
  const exercise =
    typeof fitnessPlanExercises !== 'undefined'
      ? fitnessPlanExercises.find(item => item.id === planExerciseId)
      : null;
  if (exercise) exercise.rest_seconds = value;
  if (!restSecondsColumnReady) return;
  const { error } = await sb
    .from('fitness_plan_exercises')
    .update({ rest_seconds: value, updated_at: new Date().toISOString() })
    .eq('id', planExerciseId);
  if (error) {
    if (isMissingRestSecondsColumn(error)) restSecondsColumnReady = false;
    else console.warn('Pausenzeit', error.message);
  }
}

function restTimerRemainingMs(now = Date.now()) {
  if (!restTimerEndsAt) return 0;
  return Math.max(0, restTimerEndsAt - now);
}

function isRestTimerRunning(now = Date.now()) {
  return restTimerEndsAt > 0 && restTimerEndsAt > now;
}

function formatRestTime(ms) {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function ensureRestAudio() {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  if (!restTimerAudio) restTimerAudio = new AudioCtor();
  if (restTimerAudio.state === 'suspended') restTimerAudio.resume().catch(() => {});
  return restTimerAudio;
}

function playRestChime() {
  const context = ensureRestAudio();
  if (!context) return;
  [0, 0.22, 0.44].forEach((offset, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + offset;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(index === 2 ? 1046.5 : 784, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.2);
  });
}

function maybeAskRestNotificationPermission() {
  if (typeof Notification === 'undefined' || Notification.permission !== 'default') return;
  if (localStorage.getItem('northstar-rest-notify-asked')) return;
  localStorage.setItem('northstar-rest-notify-asked', '1');
  Notification.requestPermission().catch(() => {});
}

async function showRestNotification() {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const title = 'Pause vorbei';
  const options = {
    body: restTimerExerciseName ? `Weiter mit ${restTimerExerciseName}.` : 'Weiter geht’s.',
    icon: './icons/cprb-og-192.png',
    badge: './icons/cprb-og-192.png',
    tag: 'cprb-rest-timer',
    renotify: true,
  };
  try {
    const registration = await navigator.serviceWorker?.ready;
    if (registration) return registration.showNotification(title, options);
  } catch (error) {
    console.warn('Pausen-Hinweis', error);
  }
  try {
    new Notification(title, options);
  } catch (error) {
    console.warn('Pausen-Hinweis', error);
  }
}

function clearRestTimerHandles() {
  if (restTimerInterval) clearInterval(restTimerInterval);
  if (restTimerTimeout) clearTimeout(restTimerTimeout);
  restTimerInterval = null;
  restTimerTimeout = null;
}

function scheduleRestTimerHandles() {
  clearRestTimerHandles();
  restTimerInterval = setInterval(restTimerTick, 250);
  // Hintergrund-Tabs drosseln setInterval stark. Ein einzelner Timeout auf den
  // Ablaufzeitpunkt kommt dort eher durch -- und visibilitychange holt den Rest nach.
  restTimerTimeout = setTimeout(restTimerTick, restTimerRemainingMs() + 60);
}

function startRestTimer(seconds, exerciseName = '', planExerciseId = null) {
  const value = clampRestSeconds(seconds);
  restTimerTotal = value;
  restTimerEndsAt = Date.now() + value * 1000;
  restTimerExerciseId = planExerciseId;
  restTimerExerciseName = exerciseName || '';
  ensureRestAudio();
  maybeAskRestNotificationPermission();
  scheduleRestTimerHandles();
  renderRestTimer();
}

function startRestTimerForSet(set, exercise) {
  if (!set || !exercise) return;
  const planExerciseId = exercise.plan_exercise_id || null;
  const seconds = planExerciseId
    ? restSecondsForExercise(planExerciseId)
    : REST_TIMER_DEFAULT_SECONDS;
  startRestTimer(seconds, exercise.exercise_name || '', planExerciseId);
}

function stopRestTimer() {
  clearRestTimerHandles();
  restTimerEndsAt = 0;
  restTimerTotal = 0;
  restTimerExerciseId = null;
  restTimerExerciseName = '';
  renderRestTimer();
}

function adjustRestTimer(deltaSeconds) {
  if (!restTimerEndsAt) return;
  const remaining = restTimerRemainingMs();
  const next = Math.max(1000, remaining + Number(deltaSeconds) * 1000);
  restTimerEndsAt = Date.now() + next;
  restTimerTotal = Math.max(restTimerTotal, Math.ceil(next / 1000));
  scheduleRestTimerHandles();
  renderRestTimer();
}

// Ein Preset setzt die laufende Pause neu UND merkt sich die Zeit fuer diese Uebung.
function applyRestPreset(seconds) {
  const value = clampRestSeconds(seconds);
  if (restTimerExerciseId) rememberRestSeconds(restTimerExerciseId, value);
  restTimerTotal = value;
  restTimerEndsAt = Date.now() + value * 1000;
  scheduleRestTimerHandles();
  renderRestTimer();
}

function finishRestTimer() {
  clearRestTimerHandles();
  restTimerEndsAt = 0;
  playRestChime();
  if (navigator.vibrate) navigator.vibrate([180, 90, 180]);
  if (document.hidden) showRestNotification();
  renderRestTimer(true);
  setTimeout(() => {
    if (!restTimerEndsAt) {
      restTimerExerciseName = '';
      restTimerExerciseId = null;
      renderRestTimer();
    }
  }, 6000);
}

function restTimerTick() {
  if (!restTimerEndsAt) return;
  if (restTimerRemainingMs() > 0) return renderRestTimer();
  finishRestTimer();
}

function renderRestTimer(justFinished = false) {
  const bar = $('#restTimer');
  if (!bar) return;
  const running = isRestTimerRunning();
  const visible = running || justFinished;
  bar.classList.toggle('hide', !visible);
  bar.classList.toggle('done', Boolean(justFinished) && !running);
  if (!visible) return;

  const remaining = restTimerRemainingMs();
  $('#restTimerValue').textContent = running ? formatRestTime(remaining) : '0:00';
  $('#restTimerLabel').textContent = running
    ? restTimerExerciseName || 'Pause'
    : `Pause vorbei${restTimerExerciseName ? ` · ${restTimerExerciseName}` : ''}`;
  const percent = restTimerTotal ? (remaining / 1000 / restTimerTotal) * 100 : 0;
  $('#restTimerProgress').style.width = `${Math.max(0, Math.min(100, percent))}%`;

  const presets = $('#restTimerPresets');
  const active = restTimerTotal;
  presets.innerHTML = REST_TIMER_PRESETS.map(
    seconds =>
      `<button class="rest-preset ${seconds === active ? 'active' : ''}" onclick="applyRestPreset(${seconds})">${seconds}s</button>`,
  ).join('');
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) restTimerTick();
});
