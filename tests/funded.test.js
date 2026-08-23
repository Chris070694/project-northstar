const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const elements = new Map();
function element(selector) {
  if (!elements.has(selector))
    elements.set(selector, { innerHTML: '', textContent: '', value: '' });
  return elements.get(selector);
}

const context = vm.createContext({
  console,
  Intl,
  Math,
  Number,
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
  tradingSettings: {},
  sb: null,
  currentUser: { id: 'user-1' },
});
vm.runInContext(fs.readFileSync(path.join(root, 'modules/funded.js'), 'utf8'), context);

const run = code => vm.runInContext(code, context);
const api = name => vm.runInContext(name, context);
/* Modul-Zustand steckt in let-Bindungen, die kein Property des Kontexts sind —
   deshalb wird über eine Zuweisung im Kontext gesetzt, nicht über context.x = y. */
function setGlobal(name, value) {
  context.__value = value;
  run(`${name} = __value;`);
}

const fundedPhaseState = api('fundedPhaseState');
const fundedTodayPlan = api('fundedTodayPlan');
const fundedParseAmount = api('fundedParseAmount');
const fundedRiskPerTrade = api('fundedRiskPerTrade');
const fundedResolveSelection = api('fundedResolveSelection');
const fundedNextPhaseDraft = api('fundedNextPhaseDraft');
const fundedCurrentPhase = api('fundedCurrentPhase');
const isMissingFundedSchema = api('isMissingFundedSchema');
const fundedTradesOnDay = api('fundedTradesOnDay');

/* Eine Phase mit von Hand nachgerechneten Sollwerten.
   Start 50.000 · Ziel 3.000 · Tageslimit 1.250 · Gesamtlimit 2.500 · 5 Handelstage nötig. */
const phase = {
  id: 'p1',
  account_id: 'a1',
  phase_type: 'phase1',
  attempt: 1,
  start_balance: 50000,
  profit_target_usd: 3000,
  daily_loss_limit_usd: 1250,
  max_loss_usd: 2500,
  drawdown_mode: 'static',
  min_trading_days: 5,
  started_on: '2026-08-01',
  status: 'active',
  failed_reason: '',
};

/* +900 −400 +1200 −300 +600 = 2.000 an fünf Handelstagen.
   Der private Trade und der offene Trade dürfen nirgends mitzählen. */
const tradeList = [
  { id: 't1', funded_phase_id: 'p1', trade_date: '2026-08-03', pnl_usd: 900, result: 'win' },
  { id: 't2', funded_phase_id: 'p1', trade_date: '2026-08-04', pnl_usd: -400, result: 'loss' },
  { id: 't3', funded_phase_id: 'p1', trade_date: '2026-08-05', pnl_usd: 1200, result: 'win' },
  { id: 't4', funded_phase_id: 'p1', trade_date: '2026-08-06', pnl_usd: -300, result: 'loss' },
  { id: 't5', funded_phase_id: 'p1', trade_date: '2026-08-07', pnl_usd: 600, result: 'win' },
  { id: 't6', funded_phase_id: null, trade_date: '2026-08-04', pnl_usd: 5000, result: 'win' },
  { id: 't7', funded_phase_id: 'p1', trade_date: '2026-08-06', pnl_usd: 0, result: 'open' },
];

const base = fundedPhaseState(phase, tradeList, [], '2026-08-06', { riskPerTrade: 250 });
assert.equal(base.realized, 2000, 'privater Trade und offener Trade zählen nicht mit');
assert.equal(base.balance, 52000, '50.000 Start plus 2.000 realisiert');
assert.equal(base.floor, 47500, 'fester Boden: Start minus Gesamtlimit');
assert.equal(base.totalBuffer, 4500, '52.000 minus 47.500');
assert.equal(base.dayPnl, -300, 'der Tag, der hereingereicht wurde');
assert.equal(base.dayBuffer, 950, '1.250 Limit minus 300 Tagesverlust');
assert.equal(base.tradingDays, 5, 'fünf verschiedene Handelstage');
assert.equal(base.tradeCount, 5);
assert.equal(Math.round(base.progressPercent * 100) / 100, 66.67, '2.000 von 3.000');
assert.equal(base.targetHit, false);
assert.equal(base.daysMissing, 0);
assert.equal(base.status, 'running');
assert.equal(base.tradesLeftByRisk, 3.8, '950 Puffer bei 250 Risiko');

