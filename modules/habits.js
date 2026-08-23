/* Gewohnheiten — bewusst kein Aufgaben-Modul.
   Eine wiederkehrende Aufgabe erzeugt jeden Tag einen Eintrag, der offen liegen
   bleibt. Eine Gewohnheit kennt keinen Rueckstand: es gibt heute, und es gibt
   den Verlauf. Serie, beste Serie und Quote werden bei jedem Render neu aus den
   Eintraegen gerechnet — gespeichert wird nur, welcher Tag abgehakt ist. */

let habits = [];
let habitEntries = [];
let habitsReady = true;

const HABIT_VERLAUF_TAGE = 30;
const HABIT_BAND_TAGE = 14;
const HABIT_VORSCHLAEGE = [
  '💪 Trainieren',
  '📖 Lesen',
  '🧘 Meditieren',
  '💊 Vitamine',
  '📓 Journal',
];

function habitDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/* Tageweise rueckwaerts rechnen, ohne an Zeitzonen oder Sommerzeit zu scheitern:
   ueber ein Date-Objekt statt ueber Millisekunden-Arithmetik. */
function habitDayBefore(key, tage = 1) {
  const [year, month, day] = String(key).slice(0, 10).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - tage);
  return habitDateKey(date);
}

function isMissingHabitsTable(error) {
  const message = `${error?.code || ''} ${error?.message || ''}`;
  return (
    /42P01|PGRST205/i.test(message) ||
    (/habits|habit_entries/i.test(message) &&
      /does not exist|schema cache|could not find/i.test(message))
  );
}

function habitDaysFor(habitId, list = habitEntries) {
  return new Set(
    list.filter(entry => entry.habit_id === habitId).map(entry => String(entry.day).slice(0, 10)),
  );
}

function isHabitDoneOn(habitId, day = habitDateKey(), list = habitEntries) {
  return habitDaysFor(habitId, list).has(day);
}

/* Die laufende Serie endet am letzten abgehakten Tag. Heute noch offen bricht
   sie NICHT — sonst stuende jeden Morgen 0 da, obwohl der Tag noch laeuft. */
function habitStreak(habitId, heute = habitDateKey(), list = habitEntries) {
  const tage = habitDaysFor(habitId, list);
  if (!tage.size) return 0;
  let tag = tage.has(heute) ? heute : habitDayBefore(heute);
  let serie = 0;
  while (tage.has(tag)) {
    serie += 1;
    tag = habitDayBefore(tag);
  }
  return serie;
}

function habitBestStreak(habitId, list = habitEntries) {
  const tage = [...habitDaysFor(habitId, list)].sort();
  let beste = 0;
  let lauf = 0;
  let vorheriger = null;
  for (const tag of tage) {
    lauf = vorheriger && habitDayBefore(tag) === vorheriger ? lauf + 1 : 1;
    beste = Math.max(beste, lauf);
    vorheriger = tag;
  }
  return beste;
}

/* Quote der letzten N Tage, heute eingeschlossen. */
function habitRate(
  habitId,
  heute = habitDateKey(),
  tage = HABIT_VERLAUF_TAGE,
  list = habitEntries,
) {
  const gemacht = habitDaysFor(habitId, list);
  let treffer = 0;
  for (let i = 0; i < tage; i += 1) if (gemacht.has(habitDayBefore(heute, i))) treffer += 1;
  return { treffer, tage };
}

function habitBand(habitId, heute = habitDateKey(), list = habitEntries) {
  const gemacht = habitDaysFor(habitId, list);
  const tage = [];
  for (let i = HABIT_BAND_TAGE - 1; i >= 0; i -= 1) {
    const tag = habitDayBefore(heute, i);
    tage.push({ tag, erledigt: gemacht.has(tag) });
  }
  return tage;
}

