/* v0.4: Funded-Tracking und Psychologie sind eingebaut.
   Die beiden Module bringen ihre eigenen Verhaltenstests mit (funded.test.js,
   psychology.test.js). Hier steht nur, was beim Einbau leicht wieder herausfaellt:
   die Verdrahtung, die Reihenfolgen und die vier behobenen Befunde. */

const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const serviceWorker = fs.readFileSync('sw.js', 'utf8');
const backup = fs.readFileSync('modules/backup.js', 'utf8');
const trading = fs.readFileSync('modules/trading.js', 'utf8');
const psychology = fs.readFileSync('modules/psychology.js', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260822_funded_accounts_v1.sql', 'utf8');

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------
for (const tabelle of ['funded_accounts', 'funded_phases', 'funded_payouts']) {
  assert.match(migration, new RegExp(`create table if not exists public\\.${tabelle}`, 'i'));
}
assert.match(migration, /add column if not exists funded_account_id uuid/i);
assert.match(migration, /add column if not exists funded_phase_id uuid/i);
assert.match(migration, /pg_notify\(\s*'pgrst',\s*'reload schema'\s*\)/i);
assert.strictEqual(
  (migration.match(/enable row level security/gi) || []).length,
  3,
  'alle drei Tabellen brauchen RLS',
);

// ---------------------------------------------------------------------------
// index.html: Karten, Formularfeld, Skripte
// ---------------------------------------------------------------------------
assert.match(index, /id="fundedCard"/);
assert.match(index, /id="tradingPsychology"/);
assert.match(index, /id="tFundedPhase"/);
assert.match(index, /styles-funded\.css\?v=\d+/);
assert.match(index, /styles-psychology\.css\?v=\d+/);

// Beide Module lesen aus trading.js und stats.js -- sie muessen danach geladen werden.
const pos = muster => index.search(muster);
assert.ok(
  pos(/modules\/trading\.js/) < pos(/modules\/funded\.js/),
  'funded.js braucht deriveTradeResult und tradingSettings aus trading.js',
);
assert.ok(
  pos(/modules\/stats\.js/) < pos(/modules\/psychology\.js/),
  'psychology.js braucht die stats-Funktionen',
);

// Die Funded-Karte steht vor den Kennzahlen, die Psychologie dahinter.
assert.ok(
  pos(/id="fundedCard"/) < pos(/id="tradingStats"/),
  'die Funded-Karte gehoert vor die Kennzahlen -- sie wird vor dem Trade gebraucht',
);
assert.ok(
  pos(/id="tradingStats"/) < pos(/id="tradingPsychology"/),
  'die Psychologie steht unter den Kennzahlen',
);

// ---------------------------------------------------------------------------
// app.js und trading.js
// ---------------------------------------------------------------------------
assert.match(app, /loadFunded\(\)/);
assert.match(app, /renderFunded\(\)/);
assert.match(app, /typeof renderTradingPsychology === 'function'/);

assert.match(trading, /fundedTradeOptionsHtml\(\)/, 'Konto-Auswahl beim Anlegen');
assert.match(
  trading,
  /fundedTradeOptionsHtml\(trade\.funded_phase_id\)/,
  'beim Bearbeiten wird die gespeicherte Phase vorgewaehlt',
);
assert.match(
  trading,
  /\.\.\.\(typeof fundedTradePayload === 'function' \? fundedTradePayload\(\) : \{\}\)/,
  'die Zuordnung landet im Datensatz -- und faellt ohne Migration still weg',
);

// ---------------------------------------------------------------------------
// backup.js: neue Tabellen und die Reihenfolge beim Wiederherstellen
// ---------------------------------------------------------------------------
for (const tabelle of ['funded_accounts', 'funded_phases', 'funded_payouts']) {
  assert.match(backup, new RegExp(`\\{\\s*name:\\s*'${tabelle}'\\s*\\}`), `${tabelle} im Export`);
}
const restore = backup.slice(
  backup.indexOf('const CPRB_RESTORE_ORDER'),
  backup.indexOf('const CPRB_EXPORT_MODULES'),
);
// trades hat jetzt Fremdschluessel auf funded_accounts und funded_phases --
// stehen die Eltern nicht davor, scheitert jeder Restore an der FK-Pruefung.
for (const eltern of ['funded_accounts', 'funded_phases']) {
  assert.ok(
    restore.indexOf(`'${eltern}'`) >= 0 && restore.indexOf(`'${eltern}'`) < restore.indexOf("'trades'"),
    `${eltern} muss beim Wiederherstellen vor trades kommen`,
  );
}

// ---------------------------------------------------------------------------
// Behobene Befunde
// ---------------------------------------------------------------------------
// 1+2: Cockpit-Kacheln
assert.match(
  trading,
  /reviewedTrades\.length \? `\$\{errorCost\.toFixed\(2\)\}R` : '–'/,
  'Fehlerkosten zeigen ohne bewertete Trades einen Strich, keine 0.00R',
);
assert.match(trading, /const COCKPIT_MIN_TOP_BREAK = \d+;/);
assert.match(trading, /topBreak\[1\] >= COCKPIT_MIN_TOP_BREAK/);

// 3: die Leseliste benennt keine Regel mehr, wenn mehrere gleichauf liegen
assert.match(
  psychology,
  /daten\.regeln\.spitze && daten\.regeln\.spitze\.eindeutig \? daten\.regeln\.spitze : null/,
);

// 4: ohne Migration keine Zahl-Plakette vor dem Erklaersatz.
//    Ueber die echte Render-Funktion statt ueber ein selbstgebautes Datenobjekt --
//    sonst prueft der Test eine Attrappe und nicht den Code.
const knoten = new Map();
const psyContext = vm.createContext({
  console,
  Intl,
  $: selector => {
    if (!knoten.has(selector)) knoten.set(selector, { innerHTML: '', textContent: '' });
    return knoten.get(selector);
  },
  escapeHtml: value => String(value ?? ''),
  deriveTradeResult: pnl => (Number(pnl) > 0 ? 'win' : Number(pnl) < 0 ? 'loss' : 'breakeven'),
  hasTradeChecklist: trade =>
    Boolean(trade?.pre_trade_checklist && Object.keys(trade.pre_trade_checklist).length),
  tradingCockpitReady: false,
  trades: [],
});
vm.runInContext(trading.match(/const\s+TRADE_CHECKS\s*=\s*\[[\s\S]*?\];/)[0], psyContext);
vm.runInContext(fs.readFileSync('modules/stats.js', 'utf8'), psyContext);
vm.runInContext(psychology, psyContext);

const stichtag = new Date(2026, 7, 23);
psyContext.stichtag = stichtag;
vm.runInContext('renderTradingPsychology(stichtag)', psyContext);
const ohneSchema = knoten.get('#tradingPsychology').innerHTML;
assert.ok(ohneSchema.includes('psy-warn'), 'ohne Migration nennt die Karte den Grund');
assert.ok(!ohneSchema.includes('psy-basis'), 'und zeigt keine Zaehl-Plakette davor');

// Mit Schema steht die Plakette wieder da.
vm.runInContext('tradingCockpitReady = true; renderTradingPsychology(stichtag)', psyContext);
const mitSchema = knoten.get('#tradingPsychology').innerHTML;
assert.ok(mitSchema.includes('psy-basis'), 'mit Migration zeigt der Kopf die Grundlage');
assert.ok(!mitSchema.includes('psy-warn'));

// ---------------------------------------------------------------------------
// Asset-Versionen laufen nicht auseinander
// ---------------------------------------------------------------------------
const swModul = name =>
  (serviceWorker.match(new RegExp(`\\./modules/${name}\\.js\\?v=(\\d+)`)) || [])[1];
const htmlModul = name => (index.match(new RegExp(`modules/${name}\\.js\\?v=(\\d+)`)) || [])[1];
for (const name of ['funded', 'psychology', 'trading', 'stats']) {
  assert.strictEqual(swModul(name), htmlModul(name), `${name}.js: Version laeuft auseinander`);
}
for (const datei of ['styles-funded', 'styles-psychology']) {
  const imSw = (serviceWorker.match(new RegExp(`${datei}\\.css\\?v=(\\d+)`)) || [])[1];
  const imHtml = (index.match(new RegExp(`${datei}\\.css\\?v=(\\d+)`)) || [])[1];
  assert.ok(imSw, `${datei}.css fehlt im Service Worker`);
  assert.strictEqual(imSw, imHtml, `${datei}.css: Version laeuft auseinander`);
}

console.log('v0.4 eingebaut: Karten, Verdrahtung, Restore-Reihenfolge und vier Befunde: OK');