/* Ein Gewinntag lässt das Tageslimit unangetastet, ein Tag ohne Trades ebenso. */
assert.equal(
  fundedPhaseState(phase, tradeList, [], '2026-08-07', {}).dayBuffer,
  1250,
  'nach einem Gewinntag steht das volle Limit',
);
assert.equal(
  fundedPhaseState(phase, tradeList, [], '2026-08-20', {}).dayBuffer,
  1250,
  'ein Tag ohne Trades zehrt nichts auf',
);

/* Grenzfall: genau auf dem Limit ist noch nicht gerissen — auch nicht mit Float-Rauschen. */
const exactly = [
  { funded_phase_id: 'p1', trade_date: '2026-08-03', pnl_usd: -1250.000000001, result: 'loss' },
];
const onLimit = fundedPhaseState(phase, exactly, [], '2026-08-03', { riskPerTrade: 250 });
assert.equal(onLimit.dailyBreached, false, 'Rundungsrauschen verbrennt kein Konto');
assert.equal(onLimit.dayBuffer, 0, 'der Puffer ist aber aufgebraucht');
assert.equal(onLimit.status, 'daily_close', 'gewarnt wird trotzdem');

const overLimit = fundedPhaseState(
  phase,
  [{ funded_phase_id: 'p1', trade_date: '2026-08-03', pnl_usd: -1300, result: 'loss' }],
  [],
  '2026-08-03',
  { riskPerTrade: 250 },
);
assert.equal(overLimit.dailyBreached, true);
assert.equal(overLimit.status, 'breach_daily');
assert.equal(overLimit.suggestedReason, 'daily_loss');
assert.equal(overLimit.suggestedDate, '2026-08-03');
assert.equal(overLimit.locked, true);

/* Ein Bruch von vorgestern verschwindet nicht, weil heute nichts passiert. */
const oldBreach = fundedPhaseState(
  phase,
  [
    { funded_phase_id: 'p1', trade_date: '2026-08-03', pnl_usd: -1300, result: 'loss' },
    { funded_phase_id: 'p1', trade_date: '2026-08-05', pnl_usd: 200, result: 'win' },
  ],
  [],
  '2026-08-05',
  {},
);
assert.equal(oldBreach.status, 'breach_daily', 'der schlechteste Tag der Phase zählt');
assert.equal(oldBreach.dayBuffer, 1250, 'heute ist der Tagespuffer trotzdem voll');

/* Nachlaufender Boden gegen festen Boden, gleiche Trades:
   +3.000 hebt den Höchststand auf 53.000, der Boden zieht auf 50.500 nach.
   −2.600 lässt den Stand auf 50.400 fallen — nachlaufend gerissen, fest nicht. */
const trailingPhase = { ...phase, drawdown_mode: 'trailing', daily_loss_limit_usd: 3000 };
const swingTrades = [
  { funded_phase_id: 'p1', trade_date: '2026-08-01', pnl_usd: 3000, result: 'win' },
  { funded_phase_id: 'p1', trade_date: '2026-08-02', pnl_usd: -2600, result: 'loss' },
];
const trailing = fundedPhaseState(trailingPhase, swingTrades, [], '2026-08-02', {});
assert.equal(trailing.peak, 53000);
assert.equal(trailing.floor, 50500, '53.000 Höchststand minus 2.500');
assert.equal(trailing.maxBreached, true);
assert.equal(trailing.floorBreach.date, '2026-08-02');
assert.equal(trailing.status, 'breach_max');
assert.equal(trailing.totalBuffer, 0, 'Puffer wird bei 0 geklemmt, nicht negativ gezeigt');

const staticSame = fundedPhaseState(
  { ...phase, daily_loss_limit_usd: 3000 },
  swingTrades,
  [],
  '2026-08-02',
  {},
);
assert.equal(staticSame.floor, 47500);
assert.equal(staticSame.maxBreached, false, 'derselbe Verlauf reißt den festen Boden nicht');
assert.equal(staticSame.totalBuffer, 2900, '50.400 minus 47.500');