async function loadHabits() {
  const seit = habitDayBefore(habitDateKey(), HABIT_VERLAUF_TAGE + 400);
  const [habitResult, entryResult] = await Promise.all([
    sb
      .from('habits')
      .select('*')
      .is('archived_at', null)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    sb.from('habit_entries').select('*').gte('day', seit),
  ]);

  const fehler = habitResult.error || entryResult.error;
  if (fehler) {
    if (!isMissingHabitsTable(fehler)) throw fehler;
    habitsReady = false;
    habits = [];
    habitEntries = [];
    return;
  }
  habitsReady = true;
  habits = habitResult.data || [];
  habitEntries = entryResult.data || [];
}

async function refreshHabits() {
  await loadHabits();
  renderHabits();
}

async function createDefaultHabits() {
  if (!habitsReady) return alert('Bitte zuerst die Migration für Gewohnheiten ausführen.');
  if (habits.length) return;
  const rows = HABIT_VORSCHLAEGE.slice(0, 2).map((eintrag, index) => {
    const [icon, ...rest] = eintrag.split(' ');
    return { user_id: currentUser.id, title: rest.join(' '), icon, sort_order: index };
  });
  const { error } = await sb.from('habits').insert(rows);
  if (error) return alert(error.message);
  await refreshHabits();
}

async function addHabit() {
  if (!habitsReady) return alert('Bitte zuerst die Migration für Gewohnheiten ausführen.');
  const input = $('#habitInput');
  const roh = input.value.trim();
  if (!roh) return;
  /* Faengt das Emoji vorne ab, damit man "💪 Trainieren" tippen kann. */
  const treffer = roh.match(/^(\p{Extended_Pictographic}️?)\s*(.+)$/u);
  const icon = treffer ? treffer[1] : '';
  const title = (treffer ? treffer[2] : roh).trim();
  if (!title) return;
  const sortOrder = habits.length
    ? Math.max(...habits.map(habit => Number(habit.sort_order) || 0)) + 1
    : 0;
  const { error } = await sb
    .from('habits')
    .insert({ user_id: currentUser.id, title, icon, sort_order: sortOrder });
  if (error) return alert(error.message);
  input.value = '';
  await refreshHabits();
}

async function toggleHabit(habitId, tag = habitDateKey()) {
  if (!habitsReady) return;
  const erledigt = isHabitDoneOn(habitId, tag);

  /* Erst im Bild, dann in der Datenbank — Abhaken muss sich sofort anfuehlen.
     Geht es schief, wird sauber neu geladen. */
  if (erledigt)
    habitEntries = habitEntries.filter(
      eintrag => !(eintrag.habit_id === habitId && String(eintrag.day).slice(0, 10) === tag),
    );
  else habitEntries.push({ id: `vorlaeufig-${habitId}-${tag}`, habit_id: habitId, day: tag });
  renderHabits();

  const { error } = erledigt
    ? await sb.from('habit_entries').delete().eq('habit_id', habitId).eq('day', tag)
    : await sb
        .from('habit_entries')
        .insert({ user_id: currentUser.id, habit_id: habitId, day: tag });
  if (error) {
    alert(error.message);
    await refreshHabits();
  }
}

async function renameHabit(habitId, titel) {
  const wert = String(titel || '').trim();
  const habit = habits.find(item => item.id === habitId);
  if (!habit) return;
  if (!wert) return renderHabits();
  if (wert === habit.title) return;
  habit.title = wert;
  const { error } = await sb
    .from('habits')
    .update({ title: wert, updated_at: new Date().toISOString() })
    .eq('id', habitId);
  if (error) {
    alert(error.message);
    await refreshHabits();
  }
}

/* Archivieren statt loeschen: der Verlauf bleibt erhalten, die Gewohnheit
   verschwindet nur aus der Liste. */
async function archiveHabit(habitId) {
  const habit = habits.find(item => item.id === habitId);
  if (!habit) return;
  if (!confirm(`„${habit.title}" aus der Liste nehmen? Der Verlauf bleibt gespeichert.`)) return;
  const { error } = await sb
    .from('habits')
    .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', habitId);
  if (error) return alert(error.message);
  await refreshHabits();
}

