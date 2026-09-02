/* Stempeluhr.

   Die Rechnung ist einfach, die Randfälle sind es nicht: eine laufende Pause,
   ein vergessenes Pausenende, Feierabend mitten in der Pause, ein Fehlstempel
   der korrigiert wird. Genau daran hängt, ob die Zahl am Ende des Tages stimmt.

   Die Pausenregel steht doppelt — hier und in work_days_v. Beide müssen dasselbe
   rechnen, sonst zeigt die Karte etwas anderes als der Kalendereintrag. */

const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const quelle = fs.readFileSync('modules/worktime.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const styles = fs.readFileSync('styles.css', 'utf8');
const serviceWorker = fs.readFileSync('sw.js', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260901_arbeitszeit.sql', 'utf8');
const sollMigration = fs.readFileSync('supabase/migrations/20260901_sollzeiten.sql', 'utf8');
const kalender = fs.readFileSync('modules/calendar.js', 'utf8');

const knoten = new Map();
const machKnoten = () => {
  const el = { innerHTML: '', textContent: '', klassen: new Set() };
  el.classList = {
    add: name => el.klassen.add(name),
    remove: name => el.klassen.delete(name),
    contains: name => el.klassen.has(name),
  };
  return el;
};
const context = vm.createContext({
  console: { warn: () => {}, log: () => {}, error: () => {} },
  Number,
  Math,
  Date,
  Intl,
  setInterval: () => 1,
  clearInterval: () => {},
  currentUser: { id: 'test-user' },
  /* Die Dialoge werden pro Fall gesetzt; die Vorgabe sagt Nein, damit ein
     vergessenes Setzen nicht versehentlich stempelt. */
  confirm: () => false,
  prompt: () => null,
  alert: () => {},
  sb: { from: () => ({ insert: () => ({ select: () => Promise.resolve({ data: [], error: null }) }), delete: () => ({ eq: () => Promise.resolve({ error: null }) }) }) },
  $: selektor => {
    if (!knoten.has(selektor)) knoten.set(selektor, machKnoten());
    return knoten.get(selektor);
  },
  escapeHtml: value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[ch],
    ),
});
vm.runInContext(quelle, context);
const wert = ausdruck => vm.runInContext(ausdruck, context);
/* workEntries ist mit let deklariert und haengt nicht am Kontext-Objekt. */
const setzeEntries = rows =>
  vm.runInContext(`workEntries = ${JSON.stringify(rows)}; workReady = true;`, context);

const TAG = '2026-09-01';
const stempel = (kind, uhr, id = `${kind}-${uhr}`) => ({
  id,
  work_date: TAG,
  kind,
  stamped_at: `2026-09-01T${uhr}:00.000Z`,
});
/* Alles in UTC gerechnet, damit der Test unabhaengig von der Zeitzone des
   Laeufers ist — die Dauern sind Differenzen, die Zeitzone kuerzt sich raus. */
const JETZT = ausdruck => `Date.parse('2026-09-01T${ausdruck}:00.000Z')`;

// ---------------------------------------------------------------------------
// Zustand
// ---------------------------------------------------------------------------
assert.strictEqual(wert('workState([])'), 'leer');
setzeEntries([stempel('work_start', '05:00')]);
assert.strictEqual(wert('workState(workStamps("2026-09-01"))'), 'laeuft');
setzeEntries([stempel('work_start', '05:00'), stempel('break_start', '08:00')]);
assert.strictEqual(wert('workState(workStamps("2026-09-01"))'), 'pause');
setzeEntries([stempel('work_start', '05:00'), stempel('break_start', '08:00'), stempel('break_end', '08:30')]);
assert.strictEqual(wert('workState(workStamps("2026-09-01"))'), 'laeuft', 'nach der Pause laeuft es wieder');
setzeEntries([stempel('work_start', '05:00'), stempel('work_end', '14:30')]);
assert.strictEqual(wert('workState(workStamps("2026-09-01"))'), 'fertig');

// Der naechste Stempel ergibt sich aus dem Zustand.
assert.strictEqual(wert("workNextKind('leer')"), 'work_start');
assert.strictEqual(wert("workNextKind('laeuft')"), 'break_start');
assert.strictEqual(wert("workNextKind('pause')"), 'break_end');
assert.strictEqual(wert("workNextKind('fertig')"), null, 'ein fertiger Tag hat keinen naechsten Stempel');

// Stempel sortieren sich, auch wenn sie verdreht ankommen.
setzeEntries([stempel('work_end', '14:30'), stempel('work_start', '05:00'), stempel('break_start', '08:00')]);
const sortiert = [...wert('workStamps("2026-09-01")')].map(row => row.kind);
assert.deepStrictEqual(sortiert, ['work_start', 'break_start', 'work_end']);
// Ein fremder Tag gehoert nicht dazu.
setzeEntries([stempel('work_start', '05:00'), { ...stempel('work_start', '05:00'), work_date: '2026-08-31', id: 'x' }]);
assert.strictEqual([...wert('workStamps("2026-09-01")')].length, 1);

// ---------------------------------------------------------------------------
// Die Rechnung
// ---------------------------------------------------------------------------
const tag = rows => {
  setzeEntries(rows);
  return 'workStamps("2026-09-01")';
};

// Voller Tag: 05:00 bis 14:30, 30 min Pause → brutto 9:30, netto 9:00
let s = tag([
  stempel('work_start', '05:00'),
  stempel('break_start', '08:00'),
  stempel('break_end', '08:30'),
  stempel('work_end', '14:30'),
]);
assert.strictEqual(wert(`workGrossSeconds(${s}, ${JETZT('20:00')})`), 34200);
assert.strictEqual(wert(`workBreakSeconds(${s}, ${JETZT('20:00')})`), 1800);
assert.strictEqual(wert(`workNetSeconds(${s}, ${JETZT('20:00')})`), 32400);
/* Nach dem Feierabend darf die Uhr nicht weiterlaufen. */
assert.strictEqual(
  wert(`workNetSeconds(${s}, ${JETZT('23:00')})`),
  32400,
  'ein abgeschlossener Tag waechst nicht weiter',
);

// Laufender Tag: rechnet gegen jetzt.
s = tag([stempel('work_start', '05:00')]);
assert.strictEqual(wert(`workNetSeconds(${s}, ${JETZT('08:00')})`), 10800, 'drei Stunden');
assert.strictEqual(wert(`workBreakSeconds(${s}, ${JETZT('08:00')})`), 0);

/* Laufende Pause: sie zaehlt ab sofort mit, sonst stuende die Nettozeit still
   und Christian glaubte, er habe laenger gearbeitet als er hat. */
s = tag([stempel('work_start', '05:00'), stempel('break_start', '08:00')]);
assert.strictEqual(wert(`workBreakSeconds(${s}, ${JETZT('08:20')})`), 1200, 'zwanzig Minuten Pause bisher');
assert.strictEqual(wert(`workNetSeconds(${s}, ${JETZT('08:20')})`), 10800, 'netto steht waehrend der Pause still');
assert.strictEqual(wert(`workNetSeconds(${s}, ${JETZT('09:00')})`), 10800, 'auch eine Stunde spaeter noch');

/* Vergessenes Pausenende und danach ein zweiter Pausenbeginn: das offene
   Pausenpaar zaehlt nicht, sonst liefe es bis zum Feierabend weiter. */
s = tag([
  stempel('work_start', '05:00'),
  stempel('break_start', '08:00'),
  stempel('break_start', '12:00', 'zweiter'),
  stempel('break_end', '12:30'),
  stempel('work_end', '14:30'),
]);
assert.strictEqual(
  wert(`workBreakSeconds(${s}, ${JETZT('20:00')})`),
  1800,
  'nur die geschlossene Pause zaehlt, nicht die vergessene',
);

/* Feierabend mitten in der Pause: die Pause endete mit dem Arbeitstag. Ohne
   diesen Zweig liefe sie bis Mitternacht und die Nettozeit waere negativ. */
s = tag([stempel('work_start', '05:00'), stempel('break_start', '14:00'), stempel('work_end', '14:30')]);
assert.strictEqual(wert(`workBreakSeconds(${s}, ${JETZT('23:00')})`), 1800);
assert.strictEqual(wert(`workNetSeconds(${s}, ${JETZT('23:00')})`), 32400);
assert.ok(wert(`workNetSeconds(${s}, ${JETZT('23:00')})`) > 0, 'niemals negativ');

// Zwei Pausen zaehlen zusammen.
s = tag([
  stempel('work_start', '05:00'),
  stempel('break_start', '08:00'),
  stempel('break_end', '08:15'),
  stempel('break_start', '11:00'),
  stempel('break_end', '11:30'),
  stempel('work_end', '14:30'),
]);
assert.strictEqual(wert(`workBreakSeconds(${s}, ${JETZT('20:00')})`), 2700, '15 plus 30 Minuten');

// Ohne Arbeitsbeginn gibt es nichts zu rechnen, auch keinen Absturz.
s = tag([stempel('break_start', '08:00')]);
assert.strictEqual(wert(`workGrossSeconds(${s}, ${JETZT('09:00')})`), 0);
assert.strictEqual(wert(`workNetSeconds(${s}, ${JETZT('09:00')})`), 0, 'nie negativ, auch nicht bei Unsinn');

// Kaputte Zeitstempel reissen nichts.
s = tag([{ id: 'a', work_date: TAG, kind: 'work_start', stamped_at: 'kaputt' }]);
assert.strictEqual(wert(`workGrossSeconds(${s}, ${JETZT('09:00')})`), 0);
assert.strictEqual(wert("formatWorkClock({stamped_at: 'kaputt'})"), '--:--');
assert.strictEqual(wert('formatWorkClock({})'), '--:--');

// ---------------------------------------------------------------------------
// Zahlen lesbar
// ---------------------------------------------------------------------------
assert.strictEqual(wert('formatWorkDuration(32400)'), '9:00 h');
assert.strictEqual(wert('formatWorkDuration(34260)'), '9:31 h');
assert.strictEqual(wert('formatWorkDuration(0)'), '0:00 h');
assert.strictEqual(wert('formatWorkDuration(-5)'), '–');
assert.strictEqual(wert('formatWorkDuration(NaN)'), '–');
assert.strictEqual(wert('formatWorkMinutes(1800)'), '30 min');
assert.strictEqual(wert('formatWorkMinutes(0)'), '–', 'keine Pause ist keine Null-Minuten-Pause');
assert.strictEqual(wert('formatWorkMinutes(5400)'), '1:30 h', 'ab einer Stunde in Stunden');

// ---------------------------------------------------------------------------
// Ausgabe
// ---------------------------------------------------------------------------
const zeige = () => knoten.get('#workBody').innerHTML;
const heute = () => vm.runInContext('workDayKey()', context);

const heuteStempel = (kind, minutenZurueck, id = kind) => ({
  id,
  work_date: heute(),
  kind,
  stamped_at: new Date(Date.now() - minutenZurueck * 60000).toISOString(),
});

setzeEntries([]);
wert('renderWorkTime();');
assert.match(zeige(), /Arbeitsbeginn/, 'ohne Stempel steht da, wie man anfaengt');
assert.match(zeige(), /work-main start/);
assert.doesNotMatch(zeige(), /Feierabend<\/button>/, 'ohne Beginn kein Feierabend-Knopf');
assert.match(zeige(), /Noch nicht gestempelt/);

setzeEntries([heuteStempel('work_start', 180)]);
wert('renderWorkTime();');
assert.match(zeige(), /3:00 h/, 'drei Stunden gearbeitet');
assert.match(zeige(), /work-main pause/, 'der grosse Knopf bietet die Pause an');
assert.match(zeige(), /onclick="stampWorkEnd\(\)"/, 'der Feierabend steht klein daneben, mit Rückfrage');
assert.match(zeige(), /Läuft/);
/* Ohne Pause muss "ohne Pause" dastehen. "– Pause" liest sich wie ein Fehler —
   der Gedankenstrich heisst sonst "keine Zahl vorhanden". */
assert.match(zeige(), /ohne Pause/);
assert.doesNotMatch(zeige(), /– Pause/);

setzeEntries([heuteStempel('work_start', 180), heuteStempel('break_start', 20)]);
wert('renderWorkTime();');
assert.match(zeige(), /work-main weiter/, 'in der Pause bietet der Knopf Weiter an');
assert.match(zeige(), /Pause läuft/);
assert.match(zeige(), /20 min/);
assert.match(zeige(), /2:40 h/, 'die Nettozeit steht ohne die laufende Pause');

setzeEntries([
  heuteStempel('work_start', 570),
  heuteStempel('break_start', 390),
  heuteStempel('break_end', 360),
  heuteStempel('work_end', 0),
]);
wert('renderWorkTime();');
assert.match(zeige(), /Feierabend gestempelt|work-done/, 'der fertige Tag zeigt keinen Knopf mehr');
assert.doesNotMatch(zeige(), /work-main/, 'und keinen Hauptknopf');
assert.match(zeige(), /9:00 h/, 'neuneinhalb Stunden minus halbe Stunde Pause');

// Alle vier Stempel stehen als antippbare Zeilen da.
assert.strictEqual((zeige().match(/class="work-row /g) || []).length, 4);
assert.match(zeige(), /onclick="correctWorkStamp\('work_start'\)"/);
assert.doesNotMatch(zeige(), /NaN|undefined|Infinity/);
assert.match(zeige(), /nicht die offizielle Zeiterfassung/, 'der Hinweis steht dabei');

// Fehlende Tabelle wird benannt, nicht als "null Stunden" gezeigt.
vm.runInContext('workReady = false; renderWorkTime();', context);
assert.strictEqual(knoten.get('#workNotice').klassen.has('hide'), false, 'der Hinweis erscheint');
assert.strictEqual(zeige(), '');
vm.runInContext('workReady = true; renderWorkTime();', context);
assert.ok(knoten.get('#workNotice').klassen.has('hide'));

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------
assert.match(migration, /create table if not exists public\.work_entries/);
assert.match(migration, /check \(kind in \('work_start', 'break_start', 'break_end', 'work_end'\)\)/);
assert.match(migration, /enable row level security/);
for (const recht of ['for select', 'for insert', 'for update', 'for delete']) {
  assert.ok(migration.includes(recht), `RLS-Politik fehlt: ${recht}`);
}
/* Beginn und Feierabend genau einmal pro Tag — ohne das wird aus einem
   Fehlgriff ein zweiter Arbeitstag. */
assert.match(migration, /work_entries_ein_beginn[\s\S]*where kind = 'work_start'/);
assert.match(migration, /work_entries_ein_ende[\s\S]*where kind = 'work_end'/);
assert.match(migration, /security_invoker = on/, 'die Sicht laeuft unter den Rechten des Aufrufers');

/* Der Trigger muss auf jede Aenderung hoeren. Nur auf work_end waere der
   Kalendereintrag nach einer Korrektur veraltet — der haeufigste Fall. */
assert.match(
  migration,
  /after insert or update or delete on public\.work_entries/,
  'der Trigger haengt an allen Aenderungen, nicht nur am Feierabend',
);
assert.match(migration, /source = 'work_clock'/, 'erzeugte Termine sind markiert');
assert.match(migration, /add column if not exists source/, 'additiv, das Kalendermodul bleibt unberuehrt');
assert.match(migration, /delete from public\.calendar_events/, 'ohne Feierabend verschwindet der Termin wieder');

// ---------------------------------------------------------------------------
// Verdrahtung
// ---------------------------------------------------------------------------
const seite = index.slice(index.indexOf('<section id="today"'), index.indexOf('<section id="trading"'));
for (const id of ['id="workCard"', 'id="workBody"', 'id="workNotice"']) {
  assert.ok(seite.includes(id), `${id} fehlt auf der Heute-Seite`);
}
/* Die Uhr gehoert in die Jetzt-Zone, ueber das Abzuhakende. */
assert.ok(seite.indexOf('id="quoteCard"') < seite.indexOf('id="workCard"'));
assert.ok(seite.indexOf('id="workCard"') < seite.indexOf('>Heute</div>'));

assert.match(app, /loadWorkTime\(\)/);
assert.match(app, /renderWorkTime\(\)/);
assert.match(styles, /\.work-card\b/);
assert.match(styles, /\.work-main\b/);
/* Die Knoepfe muessen mit dem Daumen zu treffen sein — 48 px, nicht 30. */
assert.match(styles, /\.work-main[\s\S]{0,200}min-height: 48px/);
assert.match(styles, /\.work-second[\s\S]{0,200}min-height: 48px/);

assert.strictEqual(
  (serviceWorker.match(/\.\/modules\/worktime\.js\?v=(\d+)/) || [])[1],
  (index.match(/modules\/worktime\.js\?v=(\d+)/) || [])[1],
  'worktime.js: Version laeuft auseinander',
);
assert.strictEqual(
  (serviceWorker.match(/styles\.css\?v=(\d+)/) || [])[1],
  (index.match(/styles\.css\?v=(\d+)/) || [])[1],
  'styles.css: Version laeuft auseinander',
);

// ---------------------------------------------------------------------------
// Gleitzeitkonto
// ---------------------------------------------------------------------------
/* Christians Woche: Mo–Do 8:00 netto, Fr 6:30, jeweils ab 06:00 mit 30 min
   Pause. Macht 38:30 — genau das, was er angesagt hat. */
const ZIELE = {
  0: { weekday: 0, net_minutes: 0, start_time: '06:00', break_minutes: 0 },
  1: { weekday: 1, net_minutes: 480, start_time: '06:00', break_minutes: 30 },
  2: { weekday: 2, net_minutes: 480, start_time: '06:00', break_minutes: 30 },
  3: { weekday: 3, net_minutes: 480, start_time: '06:00', break_minutes: 30 },
  4: { weekday: 4, net_minutes: 480, start_time: '06:00', break_minutes: 30 },
  5: { weekday: 5, net_minutes: 390, start_time: '06:00', break_minutes: 30 },
  6: { weekday: 6, net_minutes: 0, start_time: '06:00', break_minutes: 0 },
};
const setzeZiele = (ziele = ZIELE) =>
  vm.runInContext(`workTargets = ${JSON.stringify(ziele)};`, context);
setzeZiele();

/* 2026: der 1.9. ist ein Dienstag, der 3.9. ein Donnerstag, der 4.9. ein Freitag. */
assert.strictEqual(wert("workWeekday('2026-09-01')"), 2, 'der 1.9.2026 ist ein Dienstag');
assert.strictEqual(wert("workWeekday('2026-09-03')"), 4, 'der 3.9. ein Donnerstag');
assert.strictEqual(wert("workWeekday('2026-09-04')"), 5, 'der 4.9. ein Freitag');
assert.strictEqual(wert("workWeekday('kaputt')"), null);

assert.strictEqual(wert("workTargetFor('2026-09-03').soll"), 28800, 'Donnerstag 8 Stunden');
assert.strictEqual(wert("workTargetFor('2026-09-04').soll"), 23400, 'Freitag 6,5 Stunden');
assert.strictEqual(wert("workTargetFor('2026-09-05').soll"), 0, 'Samstag kein Soll');
assert.strictEqual(wert("workTargetFor('kaputt').soll"), 0);

// Die Woche beginnt am Montag.
assert.strictEqual(wert("workWeekStart('2026-09-03')"), '2026-08-31', 'Donnerstag → Montag davor');
assert.strictEqual(wert("workWeekStart('2026-08-31')"), '2026-08-31', 'Montag bleibt Montag');
assert.strictEqual(wert("workWeekStart('2026-09-06')"), '2026-08-31', 'Sonntag gehoert zur Woche davor');

/* Ein voller Arbeitstag: Dienstag 06:00–14:30 mit 30 min Pause ist genau das
   Soll — Saldo null, nicht "ungefaehr". */
const arbeitstag = (tag, von, pauseVon, pauseBis, bis) => [
  { id: `${tag}-a`, work_date: tag, kind: 'work_start', stamped_at: `${tag}T${von}:00.000Z` },
  { id: `${tag}-b`, work_date: tag, kind: 'break_start', stamped_at: `${tag}T${pauseVon}:00.000Z` },
  { id: `${tag}-c`, work_date: tag, kind: 'break_end', stamped_at: `${tag}T${pauseBis}:00.000Z` },
  { id: `${tag}-d`, work_date: tag, kind: 'work_end', stamped_at: `${tag}T${bis}:00.000Z` },
];

setzeEntries(arbeitstag('2026-09-01', '06:00', '09:00', '09:30', '14:30'));
assert.strictEqual(wert("workDayBalance('2026-09-01')"), 0, 'Regelarbeitstag ergibt Saldo null');

// Eine halbe Stunde laenger → plus 30 Minuten.
setzeEntries(arbeitstag('2026-09-01', '06:00', '09:00', '09:30', '15:00'));
assert.strictEqual(wert("workDayBalance('2026-09-01')"), 1800);
// Eine Stunde frueher heim → minus eine Stunde.
setzeEntries(arbeitstag('2026-09-01', '06:00', '09:00', '09:30', '13:30'));
assert.strictEqual(wert("workDayBalance('2026-09-01')"), -3600);

/* Ein laufender Tag zaehlt nicht ins Konto — er ist noch nicht entschieden. */
setzeEntries([{ id: 'x', work_date: '2026-09-01', kind: 'work_start', stamped_at: '2026-09-01T06:00:00.000Z' }]);
assert.strictEqual(wert("workDayBalance('2026-09-01')"), null);
assert.strictEqual([...wert('workClosedDays()')].length, 0);

/* Ein Tag ganz ohne Stempel erzeugt kein Minus. Bei einer Gegenkontrolle darf
   ein Urlaubstag oder ein vergessener Tag das Konto nicht kaputtmachen. */
setzeEntries(arbeitstag('2026-09-01', '06:00', '09:00', '09:30', '14:30'));
assert.strictEqual(wert('workBalanceTotal()'), 0, 'der uebersprungene Mittwoch zaehlt nicht mit');

/* Christians eigentliche Frage: Mo–Mi je eine halbe Stunde zu kurz, am
   Donnerstag Feierabend — wie lange muss er am Freitag bleiben? */
setzeEntries([
  ...arbeitstag('2026-08-31', '06:00', '09:00', '09:30', '14:00'), // Mo −30
  ...arbeitstag('2026-09-01', '06:00', '09:00', '09:30', '14:00'), // Di −30
  ...arbeitstag('2026-09-02', '06:00', '09:00', '09:30', '14:00'), // Mi −30
  ...arbeitstag('2026-09-03', '06:00', '09:00', '09:30', '14:00'), // Do −30
]);
assert.strictEqual(wert('workBalanceTotal()'), -7200, 'vier mal minus 30 Minuten sind minus 2 Stunden');
assert.strictEqual(wert("workBalanceWeek('2026-09-03')"), -7200);
assert.strictEqual(wert("workNextTargetDay('2026-09-03')"), '2026-09-04', 'nach Donnerstag kommt Freitag');
assert.strictEqual(wert("workNextTargetDay('2026-09-04')"), '2026-09-07', 'nach Freitag der Montag');

const vorschau = wert("workForecast('2026-09-04', workBalanceTotal())");
assert.strictEqual(
  wert("formatWorkTimeOfDay(workForecast('2026-09-04', 0).regulaer)"),
  '13:00',
  'Freitag regulaer bis 13:00',
);
assert.strictEqual(
  wert("formatWorkTimeOfDay(workForecast('2026-09-04', workBalanceTotal()).noetig)"),
  '15:00',
  'mit zwei Stunden Rueckstand bis 15:00',
);
assert.strictEqual(vorschau.differenz, 7200, 'zwei Stunden laenger');

/* Umgekehrt: mit Guthaben darf er frueher gehen. */
setzeEntries(arbeitstag('2026-09-03', '06:00', '09:00', '09:30', '15:30'));
assert.strictEqual(wert('workBalanceTotal()'), 3600);
assert.strictEqual(
  wert("formatWorkTimeOfDay(workForecast('2026-09-04', workBalanceTotal()).noetig)"),
  '12:00',
  'eine Stunde Guthaben heisst Freitag eine Stunde frueher',
);

// Vorzeichen lesbar.
assert.strictEqual(wert('formatWorkBalance(0)'), '±0:00 h');
assert.strictEqual(wert('formatWorkBalance(30)'), '±0:00 h', 'unter einer Minute ist null');
assert.strictEqual(wert('formatWorkBalance(1800)'), '+0:30 h');
assert.strictEqual(wert('formatWorkBalance(-7200)'), '−2:00 h');
assert.strictEqual(wert('formatWorkBalance(NaN)'), '–');

// Ohne Sollzeiten bleibt die Karte eine reine Stempeluhr, ohne Konto.
vm.runInContext('workTargets = {};', context);
assert.strictEqual(wert('workHasTargets()'), false);
assert.strictEqual(wert("workBalanceHtml([], 'leer')"), '', 'kein Konto ohne Sollzeiten');
setzeZiele();
assert.strictEqual(wert('workHasTargets()'), true);

// --- in der Karte ---------------------------------------------------------
const heuteTag = () => vm.runInContext('workDayKey()', context);
const heuteStempel2 = (kind, minutenZurueck, id = kind) => ({
  id,
  work_date: heuteTag(),
  kind,
  stamped_at: new Date(Date.now() - minutenZurueck * 60000).toISOString(),
});
/* Fuer die Kartenpruefung braucht heute ein Soll — sonst zeigt die Karte je
   nach Wochentag mal etwas und mal nichts, und die Pruefung waere zufaellig. */
const heuteWochentag = vm.runInContext('workWeekday(workDayKey())', context);
setzeZiele({ ...ZIELE, [heuteWochentag]: { weekday: heuteWochentag, net_minutes: 480, start_time: '06:00', break_minutes: 30 } });

setzeEntries([heuteStempel2('work_start', 180)]);
wert('renderWorkTime();');
assert.match(zeige(), /Soll heute 8:00 h/, 'das Tagessoll steht da');
assert.match(zeige(), /Feierabend <b>\d{2}:\d{2}<\/b> für ±0/, 'und die Uhrzeit fuer null');

setzeEntries([heuteStempel2('work_start', 570), heuteStempel2('work_end', 0)]);
wert('renderWorkTime();');
assert.match(zeige(), /Heute <b>\+1:30 h<\/b>/, 'neuneinhalb Stunden ohne Pause sind anderthalb Plus');
assert.match(zeige(), /Woche <b>/, 'der Wochensaldo steht dabei');
assert.match(zeige(), /(regulär bis|bis <b>)/, 'und was das fuer den naechsten Arbeitstag heisst');
assert.doesNotMatch(zeige(), /NaN|undefined|Infinity/);
setzeZiele();

// ---------------------------------------------------------------------------
// Sollzeiten-Migration
// ---------------------------------------------------------------------------
assert.match(sollMigration, /create table if not exists public\.work_targets/);
assert.match(sollMigration, /weekday between 0 and 6/);
assert.match(sollMigration, /enable row level security/);
/* Die Startwerte sind Christians Woche. Aendert er sie von Hand, darf ein
   erneuter Lauf sie nicht ueberschreiben. */
assert.match(sollMigration, /on conflict \(user_id, weekday\) do nothing/);
assert.match(sollMigration, /\(5, 390,/, 'Freitag 390 Minuten netto');
assert.match(sollMigration, /\(1, 480,/, 'Montag 480 Minuten netto');

// ---------------------------------------------------------------------------
// Kalender: ein Arbeitstag ist keine Aufgabe
// ---------------------------------------------------------------------------
assert.match(kalender, /function isStampedWorkEvent/);
assert.match(kalender, /source === 'work_clock'/);
/* Der Erledigt-Knopf darf bei einem Stempeluhr-Termin nicht erscheinen: der Tag
   ist vorbei, es gibt nichts abzuhaken. Loeschen auch nicht — der Termin waere
   bis zum naechsten Stempel weg und kaeme dann wieder. */
assert.match(kalender, /isStampedWorkEvent\(e\) \? '<span class="event-source">/);
assert.match(kalender, /reminder_time,source'/, 'die Spalte source wird mitgelesen');
assert.match(styles, /\.event-source\b/);
assert.match(styles, /\.work-balance\b/);

// ---------------------------------------------------------------------------
// Ausweg aus einem Fehlstempel
// ---------------------------------------------------------------------------
/* Christians Fall: der Feierabend loeste versehentlich aus, und danach liess
   sich die Pause nicht mehr eintragen. Beides wird hier geprueft. */

/* Objekte aus dem vm-Kontext haben einen anderen Prototyp — vor dem Vergleich
   ins Testrealm kopieren, sonst scheitert deepStrictEqual an der Herkunft. */
const alsObjekt = ausdruck => ({ ...wert(ausdruck) });
assert.deepStrictEqual(alsObjekt("workParseClock('06:15')"), { stunde: 6, minute: 15 });
assert.deepStrictEqual(alsObjekt("workParseClock('6.05')"), { stunde: 6, minute: 5 });
assert.deepStrictEqual(alsObjekt("workParseClock('0630')"), { stunde: 6, minute: 30 }, 'auch ohne Trenner');
assert.strictEqual(wert("workParseClock('25:00')"), null, 'die Stunde gibt es nicht');
assert.strictEqual(wert("workParseClock('12:99')"), null, 'die Minute auch nicht');
assert.strictEqual(wert("workParseClock('quatsch')"), null);
assert.strictEqual(wert("workParseClock('')"), null);

/* Eine nachgetragene Zeit legt sich auf den Tag des Bezugsstempels, nicht auf
   heute — sonst wandert ein Nachtrag von gestern in den heutigen Tag. */
const bezug = { stamped_at: '2026-08-31T04:00:00.000Z' };
const gelegt = wert(`workTimeOnDay('09:00', ${JSON.stringify(bezug)})`);
assert.strictEqual(
  new Date(gelegt).getDate(),
  new Date(Date.parse(bezug.stamped_at)).getDate(),
  'der Nachtrag bleibt an seinem Tag',
);
assert.strictEqual(new Date(gelegt).getHours(), 9);
assert.strictEqual(wert(`workTimeOnDay('kaputt', ${JSON.stringify(bezug)})`), null);
assert.strictEqual(wert("workTimeOnDay('09:00', {stamped_at:'kaputt'})"), null);

/* Der Feierabend fragt nach. Sagt man Nein, passiert nichts — genau das hat
   gefehlt, als er danebengriff. */
setzeEntries([stempel('work_start', '05:00')]);
vm.runInContext('confirm = () => false;', context);
wert('stampWorkEnd("2026-09-01");');
assert.strictEqual(
  [...wert('workStamps("2026-09-01")')].some(row => row.kind === 'work_end'),
  false,
  'ohne Bestaetigung wird kein Feierabend gestempelt',
);

// Eine nachgetragene Pause muss innerhalb des Arbeitstags liegen.
let gemeldet = [];
vm.runInContext('alert = text => { __gemeldet.push(text); };', context);
vm.runInContext('var __gemeldet = [];', context);
const meldungen = () => [...vm.runInContext('__gemeldet', context)];
const leeren = () => vm.runInContext('__gemeldet = [];', context);

setzeEntries([stempel('work_start', '05:00'), stempel('work_end', '14:00')]);
vm.runInContext("prompt = frage => (/von/i.test(frage) ? '04:00' : '04:30');", context);
leeren();
wert('addWorkBreak("2026-09-01");');
assert.match(meldungen().join(' '), /vor dem Arbeitsbeginn/, 'Pause vor dem Beginn wird abgelehnt');

vm.runInContext("prompt = frage => (/von/i.test(frage) ? '15:00' : '15:30');", context);
leeren();
wert('addWorkBreak("2026-09-01");');
assert.match(meldungen().join(' '), /nach dem Feierabend/, 'Pause nach dem Feierabend wird abgelehnt');

vm.runInContext("prompt = frage => (/von/i.test(frage) ? '09:30' : '09:00');", context);
leeren();
wert('addWorkBreak("2026-09-01");');
assert.match(meldungen().join(' '), /nach dem Pausenbeginn/, 'verdrehte Zeiten werden abgelehnt');

vm.runInContext("prompt = () => 'quatsch';", context);
leeren();
wert('addWorkBreak("2026-09-01");');
assert.match(meldungen().join(' '), /HH:MM/, 'unlesbare Eingabe wird abgelehnt');

// Ohne Arbeitsbeginn gibt es nichts nachzutragen.
setzeEntries([]);
vm.runInContext("prompt = () => '09:00';", context);
leeren();
wert('addWorkBreak("2026-09-01");');
assert.match(meldungen().join(' '), /Erst den Arbeitsbeginn/);

/* Der gute Fall: eine halbe Stunde Pause in einen abgeschlossenen Tag
   nachtragen. Genau Christians Situation. */
setzeEntries([stempel('work_start', '05:00'), stempel('work_end', '14:00')]);
vm.runInContext(
  `sb = { from: () => ({ insert: zeilen => ({ select: () => { __eingefuegt = zeilen; return Promise.resolve({ data: zeilen.map((z, i) => ({ ...z, id: 'neu' + i })), error: null }); } }) }) };
   var __eingefuegt = [];`,
  context,
);
vm.runInContext("prompt = frage => (/von/i.test(frage) ? '09:00' : '09:30');", context);
leeren();
wert('addWorkBreak("2026-09-01");');
const eingefuegt = [...vm.runInContext('__eingefuegt', context)];
assert.strictEqual(eingefuegt.length, 2, 'Pausenbeginn und Pausenende zusammen');
assert.deepStrictEqual(
  eingefuegt.map(z => z.kind),
  ['break_start', 'break_end'],
);
assert.strictEqual(meldungen().length, 0, 'keine Fehlermeldung im guten Fall');

// ---------------------------------------------------------------------------
// Die Ausweg-Knoepfe stehen auch da
// ---------------------------------------------------------------------------
const heuteTag2 = () => vm.runInContext('workDayKey()', context);
const stempelHeute = (kind, minutenZurueck, id = kind) => ({
  id,
  work_date: heuteTag2(),
  kind,
  stamped_at: new Date(Date.now() - minutenZurueck * 60000).toISOString(),
});

setzeEntries([]);
wert('renderWorkTime();');
assert.doesNotMatch(zeige(), /Pause nachtragen/, 'vor dem ersten Stempel gibt es nichts nachzutragen');

setzeEntries([stempelHeute('work_start', 180)]);
wert('renderWorkTime();');
assert.match(zeige(), /Pause nachtragen/, 'im laufenden Tag laesst sich eine Pause nachtragen');
assert.doesNotMatch(zeige(), /zurücknehmen/, 'aber es gibt keinen Feierabend zum Zuruecknehmen');
/* Der Feierabend geht ueber die Rueckfrage, nicht mehr direkt. */
assert.match(zeige(), /onclick="stampWorkEnd\(\)"/);
assert.doesNotMatch(zeige(), /onclick="stampWork\('work_end'\)"/);

setzeEntries([stempelHeute('work_start', 570), stempelHeute('work_end', 0)]);
wert('renderWorkTime();');
assert.match(zeige(), /Pause nachtragen/, 'auch im abgeschlossenen Tag — das war die Sackgasse');
assert.match(zeige(), /Feierabend zurücknehmen/, 'und der Feierabend laesst sich zuruecknehmen');
assert.match(styles, /\.work-fix-btn\b/);

console.log(
  'Stempeluhr: Zustaende, Pausen, Gleitzeitkonto, Nachtrag und Zuruecknehmen, Kalender ohne Erledigt: OK',
);