/* Ziel erreicht, aber Handelstage fehlen — der Moment, in dem man aus Ungeduld alles verspielt. */
const quickTarget = [
  { funded_phase_id: 'p1', trade_date: '2026-08-03', pnl_usd: 1500, result: 'win' },
  { funded_phase_id: 'p1', trade_date: '2026-08-04', pnl_usd: 1500, result: 'win' },
];
const pending = fundedPhaseState(phase, quickTarget, [], '2026-08-04', {});
assert.equal(pending.targetHit, true, '3.000 von 3.000');
assert.equal(pending.daysMissing, 3, 'fünf nötig, zwei gemacht');
assert.equal(pending.targetReached, false);
assert.equal(pending.status, 'target_days_missing');

const done = fundedPhaseState({ ...phase, min_trading_days: 2 }, quickTarget, [], '2026-08-04', {});
assert.equal(done.targetReached, true);
assert.equal(done.status, 'target_reached');
assert.equal(done.locked, false, 'ein erreichtes Ziel sperrt nichts');

/* Phase ohne Trades: nirgends NaN, nirgends undefined. */
const empty = fundedPhaseState(phase, [], [], '2026-08-06', { riskPerTrade: 250 });
assert.equal(empty.realized, 0);
assert.equal(empty.balance, 50000);
assert.equal(empty.progressPercent, 0);
assert.equal(empty.dayBuffer, 1250);
assert.equal(empty.totalBuffer, 2500);
assert.equal(empty.tradingDays, 0);
assert.equal(empty.status, 'running');
Object.entries(empty).forEach(([key, value]) => {
  if (typeof value === 'number') assert.equal(Number.isFinite(value), true, `${key} ist eine Zahl`);
});

/* Ohne Ziel entfallen Balken und Prozentzahl, statt 0 durch 0 zu rechnen. */
const noTarget = fundedPhaseState({ ...phase, profit_target_usd: null }, tradeList, [], '', {});
assert.equal(noTarget.hasTarget, false);
assert.equal(noTarget.progressPercent, null);
assert.equal(noTarget.progressWidth, 0);
assert.equal(noTarget.targetReached, false);

/* Über dem Ziel: der Balken bleibt bei 100, die Zahl sagt die Wahrheit. */
const over = fundedPhaseState(
  { ...phase, min_trading_days: 0 },
  [{ funded_phase_id: 'p1', trade_date: '2026-08-03', pnl_usd: 3300, result: 'win' }],
  [],
  '',
  {},
);
assert.equal(Math.round(over.progressPercent * 100) / 100, 110, '3.300 von 3.000');
assert.equal(over.progressWidth, 100);

/* Verlust in der Phase: der Balken geht nicht ins Negative, die Zahl schon. */
const negative = fundedPhaseState(
  phase,
  [{ funded_phase_id: 'p1', trade_date: '2026-08-03', pnl_usd: -600, result: 'loss' }],
  [],
  '',
  {},
);
assert.equal(negative.progressPercent, -20);
assert.equal(negative.progressWidth, 0);

/* Ohne geplantes Risiko gibt es keine Zahl statt einer unendlichen. */
assert.equal(fundedRiskPerTrade({ account_balance: 10000, default_risk_percent: 2.5 }), 250);
assert.equal(fundedRiskPerTrade({ account_balance: 0, default_risk_percent: 2.5 }), 0);
assert.equal(fundedRiskPerTrade({}), 0);
assert.equal(fundedPhaseState(phase, tradeList, [], '2026-08-06', {}).tradesLeftByRisk, null);

/* Auszahlungen senken den Kontostand, aber nicht den Höchststand. */
const fundedPhase = {
  ...phase,
  phase_type: 'funded',
  profit_target_usd: null,
  drawdown_mode: 'trailing',
  min_trading_days: 0,
};
const withPayout = fundedPhaseState(
  fundedPhase,
  [{ funded_phase_id: 'p1', trade_date: '2026-08-03', pnl_usd: 4000, result: 'win' }],
  [{ phase_id: 'p1', payout_date: '2026-08-10', gross_usd: 3000, payout_usd: 2400 }],
  '2026-08-10',
  { profitSplitPercent: 80 },
);
assert.equal(withPayout.balance, 51000, '50.000 + 4.000 − 3.000 entnommen');
assert.equal(withPayout.peak, 54000, 'die Entnahme senkt den Höchststand nicht');
assert.equal(withPayout.floor, 51500, '54.000 minus 2.500');
assert.equal(withPayout.maxBreached, true, '51.000 liegt unter dem nachgezogenen Boden');
assert.equal(withPayout.earnedShare, 800, '80 % von 4.000 minus 2.400 ausgezahlt');