async function moveHabit(habitId, richtung) {
  const rows = [...habits].sort((a, b) => a.sort_order - b.sort_order);
  const index = rows.findIndex(habit => habit.id === habitId);
  const tausch = index + richtung;
  if (index < 0 || tausch < 0 || tausch >= rows.length) return;
  const dieser = rows[index];
  const anderer = rows[tausch];
  const merke = dieser.sort_order;
  const [a, b] = await Promise.all([
    sb.from('habits').update({ sort_order: anderer.sort_order }).eq('id', dieser.id),
    sb.from('habits').update({ sort_order: merke }).eq('id', anderer.id),
  ]);
  if (a.error || b.error) return alert(a.error?.message || b.error?.message);
  await refreshHabits();
}

function habitStreakText(serie) {
  if (!serie) return 'noch keine Serie';
  return serie === 1 ? '1 Tag am Stück' : `${serie} Tage am Stück`;
}

function renderHabits() {
  const karte = $('#habitCard');
  if (!karte) return;
  const setup = $('#habitSetupNotice');
  const form = $('#habitForm');
  const liste = $('#habitList');
  const status = $('#habitStatus');

  setup.classList.toggle('hide', habitsReady);
  form.classList.toggle('hide', !habitsReady);

  if (!habitsReady) {
    liste.innerHTML = '';
    status.textContent = '–';
    return;
  }

  const heute = habitDateKey();

  if (!habits.length) {
    liste.innerHTML = `<div class="empty habit-empty">
      Noch keine Gewohnheit.
      <button class="btn" onclick="createDefaultHabits()">Mit zwei anfangen</button>
    </div>`;
    status.textContent = '–';
    return;
  }

  const rows = [...habits].sort((a, b) => a.sort_order - b.sort_order);
  const heuteFertig = rows.filter(habit => isHabitDoneOn(habit.id, heute)).length;
  status.textContent =
    heuteFertig === rows.length ? 'Heute alles erledigt' : `${heuteFertig}/${rows.length} heute`;

  liste.innerHTML = rows
    .map((habit, index) => {
      const erledigt = isHabitDoneOn(habit.id, heute);
      const serie = habitStreak(habit.id, heute);
      const beste = habitBestStreak(habit.id);
      const quote = habitRate(habit.id, heute);
      const band = habitBand(habit.id, heute)
        .map(
          tag =>
            `<i class="${tag.erledigt ? 'on' : ''}" title="${escapeHtml(tag.tag)}${tag.erledigt ? ' — erledigt' : ''}"></i>`,
        )
        .join('');
      return `<div class="habit-item ${erledigt ? 'done' : ''}">
        <button class="habit-check" type="button" onclick="toggleHabit('${habit.id}')"
          aria-pressed="${erledigt}" aria-label="${escapeHtml(habit.title)} für heute abhaken">
          ${habit.icon ? escapeHtml(habit.icon) : erledigt ? '✓' : ''}
        </button>
        <div class="habit-copy">
          <input class="habit-title" type="text" value="${escapeHtml(habit.title)}" maxlength="80"
            onchange="renameHabit('${habit.id}',this.value)" aria-label="Bezeichnung">
          <small>${escapeHtml(habitStreakText(serie))} · ${quote.treffer} von ${quote.tage} Tagen${beste > serie ? ` · beste Serie ${beste}` : ''}</small>
        </div>
        <div class="habit-band" aria-hidden="true">${band}</div>
        <div class="habit-actions">
          <button class="mini-btn" onclick="moveHabit('${habit.id}',-1)" ${index === 0 ? 'disabled' : ''} title="Nach oben">↑</button>
          <button class="mini-btn" onclick="moveHabit('${habit.id}',1)" ${index === rows.length - 1 ? 'disabled' : ''} title="Nach unten">↓</button>
          <button class="mini-btn danger-text" onclick="archiveHabit('${habit.id}')" title="Aus der Liste nehmen">✕</button>
        </div>
      </div>`;
    })
    .join('');
}
