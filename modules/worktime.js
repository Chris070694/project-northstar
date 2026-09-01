/* Stempeluhr — Arbeitsbeginn, Pause, Feierabend.

   Vier Stempel je Tag in `work_entries`. Die Auswertung rechnet der Client, weil
   der laufende Tag jede Sekunde weiterlaeuft; die Datenbank hat mit
   `work_days_v` dieselbe Rechnung fuer den abgeschlossenen Tag und fuettert
   daraus den Kalender. Beide folgen derselben Regel — sie steht unten bei
   workBreakSeconds und muss dort und in der Sicht gleich bleiben.

   Private Nebenaufzeichnung. Sie ersetzt nicht die offizielle Zeiterfassung des
   Arbeitgebers, sondern ist die Gegenkontrolle dazu. */

let workEntries = [];
let workReady = false;
let workTicker = null;

const WORK_KINDS = ['work_start', 'break_start', 'break_end', 'work_end'];
const WORK_LABELS = {
  work_start: 'Arbeitsbeginn',
  break_start: 'Pause',
  break_end: 'Weiter',
  work_end: 'Feierabend',
};

function isMissingWorkTable(error) {
  const nachricht = `${error?.code || ''} ${error?.message || ''}`;
  return (
    error?.code === '42P01' ||
    (/work_entries/.test(nachricht) && /does not exist|schema cache/i.test(nachricht))
  );
}

function workDayKey(datum = new Date()) {
  return `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, '0')}-${String(
    datum.getDate(),
  ).padStart(2, '0')}`;
}

async function loadWorkTime() {
  /* Nur die letzten Wochen: die Karte zeigt heute, die Liste den Verlauf.
     Alles zu laden waere nach einem Jahr sinnlos viel. */
  const seit = new Date();
  seit.setDate(seit.getDate() - 45);
  const { data, error } = await sb
    .from('work_entries')
    .select('*')
    .gte('work_date', workDayKey(seit))
    .order('stamped_at', { ascending: true });

  if (error) {
    if (!isMissingWorkTable(error)) throw error;
    workReady = false;
    workEntries = [];
    return;
  }
  workReady = true;
  workEntries = Array.isArray(data) ? data : [];
}

/* ---------------------------------------------------------------------------
   Rechnen
   --------------------------------------------------------------------------- */

function workStamps(tag = workDayKey(), rows = workEntries) {
  return rows
    .filter(row => row?.work_date === tag && WORK_KINDS.includes(row?.kind))
    .slice()
    .sort((a, b) => String(a.stamped_at).localeCompare(String(b.stamped_at)));
}

function workStampTime(row) {
  const zeit = Date.parse(row?.stamped_at || '');
  return Number.isNaN(zeit) ? null : zeit;
}

/* leer → laeuft → pause → laeuft → fertig */
function workState(stempel) {
  if (!stempel.length) return 'leer';
  if (stempel.some(row => row.kind === 'work_end')) return 'fertig';
  const letzter = stempel[stempel.length - 1];
  if (letzter.kind === 'break_start') return 'pause';
  return 'laeuft';
}

/* Ein Pausenende zaehlt nur, wenn direkt davor ein Pausenbeginn steht. Ein
   vergessenes Pausenende laeuft damit nicht bis zum Feierabend weiter — lieber
   eine Pause zu wenig als ein Arbeitstag, der zu kurz aussieht. Dieselbe Regel
   steht in work_days_v; wer sie hier aendert, muss die Sicht mitaendern.
   Eine gerade laufende Pause zaehlt bis jetzt mit. */
function workBreakSeconds(stempel, jetzt = Date.now()) {
  let summe = 0;
  let offen = null;
  for (const row of stempel) {
    const zeit = workStampTime(row);
    if (zeit === null) continue;
    if (row.kind === 'break_start') offen = zeit;
    else if (row.kind === 'break_end' && offen !== null) {
      summe += Math.max(0, zeit - offen);
      offen = null;
    } else if (row.kind === 'work_end' && offen !== null) {
      /* Feierabend waehrend der Pause: die Pause endete mit dem Arbeitstag. */
      summe += Math.max(0, zeit - offen);
      offen = null;
    }
  }
  if (offen !== null) summe += Math.max(0, jetzt - offen);
  return Math.round(summe / 1000);
}

