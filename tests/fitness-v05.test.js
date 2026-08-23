const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const gymbag = fs.readFileSync('modules/gymbag.js', 'utf8');
const resttimer = fs.readFileSync('modules/resttimer.js', 'utf8');
const fitness = fs.readFileSync('modules/fitness.js', 'utf8');
const core = fs.readFileSync('modules/core.js', 'utf8');
const backup = fs.readFileSync('modules/backup.js', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const styles = fs.readFileSync('styles.css', 'utf8');
const serviceWorker = fs.readFileSync('sw.js', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260823_fitness_v05.sql', 'utf8');

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------
assert.match(migration, /create table if not exists public\.gym_bag_items/i);
assert.match(migration, /user_id uuid not null references auth\.users\(id\)/i);
assert.match(migration, /checked boolean not null default false/i);
assert.match(migration, /checked_on date/i);
assert.match(migration, /sort_order integer not null default 0/i);
assert.match(migration, /kind text not null default 'gym'/i);
assert.match(migration, /enable row level security/i);
assert.match(migration, /create policy "Users manage their own gym bag items"/i);
// Pausenzeit haengt additiv an den Planuebungen, nicht an einer neuen Tabelle.
assert.match(migration, /alter table public\.fitness_plan_exercises\s+add column if not exists rest_seconds integer/i);
assert.match(migration, /rest_seconds between 10 and 900/i);
assert.match(migration, /pg_notify\(\s*'pgrst',\s*'reload schema'\s*\)/i);

// ---------------------------------------------------------------------------
// Verhalten: Reset der Trainingstasche haengt am Datum, nicht an einem Cron-Job
// ---------------------------------------------------------------------------
// let/const bleiben im vm-Context lexikalisch und haengen nicht am globalen Objekt.
// Werte werden deshalb ausgewertet, Funktionen koennen direkt gegriffen werden.
const valueIn = (context, expression) => vm.runInContext(expression, context);

const bagContext = { console, localStorage: { getItem: () => null, setItem: () => {} } };
vm.createContext(bagContext);
vm.runInContext(gymbag, bagContext);

const today = bagContext.gymBagDateKey(new Date('2026-08-23T09:00:00'));
assert.strictEqual(today, '2026-08-23');

assert.strictEqual(bagContext.isGymBagItemChecked({ checked: true, checked_on: today }, today), true);
assert.strictEqual(
  bagContext.isGymBagItemChecked({ checked: true, checked_on: '2026-08-22' }, today),
  false,
  'gestern gesetzte Haken gelten heute nicht mehr',
);
assert.strictEqual(bagContext.isGymBagItemChecked({ checked: false, checked_on: today }, today), false);
// Supabase liefert date-Spalten teils als vollen Zeitstempel.
assert.strictEqual(
  bagContext.isGymBagItemChecked({ checked: true, checked_on: '2026-08-23T00:00:00+00:00' }, today),
  true,
);

const items = [
  { id: 'a', checked: true, checked_on: today },
  { id: 'b', checked: true, checked_on: '2026-08-22' },
  { id: 'c', checked: false, checked_on: null },
  { id: 'd', checked: true, checked_on: null },
];
assert.deepStrictEqual(
  bagContext.staleGymBagItemIds(items, today),
  ['b', 'd'],
  'nur veraltete Haken werden zurueckgesetzt',
);

const bagDefaults = valueIn(bagContext, 'GYM_BAG_DEFAULTS');
assert.ok(bagDefaults.includes('Trinkflasche'));
assert.ok(bagDefaults.includes('Handtuch'));
assert.ok(bagDefaults.length >= 6);

// ---------------------------------------------------------------------------
// Verhalten: Pausentimer rechnet gegen die Uhr, nicht gegen Sekundenzaehler
// ---------------------------------------------------------------------------
const listeners = {};
const timerContext = {
  console,
  window: {},
  navigator: {},
  localStorage: { getItem: () => null, setItem: () => {} },
  document: {
    hidden: false,
    addEventListener: (name, fn) => {
      listeners[name] = fn;
    },
  },
  setInterval: () => 1,
  clearInterval: () => {},
  setTimeout: () => 2,
  clearTimeout: () => {},
  $: () => null,
};
vm.createContext(timerContext);
vm.runInContext(resttimer, timerContext);

assert.strictEqual(valueIn(timerContext, 'REST_TIMER_DEFAULT_SECONDS'), 90);
assert.deepStrictEqual([...valueIn(timerContext, 'REST_TIMER_PRESETS')], [60, 90, 120, 180]);

assert.strictEqual(timerContext.clampRestSeconds(90), 90);
assert.strictEqual(timerContext.clampRestSeconds(0), 90, 'unbrauchbare Werte fallen auf 90s');
assert.strictEqual(timerContext.clampRestSeconds('abc'), 90);
assert.strictEqual(timerContext.clampRestSeconds(5), 10, 'untere Grenze');
assert.strictEqual(timerContext.clampRestSeconds(5000), 900, 'obere Grenze');

assert.strictEqual(timerContext.formatRestTime(90000), '1:30');
assert.strictEqual(timerContext.formatRestTime(9000), '0:09');
assert.strictEqual(timerContext.formatRestTime(0), '0:00');
assert.strictEqual(timerContext.formatRestTime(-500), '0:00', 'negative Restzeit blitzt nicht auf');
assert.strictEqual(timerContext.formatRestTime(600000), '10:00');

// Der Countdown haengt an einem Zielzeitpunkt. Ein gedrosselter Hintergrund-Tab
// darf die verbleibende Zeit deshalb nicht verfaelschen.
timerContext.startRestTimer(120, 'Bankdrücken', 'plan-ex-1');
const started = valueIn(timerContext, 'restTimerEndsAt');
assert.ok(started > 0);
assert.strictEqual(valueIn(timerContext, 'restTimerTotal'), 120);
assert.strictEqual(valueIn(timerContext, 'restTimerExerciseId'), 'plan-ex-1');
assert.ok(timerContext.isRestTimerRunning(started - 1000));
assert.ok(!timerContext.isRestTimerRunning(started + 1000), 'nach dem Zielzeitpunkt laeuft nichts mehr');
assert.strictEqual(timerContext.restTimerRemainingMs(started - 30000), 30000);
assert.strictEqual(
  timerContext.restTimerRemainingMs(started + 30000),
  0,
  'Restzeit wird bei 0 geklemmt statt negativ zu werden',
);

timerContext.adjustRestTimer(30);
assert.ok(valueIn(timerContext, 'restTimerEndsAt') > started, '+30 verlaengert die laufende Pause');

timerContext.stopRestTimer();
assert.strictEqual(valueIn(timerContext, 'restTimerEndsAt'), 0);
assert.strictEqual(timerContext.restTimerRemainingMs(), 0);
assert.ok(!timerContext.isRestTimerRunning());

assert.ok(listeners.visibilitychange, 'Rueckkehr in den Tab rechnet den Countdown nach');

// ---------------------------------------------------------------------------
// Verdrahtung
// ---------------------------------------------------------------------------
assert.match(fitness, /if\s*\(isCompleted\)\s*startRestTimerForSet\(set,\s*sessionExercise\)/);
assert.match(fitness, /else\s+stopRestTimer\(\)/);
assert.match(fitness, /rememberRestSeconds\('\$\{exercise\.plan_exercise_id\}'/);
assert.match(core, /id\s*===\s*'fitness'\s*&&\s*typeof\s+onFitnessPageOpen\s*===\s*'function'/);
assert.match(app, /loadGymBag\(\)/);
assert.match(app, /renderGymBag\(\)/);

assert.match(backup, /\{\s*name:\s*'gym_bag_items'\s*\}/);
assert.match(backup, /'fitness_set_logs',\s*'gym_bag_items',/);

assert.match(index, /id="gymBagCard"/);
assert.match(index, /id="gymBagList"/);
assert.match(index, /id="gymBagInput"/);
assert.match(index, /id="restTimer"/);
assert.match(index, /id="restTimerValue"/);
assert.match(index, /id="restTimerPresets"/);
assert.match(index, /modules\/gymbag\.js\?v=\d+/);
assert.match(index, /modules\/resttimer\.js\?v=\d+/);

assert.match(styles, /\.gym-bag-item\b/);
assert.match(styles, /\.rest-timer\b/);
assert.match(styles, /\.rest-preset\b/);

// Asset-Versionen muessen im Service Worker mitwandern, sonst liefert die
// installierte PWA die alten Dateien aus.
assert.match(serviceWorker, /^const CACHE\s*=\s*'cprb-[a-z0-9-]+';/m);
assert.match(serviceWorker, /'\.\/modules\/gymbag\.js\?v=\d+'/);
assert.match(serviceWorker, /'\.\/modules\/resttimer\.js\?v=\d+'/);

const swVersion = name => (serviceWorker.match(new RegExp(`\\./modules/${name}\\.js\\?v=(\\d+)`)) || [])[1];
const htmlVersion = name => (index.match(new RegExp(`modules/${name}\\.js\\?v=(\\d+)`)) || [])[1];
for (const name of ['fitness', 'core', 'backup', 'gymbag', 'resttimer']) {
  assert.strictEqual(
    swVersion(name),
    htmlVersion(name),
    `${name}.js: Version in sw.js und index.html laeuft auseinander`,
  );
}
const swStyles = (serviceWorker.match(/styles\.css\?v=(\d+)/) || [])[1];
const htmlStyles = (index.match(/styles\.css\?v=(\d+)/) || [])[1];
assert.strictEqual(swStyles, htmlStyles, 'styles.css: Version laeuft auseinander');

console.log('fitness v0.5 gym bag reset, rest timer clock math, wiring and asset versions: OK');
