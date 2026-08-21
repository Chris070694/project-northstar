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
  trades: [],
});
vm.runInContext(fs.readFileSync(path.join(root, 'modules/stats.js'), 'utf8'), context);
const run = code => vm.runInContext(code, context);

/* Ein Datensatz mit bekannten Sollwerten:
   +200 / -100 / +300 / -50 / offen
   Netto 350 · Brutto+ 500 · Brutto- 150 · PF 3.33 · 2 von 4 gewonnen */
run(`trades=[
  {trade_date:'2026-08-01',pnl_usd:200,r_multiple:2,result:'win'},
  {trade_date:'2026-08-02',pnl_usd:-100,r_multiple:-1,result:'loss'},
  {trade_date:'2026-08-03',pnl_usd:300,r_multiple:3,result:'win'},
  {trade_date:'2026-08-04',pnl_usd:-50,r_multiple:-0.5,result:'loss'},
  {trade_date:'2026-08-05',pnl_usd:0,r_multiple:0,result:'open'}
];
statsRange='all';
const closed = statsClosedTrades();`);

assert.equal(run('closed.length'), 4, 'offene Trades zählen nicht mit');
assert.equal(run('statsNetPnl(closed)'), 350);
assert.equal(run('Math.round(statsProfitFactor(closed)*100)/100'), 3.33, '500 / 150');
assert.equal(run('statsWinRate(closed)'), 50);
assert.equal(run('statsExpectancyR(closed)'), 0.875, '3.5R auf vier Trades');
assert.equal(run('statsAvgWinR(closed)'), 2.5);
assert.equal(run('statsAvgLossR(closed)'), -0.75);

/* Kurve: 200 → 100 → 400 → 350. Höchststand 400, tiefster Abstand −100 (nach Trade 2). */
assert.equal(run('statsEquityCurve(closed).map(p=>p.value).join(",")'), '200,100,400,350');
assert.equal(run('statsMaxDrawdown(statsEquityCurve(closed))'), -100);
assert.equal(run('Math.round(statsRecoveryFactor(closed)*100)/100'), 3.5, '350 / 100');

/* Serie: der letzte abgeschlossene Trade war ein Verlust, davor ein Gewinn. */
assert.equal(run('statsCurrentStreak(closed)'), -1);
run(`trades=[
  {trade_date:'2026-08-01',pnl_usd:-100,r_multiple:-1,result:'loss'},
  {trade_date:'2026-08-02',pnl_usd:-100,r_multiple:-1,result:'loss'},
  {trade_date:'2026-08-03',pnl_usd:-100,r_multiple:-1,result:'loss'}
];`);
assert.equal(run('statsCurrentStreak(statsClosedTrades())'), -3, 'drei Verluste am Stück');

/* Einzahl und Mehrzahl bei der Serie */
run(
  `trades=[{trade_date:'2026-08-01',pnl_usd:100,r_multiple:1,result:'win'}]; renderTradingStats();`,
);
assert.match(element('#tradingStats').innerHTML, /1 Gewinn</, 'ein Gewinn, nicht "1 Gewinne"');

/* Grenzfälle, die sonst NaN oder Infinity in die Oberfläche tragen */
assert.equal(run('statsWinRate([])'), 0);
assert.equal(run('statsProfitFactor([])'), 0);
assert.equal(run('statsExpectancyR([])'), 0);
assert.equal(run('statsMaxDrawdown([])'), 0);
assert.equal(run('formatStatsRatio(Infinity)'), '∞', 'ohne Verluste keine kaputte Zahl');
assert.equal(run('formatStatsMoney(Infinity)'), '–');
assert.equal(
  run('statsProfitFactor([{pnl_usd:100,result:"win"}])'),
  Infinity,
  'nur Gewinne: Profit Factor ist nicht definiert',
);

/* Ein Tag fasst mehrere Trades zusammen */
run(`trades=[
  {trade_date:'2026-08-01',pnl_usd:200,r_multiple:2,result:'win'},
  {trade_date:'2026-08-01',pnl_usd:-50,r_multiple:-0.5,result:'loss'},
  {trade_date:'2026-08-02',pnl_usd:100,r_multiple:1,result:'win'}
];`);
assert.equal(
  run('statsDailyPnl(statsClosedTrades()).map(day=>day.date+":"+day.value).join(",")'),
  '2026-08-01:150,2026-08-02:100',
);

/* Zeitraumfilter greift wirklich */
const today = new Date().toISOString().slice(0, 10);
run(`trades=[
  {trade_date:'2020-01-01',pnl_usd:999,r_multiple:9,result:'win'},
  {trade_date:'${today}',pnl_usd:100,r_multiple:1,result:'win'}
];`);
assert.equal(run("statsInRange(statsClosedTrades(),'1M').length"), 1, 'alter Trade fällt raus');
assert.equal(run("statsInRange(statsClosedTrades(),'all').length"), 2);

/* Die Oberfläche rendert und bleibt bei dünner Datenlage ruhig */
run("statsRange='all'; renderTradingStats();");
const html = element('#tradingStats').innerHTML;
assert.match(html, /Profit Factor/);
assert.match(html, /Kapitalkurve/);
assert.doesNotMatch(html, /NaN|undefined|Infinity/, 'keine kaputten Werte in der Ausgabe');

run('trades=[]; renderTradingStats();');
assert.match(
  element('#tradingStats').innerHTML,
  /zweiten abgeschlossenen Trade/,
  'ohne Daten steht dort ein Hinweis statt einer leeren Fläche',
);

console.log('Trading-Kennzahlen: Rechenwerte, Grenzfälle, Zeitraumfilter und Ausgabe: OK');