/* Ein bestätigter Bruch bleibt stehen, auch wenn die Zahlen ihn nicht mehr stützen. */
const confirmed = fundedPhaseState(
  { ...phase, status: 'failed', failed_reason: 'daily_loss', failed_on: '2026-08-12' },
  tradeList,
  [],
  '2026-08-06',
  {},
);
assert.equal(confirmed.status, 'failed');
assert.equal(confirmed.confirmed, true);
assert.equal(confirmed.locked, true);
assert.equal(confirmed.staleBreach, true, 'die Karte sagt offen, dass die Daten das nicht stützen');

/* Was heute noch möglich ist: das Kleinere aus Puffer und Trade-Limit. */
const todayTrades = fundedTradesOnDay(phase, tradeList, '2026-08-06');
assert.equal(todayTrades.length, 2, 'für das Trade-Limit des Tages zählt der offene Trade mit');
const plan = fundedTodayPlan(base, { riskPerTrade: 250, maxTradesPerDay: 2, tradesToday: 1 });
assert.equal(plan.trades, 1, '3 nach Puffer, 1 nach Trade-Limit');
assert.equal(plan.limitedBy, 'count');
assert.match(plan.text, /noch ein Trade/);

const riskBound = fundedTodayPlan(base, { riskPerTrade: 500, maxTradesPerDay: 5, tradesToday: 0 });
assert.equal(riskBound.trades, 1, '950 Puffer trägt genau ein Risiko von 500');
assert.equal(riskBound.limitedBy, 'risk');

const nothingLeft = fundedTodayPlan(onLimit, {
  riskPerTrade: 250,
  maxTradesPerDay: 2,
  tradesToday: 1,
});
assert.equal(nothingLeft.allowed, false);
assert.equal(nothingLeft.trades, 0);
assert.match(nothingLeft.text, /kein Trade mehr/);

const breachedPlan = fundedTodayPlan(overLimit, { riskPerTrade: 250, maxTradesPerDay: 2 });
assert.equal(breachedPlan.allowed, false);
assert.match(breachedPlan.text, /Für heute ist Schluss/);

const withoutRisk = fundedTodayPlan(base, { riskPerTrade: 0, maxTradesPerDay: 0 });
assert.equal(withoutRisk.trades, null, 'ohne Risikobetrag keine erfundene Trade-Zahl');
assert.doesNotMatch(withoutRisk.text, /NaN|Infinity|undefined/);

/* Prozenteingaben werden genau einmal umgerechnet, gespeichert wird die absolute Zahl. */
assert.equal(fundedParseAmount('6000', 50000), 6000);
assert.equal(fundedParseAmount('6%', 50000), 3000);
assert.equal(fundedParseAmount('2,5 %', 50000), 1250, 'Komma und Leerzeichen sind erlaubt');
assert.equal(fundedParseAmount('', 50000), null, 'leer heißt "nicht gesetzt", nicht 0');
assert.equal(fundedParseAmount('abc', 50000), null);
assert.equal(fundedParseAmount(null, 50000), null);

/* Kontoauswahl: das archivierte Standardkonto zieht nicht still das nächstbeste nach. */
const accounts = [
  { id: 'a1', label: 'Apex 50k', is_default: true, archived_at: null, account_size: 50000 },
  { id: 'a2', label: 'Topstep 100k', is_default: false, archived_at: null, account_size: 100000 },
];
assert.equal(fundedResolveSelection(accounts, null), 'a1', 'das Standardkonto');
assert.equal(fundedResolveSelection(accounts, 'a2'), 'a2', 'eine getroffene Wahl bleibt');
assert.equal(
  fundedResolveSelection(
    [
      { ...accounts[0], archived_at: '2026-08-01' },
      accounts[1],
      { id: 'a3', label: 'FTMO 25k', is_default: false, archived_at: null, account_size: 25000 },
    ],
    null,
  ),
  null,
  'ist das Standardkonto archiviert, nimmt die Karte nicht still das nächstbeste',
);
assert.equal(
  fundedResolveSelection([{ ...accounts[1] }], null),
  'a2',
  'bei genau einem offenen Konto ist die Wahl eindeutig',
);
assert.equal(fundedResolveSelection([], 'a1'), null);

