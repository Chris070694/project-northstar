/* Stempeluhr — Arbeitsbeginn, Pause, Feierabend.

   Vier Stempel je Tag in `work_entries`. Die Auswertung rechnet der Client, weil
   der laufende Tag jede Sekunde weiterlaeuft; die Datenbank hat mit
   `work_days_v` dieselbe Rechnung fuer den abgeschlossenen Tag und fuettert
   daraus den Kalender. Beide folgen derselben Regel — sie steht unten bei
   workBreakSeconds und muss dort und in der Sicht gleich bleiben.

   Private Nebenaufzeichnung. Sie ersetzt nicht die offizielle Zeiterfassung des
   Arbeitgebers, sondern ist die Gegenkontrolle dazu. */

let workEntries = [];
let workTargets = {};
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

  /* Sollzeiten sind Beiwerk: fehlen sie, laeuft die Stempeluhr weiter, nur ohne
     Gleitzeitkonto. Ein Fehler hier darf die Uhr nicht mitreissen. */
  const ziele = await sb.from('work_targets').select('*');
  workTargets = {};
  if (!ziele.error) {
    for (const ziel of ziele.data || []) workTargets[Number(ziel.weekday)] = ziel;
  }
}

/* ---------------------------------------------------------------------------
   Gleitzeitkonto
   --------------------------------------------------------------------------- */

/* Aus dem Datumstext den Wochentag, ohne Umweg ueber new Date('2026-09-03'):
   das waere Mitternacht UTC und westlich von Greenwich der Vortag. */
function workWeekday(tag) {
  const teile = String(tag || '').split('-').map(Number);
  if (teile.length !== 3 || teile.some(Number.isNaN)) return null;
  return new Date(teile[0], teile[1] - 1, teile[2]).getDay();
}

function workTargetFor(tag) {
  const wochentag = workWeekday(tag);
  const ziel = wochentag === null ? null : workTargets[wochentag];
  return {
    soll: Number(ziel?.net_minutes) > 0 ? Number(ziel.net_minutes) * 60 : 0,
    beginn: ziel?.start_time || null,
    pause: Number(ziel?.break_minutes) > 0 ? Number(ziel.break_minutes) * 60 : 0,
  };
}

function workHasTargets() {
  return Object.values(workTargets).some(ziel => Number(ziel?.net_minutes) > 0);
}

/* Nur abgeschlossene Tage zaehlen ins Konto. Ein Tag ohne Stempel taucht gar
   nicht auf — er erzeugt also kein Minus. Das ist Absicht: die Uhr ist eine
   Gegenkontrolle, kein Nachweis. Ein Urlaubstag oder ein vergessener Tag soll
   das Konto nicht kaputtmachen. */
function workClosedDays(rows = workEntries) {
  const tage = new Set();
  for (const row of rows) if (row?.kind === 'work_end' && row.work_date) tage.add(row.work_date);
  return [...tage].sort();
}

function workDayBalance(tag, rows = workEntries) {
  const stempel = workStamps(tag, rows);
  if (!stempel.some(row => row.kind === 'work_end')) return null;
  return workNetSeconds(stempel, Date.now()) - workTargetFor(tag).soll;
}

/* Saldo aller abgeschlossenen Tage vor dem angegebenen Tag. Der laufende Tag
   bleibt bewusst draussen — er ist ja noch nicht entschieden. */
function workBalanceBefore(tag = workDayKey(), rows = workEntries) {
  return workClosedDays(rows)
    .filter(eintrag => eintrag < tag)
    .reduce((summe, eintrag) => summe + (workDayBalance(eintrag, rows) || 0), 0);
}

/* Montag als Wochenanfang. */
function workWeekStart(tag = workDayKey()) {
  const teile = String(tag).split('-').map(Number);
  const datum = new Date(teile[0], teile[1] - 1, teile[2]);
  const zurueck = (datum.getDay() + 6) % 7;
  datum.setDate(datum.getDate() - zurueck);
  return workDayKey(datum);
}

