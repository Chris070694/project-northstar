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
assert.match(zeige(), /onclick="stampWork\('work_end'\)"/, 'der Feierabend steht klein daneben');
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

console.log(
  'Stempeluhr: Zustaende, laufende Pause, vergessenes Pausenende, Feierabend aus der Pause, Migration, Platz: OK',
);
