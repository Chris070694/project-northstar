const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const elements = new Map();
function element(selector) {
  if (!elements.has(selector)) elements.set(selector, { innerHTML: '', textContent: '' });
  return elements.get(selector);
}

const context = vm.createContext({
  console,
  Intl,
  $: element,
  escapeHtml(value) {
    return String(value ?? '').replace(
      /[&<>"']/g,
      ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[ch],
    );
  },
  deriveTradeResult(pnl) {
    const value = Number(pnl) || 0;
    return value > 0 ? 'win' : value < 0 ? 'loss' : 'breakeven';
  },
  hasTradeChecklist(trade) {
    return Boolean(trade?.pre_trade_checklist && Object.keys(trade.pre_trade_checklist).length);
  },
  tradingCockpitReady: true,
  trades: [],
});

/* TRADE_CHECKS kommt aus dem echten trading.js, damit die Labels im Test nicht
   auseinanderlaufen. Der Regex toleriert Umformatierung. */
const tradingSource = fs.readFileSync(path.join(root, 'modules/trading.js'), 'utf8');
const checksSource = tradingSource.match(/const\s+TRADE_CHECKS\s*=\s*\[[\s\S]*?\];/);
assert.ok(checksSource, 'TRADE_CHECKS in modules/trading.js gefunden');
vm.runInContext(checksSource[0], context);
vm.runInContext(fs.readFileSync(path.join(root, 'modules/stats.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'modules/psychology.js'), 'utf8'), context);
const run = code => vm.runInContext(code, context);
/* Objekte aus dem vm-Context haben eigene Prototypen — für Vergleiche über JSON holen. */
const werte = code => JSON.parse(vm.runInContext(`JSON.stringify(${code})`, context));
const LABELS = run('TRADE_CHECKS.map(item => item.label)');

/* Fester Stichtag: der Test darf nicht von der Uhrzeit seines Laufs abhängen. */
context.stichtag = new Date(2026, 7, 22);
const render = () => {
  run('renderTradingPsychology(stichtag)');
  return element('#tradingPsychology').innerHTML;
};
const sauber = (html, wo) =>
  assert.doesNotMatch(html, /NaN|undefined|Infinity/, `keine kaputten Werte: ${wo}`);

/* ---------------------------------------------------------------- Werkzeug */

let seq = 0;
function mkTrade(over = {}) {
  seq++;
  return {
    id: `t${seq}`,
    trade_date: `2026-03-${String((seq % 28) + 1).padStart(2, '0')}`,
    market: 'NQ',
    pnl_usd: 0,
    r_multiple: 0,
    emotion: 'Ruhig',
    emotion_after: 'Ruhig',
    execution_score: 7,
    followed_plan: false,
    rule_breaks: [],
    pre_trade_checklist: { scenario: true },
    mistakes: '',
    learning: '',
    ...over,
  };
}
const gewinn = over => mkTrade({ pnl_usd: 100, r_multiple: 1, ...over });
const verlust = over => mkTrade({ pnl_usd: -100, r_multiple: -1, ...over });
const viele = (n, bauen) => Array.from({ length: n }, (unused, index) => bauen(index));

/* -------------------------------------------------- 1. Reine Rechenfunktionen */

/* Wilson bei 3 von 3: die naive Quote sagt 100 %, ehrlich sind 44–100 %.
   center = 4.9208/6.8416 = 0.71925 · spread = (1.96/6.8416)·0.98 = 0.28075 */
const w33 = run('psyWilson(3, 3)');
assert.equal(Math.round(w33.rate * 100), 100);
assert.equal(Math.round(w33.low * 100), 44, 'untere Grenze bei 3 von 3');
assert.equal(Math.round(w33.high * 100), 100);
assert.equal(run('psyWilson(0, 0)'), null, 'ohne Trades kein Intervall, kein NaN');
assert.equal(run('psyWilson(5, 0)'), null);
const w50 = run('psyWilson(6, 12)');
assert.equal(Math.round(w50.low * 100), 25, 'bei 6 von 12 reicht das Intervall von 25 %');
assert.equal(Math.round(w50.high * 100), 75, '… bis 75 %');

/* psyMeanR: sum ist immer gültig, se erst ab zwei Werten.
   Werte 2 und -2: mean 0, sd = sqrt(8) = 2.828, se = sd/sqrt(2) = 2 */
context.probe = [
  { pnl_usd: 200, r_multiple: 2 },
  { pnl_usd: -200, r_multiple: -2 },
];
assert.deepEqual(
  werte('[psyMeanR(probe).n, psyMeanR(probe).sum, psyMeanR(probe).mean]'),
  [2, 0, 0],
);
assert.equal(run('psyMeanR(probe).se'), 2, 'sd = sqrt(8), se = sd/sqrt(2)');
context.probe = [{ pnl_usd: 100, r_multiple: 1 }];
assert.equal(run('psyMeanR(probe).se'), null, 'ein einziger Wert hat keinen Standardfehler');
assert.equal(run('psyMeanR(probe).mean'), 1);
assert.deepEqual(werte('[psyMeanR([]).n, psyMeanR([]).sum, psyMeanR([]).mean, psyMeanR([]).se]'), [
  0,
  0,
  null,
  null,
]);

/* r_multiple = 0 bei einem Ergebnis ungleich null heißt: Risiko war 0, R ist unbekannt. */
assert.equal(run('psyHasR({pnl_usd: -100, r_multiple: 0})'), false, 'R unbekannt, nicht null');
assert.equal(run('psyHasR({pnl_usd: 0, r_multiple: 0})'), true, 'Break-even hat echte 0R');
assert.equal(run('psyHasR({pnl_usd: -100, r_multiple: -1})'), true);
assert.equal(run('psyHasR({pnl_usd: -100})'), false, 'fehlende Spalte zählt nicht als 0R');
context.probe = [
  { pnl_usd: -100, r_multiple: -1 },
  { pnl_usd: -100, r_multiple: 0 },
];
assert.deepEqual(
  werte('[psyMeanR(probe).n, psyMeanR(probe).sum]'),
  [1, -1],
  'die unbekannte 0 verdünnt die Kosten nicht',
);

/* Spearman mit Durchschnittsrängen. */
assert.equal(run('psySpearman([[1,1],[2,2],[3,3]]).rho'), 1);
assert.equal(run('psySpearman([[1,3],[2,2],[3,1]]).rho'), -1);
assert.equal(run('psySpearman([[7,1],[7,2],[7,3]])'), null, 'gleiche Scores: kein rho, kein NaN');
assert.equal(run('psySpearman([[1,1]])'), null, 'ein Paar ergibt keinen Zusammenhang');
/* Bindungen: Ränge x = 1.5,1.5,3.5,3.5 · y = 1,2,3,4 → cov 4, vx 4, vy 5 → 4/sqrt(20) */
assert.equal(run('psySpearman([[1,1],[1,2],[2,3],[2,4]]).rho.toFixed(4)'), '0.8944');

/* ------------------------------------------- 2. Datensatz A mit Sollwerten */

/* 50 Cockpit-Trades, 3 Altbestand ohne Checkliste, 1 offener.
   Ruhig 24 (14 Gewinne) · Unruhig 26 (8 Gewinne)
   Nach Plan 22 (14 Gewinne) · ohne Plan 28 (8 Gewinne) */
seq = 0;
const datenA = [
  ...viele(14, index =>
    gewinn({
      emotion: 'Ruhig',
      followed_plan: true,
      emotion_after: index === 0 ? '' : index < 4 ? 'Gierig' : 'Ruhig',
      learning: index < 5 ? 'Geduld hat sich gelohnt' : '',
    }),
  ),
  ...viele(8, () => verlust({ emotion: 'Ruhig', followed_plan: true, emotion_after: 'Ruhig' })),
  ...viele(2, () =>
    verlust({ emotion: 'Ruhig', followed_plan: false, emotion_after: 'Frustriert' }),
  ),
  ...viele(8, index =>
    gewinn({
      emotion: 'FOMO',
      followed_plan: false,
      emotion_after: index < 2 ? 'Gierig' : 'Ruhig',
    }),
  ),
  ...viele(18, index =>
    verlust({
      emotion: 'Gierig',
      followed_plan: false,
      emotion_after: index < 12 ? 'Frustriert' : 'Erleichtert',
      mistakes: index === 0 ? '<b>zu früh rein</b>' : '',
    }),
  ),
  ...viele(3, () => gewinn({ pre_trade_checklist: null })),
  mkTrade({ result: 'open' }),
];
context.trades = datenA;
const a = run('psyAuswertung(trades, stichtag)');

assert.equal(a.closed.length, 53, 'der offene Trade zählt nicht mit');
assert.equal(a.cockpit.length, 50, 'nur Trades mit Checkliste');
assert.equal(a.altbestand, 3, 'Altbestand wird gezählt, nicht verschwiegen');
assert.equal(a.offen, 1);
assert.equal(a.aufbau, false);

assert.deepEqual(
  [a.emotion.gruppen[0].n, a.emotion.gruppen[0].wins],
  [24, 14],
  'Ruhig: 14 von 24',
);
assert.deepEqual([a.emotion.gruppen[1].n, a.emotion.gruppen[1].wins], [26, 8], 'Unruhig: 8 von 26');
assert.equal(a.emotion.vorgabeVerdacht, false, '24 von 50 sind kein Vorgabewert-Verdacht');
assert.equal(
  a.emotion.richtung.klar,
  false,
  '58 % gegen 31 %: die Intervalle überlappen, also kein Richtungssatz',
);

assert.deepEqual([a.plan.gruppen[0].n, a.plan.gruppen[0].wins], [22, 14], 'nach Plan: 14 von 22');
assert.deepEqual([a.plan.gruppen[1].n, a.plan.gruppen[1].wins], [28, 8], 'ohne Plan: 8 von 28');
/* Preis des Abweichens = ΣR(ohne Plan) − n(ohne Plan) · ExpectancyR(mit Plan)
   = −12 − 28 · (6/22) = −19.636 */
assert.equal(a.plan.preis.toFixed(3), '-19.636');

/* Verluste: 8x Ruhig + 2x Frustriert + 12x Frustriert + 6x Erleichtert = 28,
   davon gefasst (Ruhig oder Erleichtert) 8 + 6 = 14. */
assert.deepEqual([a.danach.fassung.n, a.danach.fassung.k], [28, 14], 'Fassung: 14 von 28');
assert.deepEqual([a.danach.uebermut.n, a.danach.uebermut.k], [21, 5], 'Übermut: 5 von 21');
assert.equal(a.danach.ohneAngabe, 1, 'ein leerer emotion_after-Eintrag fällt heraus');

assert.equal(a.ausfuehrung.n, 50, '50 Paare aus Score und R');
assert.equal(a.ausfuehrung.spearman, null, 'alle Scores stehen auf 7 — kein Koeffizient');
assert.equal(a.doku.n, 53);
assert.deepEqual([a.doku.mistakes, a.doku.learning], [1, 5]);
assert.deepEqual([a.doku.verlusteN, a.doku.verlusteLearning], [28, 0]);

const htmlA = render();
sauber(htmlA, 'Datensatz A');
assert.match(htmlA, /14 von 24 gewonnen|58 %/, 'die Ruhig-Gruppe steht mit ihrer Zahl da');
assert.match(htmlA, /überlappen/, 'ohne getrennte Intervalle kein Richtungssatz');
assert.match(htmlA, /-19\.64R/, 'Preis des Abweichens');
assert.match(htmlA, /steht nirgends in den Daten/, 'die Annahme steht neben der Zahl');
assert.match(htmlA, /3 ältere Trades ohne Checkliste/, 'Altbestand sichtbar genannt');
assert.match(htmlA, /1 offener Trade/, 'offene Trades ebenfalls');
assert.match(htmlA, /Alle Ausführungsnoten sind gleich/, 'kein rho aus lauter Siebenern');
assert.match(htmlA, /Stand 22\.08\.2026/, 'fester Stichtag statt Uhrzeit des Testlaufs');
assert.match(htmlA, /1 von 53 Trades/, 'Dokumentationsdisziplin nennt ihre Grundmenge');
assert.doesNotMatch(htmlA, /&quot;/, 'deutsche Anführungszeichen, keine escapten Zollzeichen');

/* ------------------------------------- 3. Datensatz B: getrennte Intervalle */

/* Ruhig 20 (17 Gewinne, Score 9) gegen FOMO 20 (4 Gewinne, Score 5). */
seq = 0;
const datenB = [
  ...viele(17, () => gewinn({ emotion: 'Ruhig', followed_plan: true, execution_score: 9 })),
  ...viele(3, () => verlust({ emotion: 'Ruhig', followed_plan: true, execution_score: 5 })),
  ...viele(4, () => gewinn({ emotion: 'FOMO', followed_plan: false, execution_score: 9 })),
  ...viele(16, () => verlust({ emotion: 'FOMO', followed_plan: false, execution_score: 5 })),
];
context.trades = datenB;
const b = run('psyAuswertung(trades, stichtag)');
assert.equal(b.emotion.richtung.klar, true, '85 % gegen 20 %: die Intervalle trennen sich');
assert.equal(b.plan.richtung.klar, true);
/* Preis = −12 − 20 · 0.7 = −26 */
assert.equal(b.plan.preis, -26);
/* Score 9 bei Gewinnern, 5 bei Verlierern: perfekte Rangfolge trotz Bindungen. */
assert.equal(b.ausfuehrung.spearman.rho, 1);
assert.equal(b.ausfuehrung.spearman.n, 40);
assert.equal(b.ausfuehrung.baender[0].r.n, 0, 'Band 1–4 ist leer');
assert.equal(b.ausfuehrung.baender[1].r.n, 19, 'Band 5–7');
assert.equal(b.ausfuehrung.baender[2].r.n, 21, 'Band 8–10');
const htmlB = render();
sauber(htmlB, 'Datensatz B');
assert.match(htmlB, /liegt vorn/, 'jetzt gibt es einen Richtungssatz');
assert.match(htmlB, /keine Ursache/, 'und den Vorbehalt gleich dazu');
assert.match(htmlB, /rho = 1\.00 über 40 Trades/);
assert.match(htmlB, /0 Trades mit R/, 'das leere Band sagt, dass es leer ist');
assert.doesNotMatch(htmlB, /–<|>–</, 'kein nacktes Zeichen als Wert');

/* ---------------------------- 4. Datensatz C: Regelbrüche und Widersprüche */

const sweep = LABELS[2];
const news = LABELS[5];
seq = 0;
const datenC = [
  ...viele(4, () =>
    verlust({ rule_breaks: [sweep], mistakes: '<b>Sweep verpasst</b>', learning: 'warten' }),
  ),
  ...viele(2, () => mkTrade({ pnl_usd: -50, r_multiple: -0.5, rule_breaks: [sweep] })),
  ...viele(2, () => mkTrade({ pnl_usd: -150, r_multiple: -1.5, rule_breaks: [sweep] })),
  ...viele(8, () => mkTrade({ pnl_usd: 50, r_multiple: 0.5, rule_breaks: [news] })),
  verlust({ rule_breaks: [sweep, news, LABELS[0]] }),
  verlust({ rule_breaks: ['Regel aus einer alten Formulierung'] }),
  /* Risiko war 0: R unbekannt, fällt aus jeder R-Rechnung heraus. */
  mkTrade({ pnl_usd: -100, r_multiple: 0, rule_breaks: [sweep] }),
  gewinn({ followed_plan: true, rule_breaks: [sweep, news], market: 'NQ<x>' }),
  gewinn({ emotion: 'FOMO', pre_trade_checklist: { emotion: true } }),
];
context.trades = datenC;
const c = run('psyAuswertung(trades, stichtag)');

assert.equal(c.cockpit.length, 21);
assert.equal(c.regeln.n, 20, 'ein Trade ohne verwertbares R fällt heraus');
assert.equal(c.regeln.ohneR, 1);
assert.equal(c.ohneR, 1, 'und wird sichtbar gezählt');

const zeile = label => c.regeln.zeilen.find(item => item.label === label);
assert.equal(zeile(sweep).vorkommen, 10, 'Sweep: 8 isoliert + 1 Dreifachbruch + 1 Doppelbruch');
assert.equal(zeile(sweep).isoliert.length, 8, 'nur die isolierten Fälle sind zurechenbar');
assert.equal(zeile(sweep).summeR, -8);
assert.equal(zeile(sweep).isoliertR.mean, -1);
/* sd² = 1/7 → se = sqrt(1/7/8) = 0.1336 */
assert.equal(zeile(sweep).isoliertR.se.toFixed(4), '0.1336');
assert.equal(zeile(news).isoliert.length, 8);
assert.equal(zeile(news).isoliertR.mean, 0.5);
assert.equal(zeile(LABELS[0]).isoliert.length, 0, 'aus einem Dreifachbruch folgt keine Zurechnung');
const alt = zeile('Ältere Regelformulierung');
assert.ok(alt, 'unbekannte Label verschwinden nicht, sie bekommen einen eigenen Topf');
assert.equal(alt.vorkommen, 1);

assert.equal(c.regeln.spitze.zeile.label, sweep, 'teuerste Regel nach Ø R isoliert');
assert.equal(c.regeln.spitze.eindeutig, true, 'Abstand 1.5R ist größer als die Standardfehler');
/* Vergleich: die übrigen 12 Trades mit R ergeben +4R → +0.33R */
assert.equal(c.regeln.rest.n, 12);
assert.equal(c.regeln.rest.mean.toFixed(2), '0.33');

assert.equal(c.widerspruch.planTrotzOffen.length, 1, 'Plan angehakt, Regeln offen');
assert.equal(c.widerspruch.ruhigBehauptet.length, 1, '„ruhig genug" bestätigt, Gefühl anders');
assert.equal(c.emotion.vorgabeVerdacht, true, '20 von 21 stehen auf dem Vorgabewert');

const htmlC = render();
sauber(htmlC, 'Datensatz C');
assert.match(htmlC, /Vorgabewert des Formulars/, 'der Vorgabewert-Vorbehalt steht in der Karte');
assert.match(htmlC, /Kein Richtungssatz, solange/, 'und verhindert den Richtungssatz');
assert.match(htmlC, /Ältere Regelformulierung/);
assert.match(htmlC, /als Einziges überspringst/, 'Platz 1 wird benannt');
assert.match(htmlC, /-1\.00R.*\+0\.33R/, 'mit Gegenzahl über alle anderen Trades');
assert.match(htmlC, /von 8 isolierten Fällen/, 'unter der Schwelle steht, was fehlt');
assert.match(htmlC, /NQ&lt;x&gt;/, 'Marktname escaped in der Trade-Liste');
assert.match(htmlC, /&lt;b&gt;Sweep verpasst/, 'Leseliste escaped');
assert.doesNotMatch(htmlC, /<b>Sweep/);

/* Mehrere gleichauf: kein Platz 1. */
seq = 0;
context.trades = [
  ...viele(8, () => verlust({ rule_breaks: [sweep] })),
  ...viele(8, () => verlust({ rule_breaks: [news] })),
];
const gleich = run('psyAuswertung(trades, stichtag)');
assert.equal(gleich.regeln.spitze.eindeutig, false, 'gleicher Ø: kein Platz 1');
assert.match(render(), /liegen gleichauf/);

/* --------------------------------------------------- 5. Dünne Datenlagen */

seq = 0;
context.trades = [];
let html = render();
sauber(html, 'ohne jeden Trade');
assert.match(html, /0 von 10 Cockpit-Trades/, 'Aufbaustand statt leerer Fläche');
assert.match(html, /Selbstwiderspruch/, 'A7 gilt ab dem ersten Trade');
assert.doesNotMatch(html, /Welcher Regelbruch/, 'vor der Mindestmenge keine Rangliste');

context.trades = [mkTrade({ result: 'open' }), mkTrade({ result: 'open' })];
html = render();
sauber(html, 'nur offene Trades');
assert.match(html, /0 von 10 Cockpit-Trades/);

seq = 0;
context.trades = viele(6, () => gewinn({ pre_trade_checklist: null }));
html = render();
sauber(html, 'nur Altbestand');
assert.match(html, /6 ältere Trades ohne Checkliste und 0 offene Trades zählen hier nicht mit/);

seq = 0;
context.trades = [gewinn(), verlust({ emotion: 'FOMO' })];
html = render();
sauber(html, 'zwei Trades');
assert.match(html, /2 von 10 Cockpit-Trades/);

/* Genau an der Modulschwelle: 10 Cockpit-Trades, alle Kacheln unter ihrer Mindestmenge. */
seq = 0;
context.trades = [
  ...viele(5, () => gewinn({ emotion_after: '', execution_score: null, r_multiple: 0 })),
  ...viele(5, () => verlust({ emotion: 'FOMO', execution_score: null, rule_breaks: [sweep] })),
];
html = render();
sauber(html, '10 Trades an der Schwelle');
assert.match(html, /Welcher Regelbruch/, 'ab 10 Cockpit-Trades rechnet die Karte');
assert.match(html, /ab 12 Trades kommt eine Quote dazu|ab 12 zeigt CPRB hier eine Quote/);
assert.match(html, /Keine Angabe zur Stimmung danach|0 Trades/, 'leere Stellen sagen, was fehlt');
assert.doesNotMatch(html, / % \(/, 'unter 12 Trades keine Prozentzahl');

/* Fehlende Cockpit-Migration: keine Zahlen, sondern der Grund. */
context.tradingCockpitReady = false;
html = render();
sauber(html, 'ohne Migration');
assert.match(html, /Trading-Cockpit-Migration/);
assert.doesNotMatch(html, /Selbstwiderspruch/, 'ohne Spalten wird nichts behauptet');
context.tradingCockpitReady = true;

/* Fehlende Felder insgesamt — nichts davon darf in die Oberfläche durchschlagen. */
context.trades = [
  { id: 'x1', trade_date: '2026-01-01', market: 'NQ', pnl_usd: 100, pre_trade_checklist: {} },
  { id: 'x2', trade_date: '2026-01-02', pnl_usd: -100, r_multiple: null, rule_breaks: null },
  { id: 'x3', trade_date: '2026-01-03', pnl_usd: 0 },
];
html = render();
sauber(html, 'Trades ohne die neuen Spalten');

console.log('Psychologie: Wilson, R-Filter, Spearman, Schwellen, Widersprüche und Ausgabe: OK');