function workGrossSeconds(stempel, jetzt = Date.now()) {
  const beginn = stempel.find(row => row.kind === 'work_start');
  if (!beginn) return 0;
  const von = workStampTime(beginn);
  if (von === null) return 0;
  const ende = stempel.find(row => row.kind === 'work_end');
  const bis = ende ? workStampTime(ende) : jetzt;
  return Math.max(0, Math.round(((bis ?? jetzt) - von) / 1000));
}

function workNetSeconds(stempel, jetzt = Date.now()) {
  return Math.max(0, workGrossSeconds(stempel, jetzt) - workBreakSeconds(stempel, jetzt));
}

function formatWorkDuration(sekunden) {
  if (!Number.isFinite(sekunden) || sekunden < 0) return '–';
  const stunden = Math.floor(sekunden / 3600);
  const minuten = Math.floor((sekunden % 3600) / 60);
  return `${stunden}:${String(minuten).padStart(2, '0')} h`;
}

function formatWorkMinutes(sekunden) {
  if (!Number.isFinite(sekunden) || sekunden <= 0) return '–';
  const minuten = Math.round(sekunden / 60);
  return minuten >= 60 ? formatWorkDuration(sekunden) : `${minuten} min`;
}

function formatWorkClock(row) {
  const zeit = workStampTime(row);
  if (zeit === null) return '--:--';
  return new Intl.DateTimeFormat('de-AT', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(zeit),
  );
}

/* ---------------------------------------------------------------------------
   Stempeln
   --------------------------------------------------------------------------- */

/* Der naechste Stempel ergibt sich aus dem Zustand — deshalb ein grosser Knopf
   statt vier gleichwertiger. Vier gleiche Knoepfe heisst frueher oder spaeter
   Pause statt Feierabend. */
function workNextKind(zustand) {
  if (zustand === 'leer') return 'work_start';
  if (zustand === 'pause') return 'break_end';
  if (zustand === 'laeuft') return 'break_start';
  return null;
}

async function stampWork(kind, tag = workDayKey()) {
  if (!workReady || !WORK_KINDS.includes(kind)) return;
  const stempel = workStamps(tag);
  const zustand = workState(stempel);
  if (zustand === 'fertig') return;
  if (kind !== 'work_start' && zustand === 'leer') return;

  const zeilen = [{ user_id: currentUser.id, work_date: tag, kind, stamped_at: new Date().toISOString() }];
  /* Feierabend aus der Pause heraus: das Pausenende gehoert mit gestempelt,
     sonst laeuft die Pause in der Auswertung bis zum Arbeitsende weiter. */
  if (kind === 'work_end' && zustand === 'pause') {
    zeilen.unshift({ ...zeilen[0], kind: 'break_end' });
  }

  const { data, error } = await sb.from('work_entries').insert(zeilen).select();
  if (error) {
    alert('Der Stempel konnte nicht gespeichert werden: ' + error.message);
    return;
  }
  workEntries = workEntries.concat(data || []);
  renderWorkTime();
}

function stampWorkNext() {
  const kind = workNextKind(workState(workStamps()));
  if (kind) stampWork(kind);
}

async function correctWorkStamp(id) {
  const row = workEntries.find(eintrag => eintrag.id === id);
  if (!row) return;
  const antwort = prompt(
    `${WORK_LABELS[row.kind]} korrigieren (HH:MM) — leer lassen zum Löschen:`,
    formatWorkClock(row),
  );
  if (antwort === null) return;

  if (!antwort.trim()) {
    const { error } = await sb.from('work_entries').delete().eq('id', id);
    if (error) return alert('Löschen fehlgeschlagen: ' + error.message);
    workEntries = workEntries.filter(eintrag => eintrag.id !== id);
    renderWorkTime();
    return;
  }

  const treffer = antwort.trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!treffer) return alert('Bitte als HH:MM eingeben, zum Beispiel 06:15.');
  const stunde = Number(treffer[1]);
  const minute = Number(treffer[2]);
  if (stunde > 23 || minute > 59) return alert('Diese Uhrzeit gibt es nicht.');

  /* Auf dem bisherigen Zeitpunkt aufsetzen, nicht auf heute: ein Stempel von
     gestern soll beim Korrigieren nicht auf den heutigen Tag springen. */
  const bisher = new Date(workStampTime(row) ?? Date.now());
  bisher.setHours(stunde, minute, 0, 0);
  const { error } = await sb
    .from('work_entries')
    .update({ stamped_at: bisher.toISOString() })
    .eq('id', id);
  if (error) return alert('Korrektur fehlgeschlagen: ' + error.message);
  row.stamped_at = bisher.toISOString();
  renderWorkTime();
}