/* Alles, was abgeschlossen ist — das ist der Stand des Kontos. */
function workBalanceTotal(rows = workEntries) {
  return workClosedDays(rows).reduce(
    (summe, eintrag) => summe + (workDayBalance(eintrag, rows) || 0),
    0,
  );
}

function workBalanceWeek(tag = workDayKey(), rows = workEntries) {
  const start = workWeekStart(tag);
  return workClosedDays(rows)
    .filter(eintrag => eintrag >= start && eintrag <= tag)
    .reduce((summe, eintrag) => summe + (workDayBalance(eintrag, rows) || 0), 0);
}

function formatWorkBalance(sekunden) {
  if (!Number.isFinite(sekunden)) return '–';
  if (Math.abs(sekunden) < 60) return '±0:00 h';
  const zeichen = sekunden > 0 ? '+' : '−';
  return `${zeichen}${formatWorkDuration(Math.abs(sekunden))}`;
}

/* Wann kann er heute gehen, damit das Konto auf null steht? Gerechnet wird mit
   dem echten Beginn und der echten Pause des Tages, nicht mit der Regelzeit —
   wer um 05:40 angefangen hat, darf frueher heim. */
function workZeroEndTime(stempel, tag = workDayKey(), rows = workEntries) {
  const beginn = stempel.find(row => row.kind === 'work_start');
  if (!beginn) return null;
  const von = workStampTime(beginn);
  if (von === null) return null;
  const soll = workTargetFor(tag).soll;
  if (!soll) return null;
  const zielNetto = soll - workBalanceBefore(tag, rows);
  return von + (workBreakSeconds(stempel, Date.now()) + zielNetto) * 1000;
}

/* Der naechste Tag mit Sollzeit — nach dem Donnerstag also der Freitag, nach
   dem Freitag der Montag. Sucht hoechstens zwei Wochen weit, damit eine leere
   Zieltabelle nicht in eine Endlosschleife laeuft. */
function workNextTargetDay(tag = workDayKey()) {
  const teile = String(tag).split('-').map(Number);
  const datum = new Date(teile[0], teile[1] - 1, teile[2]);
  for (let i = 0; i < 14; i++) {
    datum.setDate(datum.getDate() + 1);
    const key = workDayKey(datum);
    if (workTargetFor(key).soll > 0) return key;
  }
  return null;
}

/* Bis wann muss er an einem kuenftigen Tag bleiben, um auf null zu kommen?
   Hier zaehlt die Regelzeit, denn der Tag hat noch nicht angefangen. */
function workForecast(tag, saldo) {
  const ziel = workTargetFor(tag);
  if (!ziel.soll || !ziel.beginn) return null;
  const [stunde, minute] = String(ziel.beginn).split(':').map(Number);
  const teile = String(tag).split('-').map(Number);
  const start = new Date(teile[0], teile[1] - 1, teile[2], stunde || 0, minute || 0, 0, 0);
  const regulaer = new Date(start.getTime() + (ziel.soll + ziel.pause) * 1000);
  const noetig = new Date(regulaer.getTime() - saldo * 1000);
  return { start, regulaer, noetig, differenz: -saldo };
}

function formatWorkTimeOfDay(datum) {
  if (!(datum instanceof Date) || Number.isNaN(datum.getTime())) return '--:--';
  return new Intl.DateTimeFormat('de-AT', { hour: '2-digit', minute: '2-digit' }).format(datum);
}

const WORK_WEEKDAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

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

function workParseClock(text) {
  const treffer = String(text || '').trim().match(/^(\d{1,2})[:.]?(\d{2})$/);
  if (!treffer) return null;
  const stunde = Number(treffer[1]);
  const minute = Number(treffer[2]);
  if (stunde > 23 || minute > 59) return null;
  return { stunde, minute };
}

/* Eine Uhrzeit auf den Tag eines vorhandenen Stempels legen. Nicht auf heute:
   ein Nachtrag fuer gestern soll gestern bleiben. */
function workTimeOnDay(text, referenz) {
  const uhr = workParseClock(text);
  const basis = workStampTime(referenz);
  if (!uhr || basis === null) return null;
  const datum = new Date(basis);
  datum.setHours(uhr.stunde, uhr.minute, 0, 0);
  return datum.getTime();
}