/* Zwei aktive Phasen darf es nicht geben — trifft der Client darauf, nimmt er die neueste. */
const phaseList = [
  { id: 'old', account_id: 'a1', started_on: '2026-07-01', status: 'failed' },
  { id: 'new', account_id: 'a1', started_on: '2026-08-01', status: 'active' },
  { id: 'other', account_id: 'a2', started_on: '2026-08-10', status: 'active' },
];
assert.equal(fundedCurrentPhase(phaseList, 'a1').id, 'new');
assert.equal(fundedCurrentPhase(phaseList, 'a2').id, 'other');
assert.equal(fundedCurrentPhase(phaseList, 'a3'), null, 'ein Konto ohne Phase bleibt ruhig');
assert.equal(
  fundedCurrentPhase([{ id: 'done', account_id: 'a1', status: 'failed' }], 'a1').id,
  'done',
  'ohne aktive Phase steht die letzte abgeschlossene da',
);

/* Fortschreiben: bestanden geht eine Stufe weiter, ein neuer Versuch bleibt auf seiner. */
const account = { id: 'a1', account_size: 50000, default_drawdown_mode: 'static' };
const next = fundedNextPhaseDraft(account, phase, 'passed');
assert.equal(next.phase_type, 'phase2');
assert.equal(next.attempt, 1);
assert.equal(next.start_balance, 50000, 'Phase 2 startet wieder auf Kontogröße');
const retry = fundedNextPhaseDraft(account, { ...phase, attempt: 2 }, 'retry');
assert.equal(retry.phase_type, 'phase1');
assert.equal(retry.attempt, 3);
const toFunded = fundedNextPhaseDraft(account, { ...phase, phase_type: 'phase2' }, 'passed');
assert.equal(toFunded.phase_type, 'funded');
assert.equal(toFunded.profit_target_usd, null, 'ein funded Konto hat kein Ziel mehr');
assert.equal(
  fundedNextPhaseDraft(account, { ...phase, phase_type: 'funded' }, 'passed'),
  null,
  'hinter funded kommt keine weitere Stufe',
);

/* Fehlende Migration wird erkannt, echte Fehler nicht verschluckt. */
assert.equal(
  isMissingFundedSchema({ code: '42P01', message: 'relation "funded_accounts" does not exist' }),
  true,
);
assert.equal(
  isMissingFundedSchema({ code: 'PGRST205', message: 'Could not find the table' }),
  true,
);
assert.equal(
  isMissingFundedSchema({
    message: "Could not find the 'funded_phase_id' column in the schema cache",
  }),
  true,
);
assert.equal(
  isMissingFundedSchema({ code: '23505', message: 'duplicate key value violates constraint' }),
  false,
  'ein doppelter Schlüssel ist kein fehlendes Schema',
);

/* Ein Supabase-Client, der auf Anfrage antwortet, ohne dass ein Netz nötig wäre. */
function fakeSupabase(answers) {
  return {
    from(table) {
      const chain = {
        select: () => chain,
        order: () => chain,
        then: resolve => resolve(answers[table]),
      };
      return chain;
    },
  };
}

const migrationMissing = {
  error: { code: '42P01', message: 'relation "public.funded_accounts" does not exist' },
};
const answersMissing = {
  funded_accounts: migrationMissing,
  funded_phases: migrationMissing,
  funded_payouts: migrationMissing,
};
const answersReady = {
  funded_accounts: { data: accounts, error: null },
  funded_phases: { data: [{ ...phase, account_id: 'a1' }], error: null },
  funded_payouts: { data: [], error: null },
};

const loadFunded = api('loadFunded');
const renderFunded = api('renderFunded');

