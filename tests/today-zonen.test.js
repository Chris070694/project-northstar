/* Die Heute-Seite ist in drei Zonen geteilt: Jetzt, Heute, Überblick.
   Was hier geprüft wird, ist die Ordnung — sie ist der ganze Zweck des Umbaus
   und geht beim nächsten Einfügen einer Karte als Erstes verloren. */

const fs = require('fs');
const assert = require('assert');

const index = fs.readFileSync('index.html', 'utf8');
const today = fs.readFileSync('modules/today.js', 'utf8');
const styles = fs.readFileSync('styles.css', 'utf8');
const serviceWorker = fs.readFileSync('sw.js', 'utf8');

const seite = index.slice(
  index.indexOf('<section id="today"'),
  index.indexOf('<section id="trading"'),
);
const wo = suche => {
  const stelle = seite.indexOf(suche);
  assert.notStrictEqual(stelle, -1, `nicht gefunden: ${suche}`);
  return stelle;
};

// ---------------------------------------------------------------------------
// Zone 1 — Jetzt
// ---------------------------------------------------------------------------
assert.ok(wo('id="todayGreeting"') < wo('id="todayAnchor"'));
assert.ok(wo('id="todayAnchor"') < wo('id="todayNow"'));

// ---------------------------------------------------------------------------
// Zone 2 — Heute: alles zum Abhaken, in dieser Reihenfolge
// ---------------------------------------------------------------------------
assert.ok(wo('id="todayNow"') < wo('>Heute</div>'), 'der Zonentitel steht nach der Jetzt-Karte');

const abhaken = ['id="homeTaskList"', 'id="habitCard"', 'id="hydrationSlot"', 'id="todayNextSection"'];
abhaken.reduce((vorher, jetzt) => {
  assert.ok(wo(vorher) < wo(jetzt), `${jetzt} muss nach ${vorher} kommen`);
  return jetzt;
});

// Die Trinkkarte gehört zum Abhaken — nicht mehr hinter das Momentum.
assert.ok(
  wo('id="hydrationSlot"') < wo('id="todayOverview"'),
  'die Trinkkarte steht im Heute-Teil, nicht im Überblick',
);

// ---------------------------------------------------------------------------
// Zone 3 — Überblick: alles zum Anschauen, eingeklappt
// ---------------------------------------------------------------------------
assert.match(seite, /<details id="todayOverview"/, 'der Überblick ist ein details-Element');
assert.ok(
  !/<details id="todayOverview"[^>]*\bopen\b/.test(seite),
  'der Überblick ist standardmäßig zu',
);

const ueberblick = seite.slice(seite.indexOf('id="todayOverview"'));
for (const id of ['id="todayMomentum"', 'id="heroGoal"', 'id="pnl"', 'id="homeGoals"']) {
  assert.ok(ueberblick.includes(id), `${id} gehört in den Überblick`);
}
// Momentum ist Rückblick, kein Tageswerkzeug — es ist nach unten gewandert.
assert.ok(
  wo('id="todayNextSection"') < wo('id="todayMomentum"'),
  'das Momentum steht unter den Terminen, nicht darüber',
);

// ---------------------------------------------------------------------------
// Einheitliche Optik: keine nackten Abschnittslabels mehr auf der Seite
// ---------------------------------------------------------------------------
assert.ok(
  !seite.includes('today-section-label'),
  'freistehende Überschriften sind durch Kartenköpfe ersetzt',
);
for (const kopf of ['Termine heute', 'Momentum · 14 Tage', 'Trading Snapshot', 'Dein Weg']) {
  assert.ok(
    new RegExp(`today-card-head">\\s*${kopf.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(seite),
    `"${kopf}" sitzt in einem Kartenkopf`,
  );
}

// ---------------------------------------------------------------------------
// Der Zustand wird gemerkt — und ein blockierter Speicher bricht nichts
// ---------------------------------------------------------------------------
assert.match(today, /const TODAY_OVERVIEW_KEY = 'northstar-today-overview';/);
assert.match(today, /function restoreTodayOverview\(\)/);
assert.match(today, /addEventListener\('toggle'/);
assert.match(today, /renderToday[\s\S]*restoreTodayOverview\(\);/, 'wird beim Rendern aufgerufen');

/* localStorage wirft in privaten Fenstern und bei blockierten Website-Daten.
   Beide Zugriffe müssen abgesichert sein, sonst reißt es die ganze Seite. */
/* Auf "function renderToday() {" schneiden, nicht auf "function renderToday" --
   sonst trifft die Suche renderTodayAnchor weiter oben und der Ausschnitt ist leer. */
const wiederherstellen = today.slice(
  today.indexOf('function restoreTodayOverview'),
  today.indexOf('function renderToday() {'),
);
assert.ok(wiederherstellen.length > 100, 'Ausschnitt gefunden');
assert.strictEqual(
  (wiederherstellen.match(/try\s*\{/g) || []).length,
  2,
  'Lesen und Schreiben stehen beide in try/catch',
);

// Nur einmal anhängen, auch wenn renderToday mehrfach läuft.
assert.match(wiederherstellen, /dataset\.merkt/);

// ---------------------------------------------------------------------------
// Styles und Versionen
// ---------------------------------------------------------------------------
assert.match(styles, /\.today-zone\b/);
assert.match(styles, /\.today-card-head\b/);
assert.match(styles, /\.today-overview\b/);
assert.match(styles, /prefers-reduced-motion[\s\S]*today-overview/);

assert.strictEqual(
  (serviceWorker.match(/\.\/modules\/today\.js\?v=(\d+)/) || [])[1],
  (index.match(/modules\/today\.js\?v=(\d+)/) || [])[1],
  'today.js: Version laeuft auseinander',
);
assert.strictEqual(
  (serviceWorker.match(/styles\.css\?v=(\d+)/) || [])[1],
  (index.match(/styles\.css\?v=(\d+)/) || [])[1],
  'styles.css: Version laeuft auseinander',
);

console.log('Heute-Seite: drei Zonen, Reihenfolge, eingeklappter Überblick, gemerkter Zustand: OK');