/* Der Feierabend ist der einzige Stempel, der den Tag zumacht — und er lag im
   ersten Wurf direkt neben der Pause. Christian hat ihn prompt aus Versehen
   ausgeloest. Deshalb eine Rueckfrage, bevor er zaehlt. */
function stampWorkEnd(tag = workDayKey()) {
  const stempel = workStamps(tag);
  const netto = formatWorkDuration(workNetSeconds(stempel, Date.now()));
  if (!confirm(`Feierabend stempeln? Der Tag wird damit abgeschlossen — ${netto} netto.`)) return;
  stampWork('work_end', tag);
}

/* Wieder aufmachen, wenn der Feierabend zu frueh kam. Loescht nur den
   Schlusstempel; alles andere bleibt stehen, und der Kalendereintrag
   verschwindet ueber den Trigger von selbst. */
async function reopenWorkDay(tag = workDayKey()) {
  const ende = workStamps(tag).find(row => row.kind === 'work_end');
  if (!ende) return;
  if (!confirm('Feierabend zurücknehmen? Der Tag läuft dann weiter.')) return;
  const { error } = await sb.from('work_entries').delete().eq('id', ende.id);
  if (error) return alert('Zurücknehmen fehlgeschlagen: ' + error.message);
  workEntries = workEntries.filter(row => row.id !== ende.id);
  renderWorkTime();
}

/* Vergessene Pause nachtragen — auch an einem bereits abgeschlossenen Tag.
   Ohne das war ein zu frueher Feierabend eine Sackgasse: die Pause liess sich
   danach nicht mehr eintragen. */
