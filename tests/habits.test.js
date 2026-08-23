/* Gewohnheiten: die Serien-Rechnung ist der Kern des Moduls.
   Sie muss über Monats-, Jahres- und Sommerzeitgrenzen stimmen — genau dort
   scheitert Datumsrechnung über Millisekunden. */

const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const quelle = fs.readFileSync('modules/habits.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const backup = fs.readFileSync('modules/backup.js', 'utf8');
const styles = fs.readFileSync('styles.css', 'utf8');
const serviceWorker = fs.readFileSync('sw.js', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260823_habits_v1.sql', 'utf8');

const context = vm.createContext({ console, $: () => null, escapeHtml: v => String(v ?? '') });
vm.runInContext(quelle, context);
const wert = ausdruck => vm.runInContext(ausdruck, context);

// ---------------------------------------------------------------------------
// Datumsrechnung
// ---------------------------------------------------------------------------
assert.strictEqual(context.habitDateKey(new Date(2026, 7, 23)), '2026-08-23');
assert.strictEqual(context.habitDayBefore('2026-08-23'), '2026-08-22');
assert.strictEqual(context.habitDayBefore('2026-08-01'), '2026-07-31', 'über den Monatswechsel');
assert.strictEqual(context.habitDayBefore('2026-01-01'), '2025-12-31', 'über den Jahreswechsel');
assert.strictEqual(context.habitDayBefore('2028-03-01'), '2028-02-29', 'Schaltjahr');
assert.strictEqual(context.habitDayBefore('2026-08-23', 7), '2026-08-16');
// Sommerzeit-Ende in Europa 2026: Nacht auf den 25. Oktober, ein Tag hat 25 Stunden.
assert.strictEqual(
  context.habitDayBefore('2026-10-26'),
  '2026-10-25',
  'Tageswechsel überlebt die Zeitumstellung',
);
assert.strictEqual(context.habitDayBefore('2026-10-25'), '2026-10-24');
// Zeitstempel statt reinem Datum darf nichts kaputt machen.
assert.strictEqual(context.habitDayBefore('2026-08-23T00:00:00+00:00'), '2026-08-22');

// ---------------------------------------------------------------------------
// Serie
// ---------------------------------------------------------------------------
const eintraege = tage => tage.map((day, i) => ({ id: `e${i}`, habit_id: 'h1', day }));
const heute = '2026-08-23';

assert.strictEqual(context.habitStreak('h1', heute, []), 0, 'ohne Einträge keine Serie');

// Heute abgehakt plus die zwei Tage davor.
assert.strictEqual(
  context.habitStreak('h1', heute, eintraege(['2026-08-23', '2026-08-22', '2026-08-21'])),
  3,
);

/* Heute noch offen, gestern und vorgestern erledigt: die Serie steht bei 2 und
   ist NICHT gebrochen — der Tag läuft ja noch. */
assert.strictEqual(
  context.habitStreak('h1', heute, eintraege(['2026-08-22', '2026-08-21'])),
  2,
  'ein offener heutiger Tag bricht die Serie nicht',
);

// Vorgestern die letzte: die Serie ist durch.
assert.strictEqual(
  context.habitStreak('h1', heute, eintraege(['2026-08-21', '2026-08-20'])),
  0,
  'ein ausgelassener Tag bricht die Serie',
);

// Über die Monatsgrenze.
assert.strictEqual(
  context.habitStreak('h1', '2026-09-02', eintraege(['2026-09-02', '2026-09-01', '2026-08-31'])),
  3,
);

// Einträge fremder Gewohnheiten zählen nicht mit.
assert.strictEqual(
  context.habitStreak('h1', heute, [
    { habit_id: 'h1', day: '2026-08-23' },
    { habit_id: 'h2', day: '2026-08-22' },
  ]),
  1,
);

// ---------------------------------------------------------------------------
// Beste Serie und Quote
// ---------------------------------------------------------------------------
const verlauf = eintraege([
  '2026-08-23',
  '2026-08-22', // laufende Serie: 2
  '2026-08-19',
  '2026-08-18',
  '2026-08-17',
  '2026-08-16', // beste Serie: 4
]);
assert.strictEqual(context.habitStreak('h1', heute, verlauf), 2);
assert.strictEqual(context.habitBestStreak('h1', verlauf), 4);

const quote = context.habitRate('h1', heute, 30, verlauf);
assert.strictEqual(quote.treffer, 6);
assert.strictEqual(quote.tage, 30);

// Nur was ins Fenster fällt, zählt.
assert.strictEqual(context.habitRate('h1', heute, 3, verlauf).treffer, 2, '3-Tage-Fenster');

// ---------------------------------------------------------------------------
// Band
// ---------------------------------------------------------------------------
const band = context.habitBand('h1', heute, verlauf);
assert.strictEqual(band.length, 14);
assert.strictEqual(band[13].tag, heute, 'der letzte Balken ist heute');
assert.strictEqual(band[13].erledigt, true);
assert.strictEqual(band[0].tag, '2026-08-10', 'der erste liegt 13 Tage zurück');
assert.strictEqual(band.filter(tag => tag.erledigt).length, 6);

// ---------------------------------------------------------------------------
// Fehlende Tabelle wird erkannt, nicht durchgereicht
// ---------------------------------------------------------------------------
assert.strictEqual(context.isMissingHabitsTable({ code: '42P01' }), true);
assert.strictEqual(context.isMissingHabitsTable({ code: 'PGRST205' }), true);
assert.strictEqual(
  context.isMissingHabitsTable({ message: "Could not find the table 'public.habits'" }),
  true,
);
assert.strictEqual(context.isMissingHabitsTable({ message: 'network error' }), false);

assert.strictEqual(context.habitStreakText(0), 'noch keine Serie');
assert.strictEqual(context.habitStreakText(1), '1 Tag am Stück');
assert.strictEqual(context.habitStreakText(5), '5 Tage am Stück');

assert.strictEqual(wert('HABIT_BAND_TAGE'), 14);
assert.strictEqual(wert('HABIT_VERLAUF_TAGE'), 30);

// ---------------------------------------------------------------------------
// Verdrahtung
// ---------------------------------------------------------------------------
assert.match(index, /id="habitCard"/);
assert.match(index, /id="habitList"/);
assert.match(index, /id="habitInput"/);
assert.match(index, /modules\/habits\.js\?v=\d+/);
// Die Karte gehört zu den Aufgaben, nicht ans Seitenende.
assert.ok(
  index.indexOf('id="homeTaskList"') < index.indexOf('id="habitCard"') &&
    index.indexOf('id="habitCard"') < index.indexOf('id="todayNextSection"'),
  'die Gewohnheiten stehen zwischen Aufgabenliste und Terminen',
);
assert.match(app, /loadHabits\(\)/);
assert.match(app, /renderHabits\(\)/);

// habit_entries hängt per Fremdschlüssel an habits — Eltern zuerst.
assert.match(backup, /\{\s*name:\s*'habits'\s*\}/);
assert.match(backup, /\{\s*name:\s*'habit_entries'\s*\}/);
const restore = backup.slice(
  backup.indexOf('const CPRB_RESTORE_ORDER'),
  backup.indexOf('const CPRB_EXPORT_MODULES'),
);
assert.ok(
  restore.indexOf("'habits'") < restore.indexOf("'habit_entries'"),
  'habits muss beim Wiederherstellen vor habit_entries kommen',
);

assert.match(styles, /\.habit-item\b/);
assert.match(styles, /\.habit-check\b/);
assert.match(styles, /\.habit-band\b/);

assert.strictEqual(
  (serviceWorker.match(/\.\/modules\/habits\.js\?v=(\d+)/) || [])[1],
  (index.match(/modules\/habits\.js\?v=(\d+)/) || [])[1],
  'habits.js: Version in sw.js und index.html laeuft auseinander',
);
assert.strictEqual(
  (serviceWorker.match(/styles\.css\?v=(\d+)/) || [])[1],
  (index.match(/styles\.css\?v=(\d+)/) || [])[1],
  'styles.css: Version laeuft auseinander',
);

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------
assert.match(migration, /create table if not exists public\.habits/i);
assert.match(migration, /create table if not exists public\.habit_entries/i);
// Ein Tag, eine Gewohnheit, höchstens ein Eintrag — sonst zählt die Serie doppelt.
assert.match(migration, /unique \(habit_id, day\)/i);
assert.match(migration, /habit_id uuid not null references public\.habits\(id\) on delete cascade/i);
assert.strictEqual(
  (migration.match(/enable row level security/gi) || []).length,
  2,
  'beide Tabellen brauchen RLS',
);
assert.match(migration, /pg_notify\(\s*'pgrst',\s*'reload schema'\s*\)/i);

console.log('Gewohnheiten: Serie über Monats-, Jahres- und Zeitumstellungsgrenzen, Quote, Band: OK');