/* ---------------------------------------------------------------------------
   Ausgabe
   --------------------------------------------------------------------------- */

function workRowHtml(row) {
  return `<button type="button" class="work-row work-row-${escapeHtml(row.kind)}" onclick="correctWorkStamp('${escapeHtml(row.id)}')" title="Antippen zum Korrigieren">
    <span class="work-row-time">${escapeHtml(formatWorkClock(row))}</span>
    <span class="work-row-label">${escapeHtml(WORK_LABELS[row.kind] || row.kind)}</span>
  </button>`;
}

function renderWorkTime() {
  const karte = $('#workCard');
  if (!karte) {
    console.warn('worktime.js: #workCard fehlt — die Stempeluhr wird nicht angezeigt.');
    return;
  }
  const notiz = $('#workNotice');
  const koerper = $('#workBody');

  if (!workReady) {
    notiz.classList.remove('hide');
    koerper.innerHTML = '';
    stopWorkTicker();
    return;
  }
  notiz.classList.add('hide');

  const stempel = workStamps();
  const zustand = workState(stempel);
  const jetzt = Date.now();
  const netto = workNetSeconds(stempel, jetzt);
  const pause = workBreakSeconds(stempel, jetzt);

  const naechster = workNextKind(zustand);
  const hauptText = zustand === 'fertig' ? 'Feierabend gestempelt' : WORK_LABELS[naechster];
  const hauptKlasse =
    zustand === 'leer' ? 'start' : zustand === 'pause' ? 'weiter' : zustand === 'fertig' ? 'fertig' : 'pause';

  const knopf =
    zustand === 'fertig'
      ? `<div class="work-done">Feierabend · <b>${escapeHtml(formatWorkDuration(netto))}</b> netto</div>`
      : `<button type="button" class="work-main ${hauptKlasse}" onclick="stampWorkNext()">${escapeHtml(hauptText)}</button>`;

  /* Der Feierabend steht bewusst klein daneben: er beendet den Tag, und ein
     Fehlgriff kostet eine Korrektur. */
  const feierabend =
    zustand === 'laeuft' || zustand === 'pause'
      ? `<button type="button" class="work-second" onclick="stampWork('work_end')">Feierabend</button>`
      : '';

  /* Ohne Pause steht "ohne Pause" da, nicht "– Pause". Der Gedankenstrich ist
     das Zeichen fuer "keine Zahl vorhanden" und liest sich hier wie ein Fehler. */
  const pauseText = pause > 0 ? `${escapeHtml(formatWorkMinutes(pause))} Pause` : 'ohne Pause';
  const statusText =
    zustand === 'leer'
      ? 'Noch nicht gestempelt'
      : zustand === 'pause'
        ? `Pause läuft · ${escapeHtml(formatWorkMinutes(pause))} gesamt`
        : zustand === 'fertig'
          ? pauseText
          : `Läuft · ${pauseText}`;

  koerper.innerHTML = `
    <div class="work-now">
      <div class="work-clockface ${zustand}">
        <strong>${escapeHtml(formatWorkDuration(netto))}</strong>
        <small>${statusText}</small>
      </div>
      <div class="work-actions">${knopf}${feierabend}</div>
    </div>
    ${stempel.length ? `<div class="work-list">${stempel.map(workRowHtml).join('')}</div>` : ''}
    <small class="work-hint">Private Aufzeichnung als Gegenkontrolle — nicht die offizielle Zeiterfassung.</small>`;

  if (zustand === 'laeuft' || zustand === 'pause') startWorkTicker();
  else stopWorkTicker();
}

/* Die Anzeige laeuft mit. Minutentakt reicht — die Karte zeigt Stunden und
   Minuten, ein Sekundentakt waere nur Strom. */
function startWorkTicker() {
  if (workTicker) return;
  workTicker = setInterval(() => renderWorkTime(), 30000);
}

function stopWorkTicker() {
  if (!workTicker) return;
  clearInterval(workTicker);
  workTicker = null;
}