async function addWorkBreak(tag = workDayKey()) {
  const stempel = workStamps(tag);
  const beginn = stempel.find(row => row.kind === 'work_start');
  if (!beginn) return alert('Erst den Arbeitsbeginn stempeln, dann die Pause nachtragen.');

  const von = prompt('Pause von (HH:MM):', '09:00');
  if (von === null) return;
  const bis = prompt('Pause bis (HH:MM):', '09:30');
  if (bis === null) return;

  const vonZeit = workTimeOnDay(von, beginn);
  const bisZeit = workTimeOnDay(bis, beginn);
  if (vonZeit === null || bisZeit === null) return alert('Bitte beide Zeiten als HH:MM eingeben.');
  if (bisZeit <= vonZeit) return alert('Das Pausenende muss nach dem Pausenbeginn liegen.');

  /* Eine Pause vor dem Arbeitsbeginn oder nach dem Feierabend waere keine
     Pause, sondern eine falsche Zahl im Konto. */
  const beginnZeit = workStampTime(beginn);
  if (vonZeit < beginnZeit) return alert('Die Pause kann nicht vor dem Arbeitsbeginn liegen.');
  const ende = stempel.find(row => row.kind === 'work_end');
  const endeZeit = ende ? workStampTime(ende) : null;
  if (endeZeit !== null && bisZeit > endeZeit) {
    return alert('Die Pause kann nicht nach dem Feierabend enden.');
  }

  const zeilen = [
    { user_id: currentUser.id, work_date: tag, kind: 'break_start', stamped_at: new Date(vonZeit).toISOString() },
    { user_id: currentUser.id, work_date: tag, kind: 'break_end', stamped_at: new Date(bisZeit).toISOString() },
  ];
  const { data, error } = await sb.from('work_entries').insert(zeilen).select();
  if (error) return alert('Die Pause konnte nicht gespeichert werden: ' + error.message);
  workEntries = workEntries.concat(data || []);
  renderWorkTime();
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

  const uhr = workParseClock(antwort);
  if (!uhr) return alert('Bitte als HH:MM eingeben, zum Beispiel 06:15.');

  /* Auf dem bisherigen Zeitpunkt aufsetzen, nicht auf heute: ein Stempel von
     gestern soll beim Korrigieren nicht auf den heutigen Tag springen. */
  const bisher = new Date(workStampTime(row) ?? Date.now());
  bisher.setHours(uhr.stunde, uhr.minute, 0, 0);
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

/* Das Gleitzeitkonto. Waehrend der Tag laeuft: bis wann muss ich heute bleiben.
   Nach dem Feierabend: wie steht das Konto, und was heisst das fuer den
   naechsten Arbeitstag — genau die Frage am Donnerstagabend. */
function workBalanceHtml(stempel, zustand, tag = workDayKey()) {
  if (!workHasTargets()) return '';
  const ziel = workTargetFor(tag);
  const saldoWoche = workBalanceWeek(tag);
  const zeilen = [];

  if (ziel.soll > 0 && (zustand === 'laeuft' || zustand === 'pause')) {
    const ende = workZeroEndTime(stempel, tag);
    const vorher = workBalanceBefore(tag);
    if (ende) {
      const wann = formatWorkTimeOfDay(new Date(ende));
      /* Liegt der Zeitpunkt schon hinter uns, ist das Konto heute bereits
         ausgeglichen — dann keine Uhrzeit nennen, die nach Rueckstand aussieht. */
      const erreicht = ende <= Date.now();
      zeilen.push(
        erreicht
          ? `<span>Soll erfüllt — jeder Stempel ab jetzt ist Plus</span>`
          : `<span>Feierabend <b>${escapeHtml(wann)}</b> für ±0</span>`,
      );
      if (Math.abs(vorher) >= 60) {
        zeilen.push(
          `<span>davon <b>${escapeHtml(formatWorkBalance(vorher))}</b> aus den Vortagen</span>`,
        );
      }
    }
  }

  if (ziel.soll > 0 && zustand !== 'fertig' && zustand !== 'leer') {
    zeilen.push(`<span>Soll heute ${escapeHtml(formatWorkDuration(ziel.soll))}</span>`);
  }

  if (zustand === 'fertig') {
    const heute = workDayBalance(tag);
    if (heute !== null) {
      zeilen.push(`<span>Heute <b>${escapeHtml(formatWorkBalance(heute))}</b></span>`);
    }
    zeilen.push(`<span>Woche <b>${escapeHtml(formatWorkBalance(saldoWoche))}</b></span>`);

    /* Der eigentliche Punkt: was bedeutet der Saldo fuer den naechsten
       Arbeitstag? Am Donnerstagabend also der Freitag. */
    const naechster = workNextTargetDay(tag);
    const gesamt = workBalanceTotal();
    const vorschau = naechster ? workForecast(naechster, gesamt) : null;
    if (vorschau) {
      const name = WORK_WEEKDAY_NAMES[workWeekday(naechster)] || 'Nächster Tag';
      const regulaer = formatWorkTimeOfDay(vorschau.regulaer);
      const noetig = formatWorkTimeOfDay(vorschau.noetig);
      zeilen.push(
        Math.abs(vorschau.differenz) < 60
          ? `<span>${escapeHtml(name)} regulär bis <b>${escapeHtml(regulaer)}</b></span>`
          : `<span>${escapeHtml(name)} bis <b>${escapeHtml(noetig)}</b> statt ${escapeHtml(regulaer)}</span>`,
      );
    }
  }

  if (!zeilen.length) return '';
  const ton = saldoWoche > 60 ? 'plus' : saldoWoche < -60 ? 'minus' : '';
  return `<div class="work-balance ${ton}">${zeilen.join('')}</div>`;
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
      ? `<button type="button" class="work-second" onclick="stampWorkEnd()">Feierabend</button>`
      : '';

  /* Nachtragen und Zuruecknehmen: der Ausweg, wenn ein Stempel danebenging.
     Steht bewusst klein und unter der Uhr, nicht neben den Stempelknoepfen. */
  const nachtrag =
    zustand === 'leer'
      ? ''
      : `<div class="work-fix">
          <button type="button" class="work-fix-btn" onclick="addWorkBreak()">Pause nachtragen</button>
          ${zustand === 'fertig' ? `<button type="button" class="work-fix-btn" onclick="reopenWorkDay()">Feierabend zurücknehmen</button>` : ''}
        </div>`;

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
    ${workBalanceHtml(stempel, zustand)}
    ${stempel.length ? `<div class="work-list">${stempel.map(workRowHtml).join('')}</div>` : ''}
    ${nachtrag}
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
