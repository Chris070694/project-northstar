/* Dashboard und Heute sind zu einer Startseite zusammengelegt.
   Dieser Test haelt fest, was dabei mitgewandert ist, was verschwunden ist,
   und dass kein Modul mehr auf ein Element schreibt, das es nicht mehr gibt. */

const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const index = fs.readFileSync('index.html', 'utf8');
const core = fs.readFileSync('modules/core.js', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const focus = fs.readFileSync('modules/focus.js', 'utf8');
const fitness = fs.readFileSync('modules/fitness.js', 'utf8');
const weekly = fs.readFileSync('modules/weekly.js', 'utf8');
const today = fs.readFileSync('modules/today.js', 'utf8');
const styles = fs.readFileSync('styles.css', 'utf8');
const serviceWorker = fs.readFileSync('sw.js', 'utf8');

// ---------------------------------------------------------------------------
// Die Dashboard-Seite existiert nicht mehr
// ---------------------------------------------------------------------------
assert.doesNotMatch(index, /<section id="home"/, 'die home-Seite ist aufgeloest');
assert.doesNotMatch(index, /data-page="home"/, 'kein Navigationseintrag zeigt noch auf home');

// Alte Links und gespeicherte ?page=home-Adressen laufen nicht ins Leere.
assert.match(core, /if\s*\(id\s*===\s*'home'\)\s*id\s*=\s*'today';/);

// ---------------------------------------------------------------------------
// Was vom Dashboard mitgewandert ist, sitzt jetzt auf der Startseite
// ---------------------------------------------------------------------------
const startseite = index.slice(
  index.indexOf('<section id="today"'),
  index.indexOf('<section id="trading"'),
);
assert.ok(startseite.length > 500, 'Startseite gefunden');

for (const id of [
  // Heute-Teil
  'todayGreeting',
  'todayDate',
  'todayAnchor',
  'todayNow',
  'todayNext',
  'todayNextSection',
  'todayMomentum',
  // vom Dashboard uebernommen
  'homeTaskList',
  'homeTaskProgress',
  'heroGoal',
  'pnl',
  'winrate',
  'profitFactor',
  'tradeCount',
  'homeGoals',
  'pwaNotice',
  'installBtn',
]) {
  assert.ok(startseite.includes(`id="${id}"`), `${id} fehlt auf der Startseite`);
}

// Die Aufgabenliste ist abhakbar — genau dafuer wurde sie uebernommen.
assert.match(focus, /onchange="toggleDailyTask\('\$\{task\.id\}',this\.checked\)/);

// Bewusst nicht uebernommen: Schnellaktionen, Weekly-Karte, Fitness-Kachel.
for (const weg of ['dashboard-action', 'homeWeeklyPrompt', 'homeFitnessOverview', 'mainFocus']) {
  assert.ok(!index.includes(weg), `${weg} sollte nicht mehr im HTML stehen`);
}

// ---------------------------------------------------------------------------
// Jeder Anker, den ein Modul im Dokument sucht, muss es auch geben
// ---------------------------------------------------------------------------
/* Diese Pruefung fehlte beim Zusammenlegen und hat einen echten Fehler
   durchgelassen: hydration.js haengte seine Trinkkarte an #homeFitnessOverview,
   die Fitness-Kachel des alten Dashboards. Ohne sie stieg die Funktion still aus
   und die Karte verschwand -- die Push-Erinnerungen kamen weiter, nur eintragen
   ging nicht mehr. Gesucht wurde damals nur nach $('#id'), nicht nach
   document.getElementById. */
const fs2 = require('fs');
const modulNamen = fs2.readdirSync('modules').filter(name => name.endsWith('.js'));
const alleQuellen = modulNamen.map(name => fs2.readFileSync(`modules/${name}`, 'utf8'));

/* Ein Anker ist in Ordnung, wenn er im HTML steht oder von einem Modul selbst
   erzeugt wird -- entweder ueber element.id = 'x' oder als id="x" in einer
   Vorlage, die das Modul in den Baum haengt. */
const kenntId = id =>
  index.includes(`id="${id}"`) ||
  alleQuellen.some(
    quelle =>
      new RegExp(`\\.id\\s*=\\s*'${id}'`).test(quelle) || quelle.includes(`id="${id}"`),
  );

const fehlendeAnker = [];
modulNamen.forEach((name, i) => {
  const treffer = alleQuellen[i].matchAll(/document\.getElementById\('([A-Za-z0-9_-]+)'\)/g);
  for (const [, id] of treffer) if (!kenntId(id)) fehlendeAnker.push(`${name} → #${id}`);
});
assert.deepStrictEqual(
  fehlendeAnker,
  [],
  `Module suchen Elemente, die es nicht gibt:\n  ${fehlendeAnker.join('\n  ')}`,
);

// Die Trinkkarte hat jetzt einen eigenen, benannten Platz.
assert.match(index, /id="hydrationSlot"/, 'Platz fuer die Trinkkarte auf der Startseite');
const hydration = fs2.readFileSync('modules/hydration.js', 'utf8');
assert.match(hydration, /getElementById\('hydrationSlot'\)/);

// ---------------------------------------------------------------------------
// Kein Modul schreibt hart auf ein entferntes Element
// ---------------------------------------------------------------------------
const entfernt = [
  'mainFocus',
  'nextFocus',
  'homeFitnessPlan',
  'homeFitnessStatus',
  'homeWeeklyPrompt',
  'greeting',
  'todayText',
];
for (const id of entfernt) {
  // Verboten ist der ungeschuetzte Zugriff: $('#id').irgendwas
  const hart = new RegExp(`\\$\\('#${id}'\\)\\.`);
  for (const [name, quelle] of [
    ['focus.js', focus],
    ['fitness.js', fitness],
    ['weekly.js', weekly],
    ['app.js', app],
    ['today.js', today],
  ]) {
    assert.doesNotMatch(quelle, hart, `${name} greift ungeschuetzt auf #${id} zu`);
  }
}

// ---------------------------------------------------------------------------
// Verhalten: der Termin-Abschnitt zeigt keine Aufgaben mehr
// ---------------------------------------------------------------------------
const nodes = new Map();
const node = selector => {
  if (!nodes.has(selector)) {
    const element = { textContent: '', innerHTML: '', className: '' };
    element.classList = {
      toggle(name, force) {
        const classes = new Set(String(element.className).split(/\s+/).filter(Boolean));
        const on = force === undefined ? !classes.has(name) : Boolean(force);
        if (on) classes.add(name);
        else classes.delete(name);
        element.className = [...classes].join(' ');
        return on;
      },
      contains(name) {
        return String(element.className).split(/\s+/).includes(name);
      },
    };
    nodes.set(selector, element);
  }
  return nodes.get(selector);
};

const context = vm.createContext({
  console,
  Intl,
  $: node,
  escapeHtml: value => String(value ?? ''),
  dailyTasks: [],
  calendarEvents: [],
  fitnessSessions: [],
  fitnessPlans: [],
  trades: [],
  activeFitnessSession: null,
});
vm.runInContext(today, context);

const heute = vm.runInContext('todayDateKey()', context);
vm.runInContext(
  `dailyTasks = [
     { id: 'a', title: 'Offene Aufgabe', category: 'Privat', is_completed: false, is_priority: false },
   ];
   calendarEvents = [{ event_date: '${heute}', title: 'Zahnarzt', start_time: '15:30:00' }];
   renderTodayNext();`,
  context,
);
assert.match(node('#todayNext').innerHTML, /Zahnarzt/, 'Termine erscheinen');
assert.doesNotMatch(
  node('#todayNext').innerHTML,
  /Offene Aufgabe/,
  'Aufgaben stehen in der abhakbaren Liste, nicht hier',
);

// ---------------------------------------------------------------------------
// Styles und Asset-Versionen
// ---------------------------------------------------------------------------
assert.match(styles, /\.today-tasks-card\b/);
assert.match(styles, /\.today-divider\b/);
assert.match(styles, /\.today-next-section\.hide\b/);

const swVersion = name =>
  (serviceWorker.match(new RegExp(`\\./modules/${name}\\.js\\?v=(\\d+)`)) || [])[1];
const htmlVersion = name => (index.match(new RegExp(`modules/${name}\\.js\\?v=(\\d+)`)) || [])[1];
for (const name of ['core', 'today', 'focus', 'fitness', 'weekly']) {
  assert.strictEqual(
    swVersion(name),
    htmlVersion(name),
    `${name}.js: Version in sw.js und index.html laeuft auseinander`,
  );
}
assert.strictEqual(
  (serviceWorker.match(/styles\.css\?v=(\d+)/) || [])[1],
  (index.match(/styles\.css\?v=(\d+)/) || [])[1],
  'styles.css: Version laeuft auseinander',
);

console.log('Startseite: Dashboard aufgeloest, Uebernahmen vollstaendig, keine toten Zugriffe: OK');
