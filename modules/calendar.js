let calendarEvents = [];
let calendarCursor = new Date();
let selectedCalendarDate = isoDate(new Date());
let calendarV2Ready = true;

function isMissingCalendarV2Schema(error) {
  const message =
    `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return (
    /recurrence|reminder_enabled|reminder_time/.test(message) &&
    /does not exist|schema cache|not find|pgrst204|42703/.test(message)
  );
}

function calendarQuery(columns = '*') {
  return sb
    .from('calendar_events')
    .select(columns)
    .order('event_date', { ascending: true })
    .order('start_time', { ascending: true });
}

async function loadCalendar() {
  const columns =
    'id,user_id,created_at,title,event_date,start_time,end_time,category,description,completed,recurrence,reminder_enabled,reminder_time,source';
  let { data, error } = await calendarQuery(columns);
  if (error && isMissingCalendarV2Schema(error)) {
    calendarV2Ready = false;
    ({ data, error } = await calendarQuery());
  } else calendarV2Ready = true;
  if (error) throw error;
  calendarEvents = (data || []).map(event => ({
    recurrence: 'none',
    reminder_enabled: false,
    reminder_time: '08:00',
    ...event,
  }));
  const requestedDate = new URLSearchParams(location.search).get('date');
  if (/^\d{4}-\d{2}-\d{2}$/.test(requestedDate || '')) {
    selectedCalendarDate = requestedDate;
    const requestedMonth = new Date(`${requestedDate}T12:00:00`);
    if (!Number.isNaN(requestedMonth.getTime()))
      calendarCursor = new Date(requestedMonth.getFullYear(), requestedMonth.getMonth(), 1);
  }
}

function openCalendarEvent(date) {
  $('#calendarForm').reset();
  $('#cDate').value = date || selectedCalendarDate || isoDate(new Date());
  $('#cRecurrence').value = 'none';
  $('#cReminderEnabled').checked = false;
  $('#cReminderTime').value = '08:00';
  renderCalendarFormOptions();
  $('#calendarModal').classList.add('open');
}
function closeCalendarEvent() {
  $('#calendarModal').classList.remove('open');
}

function renderCalendarFormOptions() {
  const enabled = calendarV2Ready && $('#cReminderEnabled').checked;
  $('#cRecurrence').disabled = !calendarV2Ready;
  $('#cReminderEnabled').disabled = !calendarV2Ready;
  $('#cReminderTime').disabled = !enabled;
  $('#cReminderTime').required = enabled;
  $('#calendarReminderFields').classList.toggle('inactive', !enabled);
}

function applyCalendarCategoryDefaults() {
  if ($('#cCategory').value !== 'Geburtstag' || !calendarV2Ready) return;
  $('#cRecurrence').value = 'yearly';
  $('#cReminderEnabled').checked = true;
  renderCalendarFormOptions();
}

$('#cReminderEnabled').addEventListener('change', renderCalendarFormOptions);
$('#cCategory').addEventListener('change', applyCalendarCategoryDefaults);

$('#calendarForm').addEventListener('submit', async e => {
  e.preventDefault();
  const payload = {
    user_id: currentUser.id,
    title: $('#cTitle').value,
    event_date: $('#cDate').value,
    start_time: $('#cStart').value || null,
    end_time: $('#cEnd').value || null,
    category: $('#cCategory').value,
    description: $('#cDescription').value,
  };
  if (calendarV2Ready) {
    payload.recurrence = $('#cRecurrence').value;
    payload.reminder_enabled = $('#cReminderEnabled').checked;
    payload.reminder_time = $('#cReminderEnabled').checked
      ? $('#cReminderTime').value || '08:00'
      : null;
  }
  const { error } = await sb.from('calendar_events').insert(payload);
  if (error) return alert(error.message);
  e.target.reset();
  closeCalendarEvent();
  await loadAll();
  showPage('calendar');
});

async function toggleCalendarEvent(id, value) {
  await sb.from('calendar_events').update({ completed: !value }).eq('id', id);
  await loadAll();
}
async function deleteCalendarEvent(id) {
  const event = calendarEvents.find(item => item.id === id);
  if (
    !confirm(
      event?.recurrence === 'yearly' ? 'Jährlichen Termin wirklich löschen?' : 'Termin löschen?',
    )
  )
    return;
  await sb.from('calendar_events').delete().eq('id', id);
  await loadAll();
}
function shiftCalendar(n) {
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + n, 1);
  renderCalendar();
}
function selectCalendarDate(date) {
  selectedCalendarDate = date;
  const url = new URL(location.href);
  url.searchParams.set('page', 'calendar');
  url.searchParams.set('date', date);
  history.replaceState(null, '', url);
  renderCalendarSelectedDay();
}
function categoryClass(cat) {
  return (
    'cat-' +
    (cat || 'Privat')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
  );
}

function calendarEventOccursOn(event, date) {
  if (event.event_date === date) return true;
  return (
    event.recurrence === 'yearly' &&
    date >= event.event_date &&
    event.event_date.slice(5) === date.slice(5)
  );
}

function calendarEventsForDate(date) {
  return calendarEvents
    .filter(event => calendarEventOccursOn(event, date))
    .sort((a, b) => String(a.start_time || '').localeCompare(String(b.start_time || '')));
}

function renderCalendar() {
  const y = calendarCursor.getFullYear(),
    m = calendarCursor.getMonth();
  $('#calendarV2SetupNotice').classList.toggle('hide', calendarV2Ready);
  $('#calendarTitle').textContent = new Intl.DateTimeFormat('de-DE', {
    month: 'long',
    year: 'numeric',
  }).format(calendarCursor);
  let html = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
    .map(x => `<div class="cal-head">${x}</div>`)
    .join('');
  const first = new Date(y, m, 1),
    offset = (first.getDay() + 6) % 7,
    days = new Date(y, m + 1, 0).getDate();
  const prevDays = new Date(y, m, 0).getDate();
  for (let i = offset - 1; i >= 0; i--) {
    const d = prevDays - i,
      date = isoDate(new Date(y, m - 1, d));
    html += calendarDay(date, d, true);
  }
  for (let d = 1; d <= days; d++) {
    const date = isoDate(new Date(y, m, d));
    html += calendarDay(date, d, false);
  }
  const cells = offset + days,
    remain = (7 - (cells % 7)) % 7;
  for (let d = 1; d <= remain; d++) {
    const date = isoDate(new Date(y, m + 1, d));
    html += calendarDay(date, d, true);
  }
  $('#calendarGrid').innerHTML = html;
  renderCalendarSelectedDay();
}
function calendarDay(date, num, outside) {
  const events = calendarEventsForDate(date);
  const today = date === isoDate(new Date());
  return `<div class="cal-day ${outside ? 'outside' : ''} ${today ? 'today' : ''}" onclick="selectCalendarDate('${date}')">
    <div class="cal-num">${num}</div>
    <div class="cal-events">${events
      .slice(0, 3)
      .map(
        e =>
          `<div class="cal-event ${categoryClass(e.category)}">${e.recurrence === 'yearly' ? '↻ ' : ''}${escapeHtml(e.title)}</div>`,
      )
      .join('')}${events.length > 3 ? `<div class="sub">+${events.length - 3}</div>` : ''}</div>
  </div>`;
}
/* Ein Arbeitstag aus der Stempeluhr ist keine Aufgabe: er ist vorbei, es gibt
   nichts abzuhaken. Und geloescht gehoert er auch nicht hier — er wuerde beim
   naechsten Stempel wieder auftauchen und waere bis dahin verschwunden.
   Geaendert wird er ueber die Stempeluhr, nicht ueber den Kalender. */
function isStampedWorkEvent(event) {
  return event?.source === 'work_clock';
}

function renderCalendarSelectedDay() {
  const date = new Date(selectedCalendarDate + 'T12:00:00');
  $('#selectedDateTitle').textContent = new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(date);
  const events = calendarEventsForDate(selectedCalendarDate);
  $('#selectedDateEvents').innerHTML =
    events
      .map(
        e => `<div class="event-item ${e.completed && e.recurrence !== 'yearly' ? 'done' : ''}">
    <div class="calendar-title-row"><b>${escapeHtml(e.title)}</b><span class="pill">${escapeHtml(e.category)}</span></div>
    <div class="sub">${e.start_time ? e.start_time.slice(0, 5) : 'Ganztägig'}${e.end_time ? ' – ' + e.end_time.slice(0, 5) : ''}</div>
    <div class="event-meta">${e.recurrence === 'yearly' ? '<span>↻ Jährlich</span>' : ''}${e.reminder_enabled ? `<span>🔔 ${String(e.reminder_time || '08:00').slice(0, 5)} Uhr</span>` : ''}</div>
    ${e.description ? `<p>${escapeHtml(e.description)}</p>` : ''}
    <div class="actions">${isStampedWorkEvent(e) ? '<span class="event-source">Aus der Stempeluhr</span>' : `${e.recurrence === 'yearly' ? '' : `<button class="btn" onclick="toggleCalendarEvent('${e.id}',${e.completed})">${e.completed ? 'Wieder öffnen' : 'Erledigt'}</button>`}<button class="btn danger" onclick="deleteCalendarEvent('${e.id}')">Löschen</button>`}</div>
  </div>`,
      )
      .join('') || '<div class="empty">Keine Termine an diesem Tag.</div>';
}
function isoDate(d) {
  const y = d.getFullYear(),
    m = String(d.getMonth() + 1).padStart(2, '0'),
    day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