async function main() {
  /* Ohne ausgeführte Migration läuft die App weiter: kein Fehler nach oben, leere Listen. */
  setGlobal('sb', fakeSupabase(answersMissing));
  await loadFunded();
  assert.equal(run('fundedReady'), false);
  assert.equal(run('fundedAccounts.length'), 0);
  renderFunded();
  assert.match(element('#fundedCard').innerHTML, /Migration/, 'die Karte erklärt, was fehlt');
  assert.doesNotMatch(element('#fundedCard').innerHTML, /NaN|undefined|Infinity/);

  /* Ein echter Fehler wird nicht verschluckt. */
  setGlobal(
    'sb',
    fakeSupabase({
      funded_accounts: { error: { code: '23505', message: 'duplicate key' } },
      funded_phases: { data: [], error: null },
      funded_payouts: { data: [], error: null },
    }),
  );
  await assert.rejects(
    () => loadFunded(),
    error => error.code === '23505',
    'ein echter Datenbankfehler kommt oben an',
  );

  /* Mit Migration: Auswahl steht, die Karte zeigt Fortschritt, beide Puffer und den Tagesplan. */
  setGlobal('sb', fakeSupabase(answersReady));
  await loadFunded();
  assert.equal(run('fundedReady'), true);
  assert.equal(run('fundedSelectedAccountId'), 'a1');

  setGlobal('trades', tradeList);
  setGlobal('tradingSettings', {
    account_balance: 10000,
    default_risk_percent: 2.5,
    max_trades_per_day: 2,
  });
  renderFunded();
  const html = element('#fundedCard').innerHTML;
  assert.match(html, /Fortschritt zum Ziel/);
  assert.match(html, /Puffer heute/);
  assert.match(html, /Puffer gesamt/);
  assert.match(html, /Handelstage/);
  assert.match(html, /Apex 50k/);
  assert.doesNotMatch(html, /NaN|undefined|Infinity/, 'keine kaputten Werte in der Ausgabe');

  /* Ohne Konto steht ein erklärender Leerzustand statt leerer Balken. */
  setGlobal('fundedAccounts', []);
  setGlobal('fundedPhases', []);
  setGlobal('fundedSelectedAccountId', null);
  renderFunded();
  assert.match(element('#fundedCard').innerHTML, /Konto anlegen/);
  assert.doesNotMatch(element('#fundedCard').innerHTML, /NaN|undefined|Infinity/);

  /* Gerissene Phase: deutlich, mit Weg nach vorn, ohne Drama. */
  setGlobal('fundedAccounts', accounts);
  setGlobal('fundedSelectedAccountId', 'a1');
  setGlobal('fundedPhases', [
    { ...phase, status: 'failed', failed_reason: 'daily_loss', failed_on: '2026-08-08' },
  ]);
  renderFunded();
  const breachHtml = element('#fundedCard').innerHTML;
  assert.match(breachHtml, /Tagesverlustlimit gerissen am 2026-08-08/);
  assert.match(breachHtml, /Neuer Versuch/);
  assert.match(breachHtml, /Eintrag korrigieren/);
  assert.doesNotMatch(breachHtml, /NaN|undefined|Infinity/);

  /* Nutzereingaben landen escaped in der Ausgabe. */
  setGlobal('fundedAccounts', [
    { id: 'a1', label: '<img src=x onerror=alert(1)>', archived_at: null, account_size: 50000 },
  ]);
  setGlobal('fundedPhases', [phase]);
  renderFunded();
  assert.doesNotMatch(element('#fundedCard').innerHTML, /<img/, 'Kontoname wird escaped');

  /* Das Trade-Modal bietet Privat plus offene Konten mit laufender Phase an. */
  setGlobal('fundedAccounts', accounts);
  setGlobal('fundedPhases', [
    { ...phase, id: 'p1', account_id: 'a1', status: 'active' },
    { ...phase, id: 'p2', account_id: 'a2', status: 'failed' },
  ]);
  const options = api('fundedTradeOptionsHtml')();
  assert.match(options, /Privat/);
  assert.match(options, /value="p1" selected/, 'das Standardkonto ist vorausgewählt');
  assert.doesNotMatch(options, /value="p2"/, 'in eine abgeschlossene Phase hängt nichts mehr ein');

  const payload = api('fundedTradePayload');
  assert.equal(payload('p1').funded_phase_id, 'p1');
  assert.equal(payload('p1').funded_account_id, 'a1');
  assert.equal(payload('').funded_phase_id, null, 'privater Trade');
  assert.equal(payload('').funded_account_id, null);
  run('fundedReady = false;');
  assert.equal(
    Object.keys(payload('p1')).length,
    0,
    'ohne Migration bleibt der Trade-Insert unverändert',
  );
  run('fundedReady = true;');

  console.log('Funded-Tracking: Puffer, Boden, Ziel, Grenzfälle und Ausgabe: OK');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
