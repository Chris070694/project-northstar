/* Funded-Account-Tracking.
   Kontostand, Fortschritt, Puffer und Drawdown werden bei jedem Render neu aus den Trades
   gerechnet — gespeichert wird nur, was kein Rechenergebnis ist (Limits, Startguthaben und
   der bestätigte Bruch). Sonst lügt die Karte, sobald ein Trade korrigiert wird.
   Alle Rechenfunktionen bekommen ihre Daten als Argumente, auch den heutigen Tag: so sind sie
   ohne DOM und ohne Uhrzeit prüfbar. */

let fundedReady = true;
let fundedAccounts = [];
let fundedPhases = [];
let fundedPayouts = [];
let fundedSelectedAccountId = null;
let fundedFormMode = null;
let fundedFormDraft = null;

const FUNDED_PHASE_LABELS = { phase1: 'Phase 1', phase2: 'Phase 2', funded: 'Funded' };
const FUNDED_NEXT_PHASE = { phase1: 'phase2', phase2: 'funded', funded: 'funded' };
const FUNDED_REASON_LABELS = {
  daily_loss: 'Tagesverlustlimit',
  max_loss: 'Gesamtverlustlimit',
  time: 'Zeitlimit',
  manual: 'Von Hand eingetragen',
};

/* ---------- Rechnen: reine Funktionen, kein DOM, keine globalen Daten ---------- */

function fundedNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

/* Vor jedem Vergleich auf Cent runden. Eine Summe aus Floats ergibt sonst −250,000000001
   und würde ein Konto wegen Rundungsrauschen verbrennen. */
function fundedCents(value) {
  return Math.round(fundedNumber(value) * 100) / 100;
}

function fundedDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fundedMoney(value) {
  if (!Number.isFinite(Number(value))) return '–';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

/* Dieselbe Regel wie in stats.js: ein Trade zählt, sobald er ein Ergebnis hat. */
function fundedIsClosed(trade) {
  const result =
    trade?.result ||
    (typeof deriveTradeResult === 'function' ? deriveTradeResult(trade?.pnl_usd) : 'open');
  return result !== 'open';
}

function fundedSortKey(entry) {
  return `${entry?.trade_date || ''} ${entry?.created_at || ''}`;
}

/* Nur Trades, die beim Speichern dieser Phase zugeordnet wurden. Ein Datumsbereich wäre
   nicht eindeutig, sobald zwei Konten parallel laufen. */
function fundedPhaseTrades(phase, list = []) {
  if (!phase) return [];
  return (list || [])
    .filter(trade => trade?.funded_phase_id === phase.id && fundedIsClosed(trade))
    .slice()
    .sort((a, b) => fundedSortKey(a).localeCompare(fundedSortKey(b)));
}

function fundedTradesOnDay(phase, list = [], dayKey = '') {
  if (!phase || !dayKey) return [];
  return (list || []).filter(
    trade => trade?.funded_phase_id === phase.id && String(trade?.trade_date) === dayKey,
  );
}

function fundedPhasePayouts(phase, list = []) {
  if (!phase) return [];
  return (list || [])
    .filter(payout => payout?.phase_id === phase.id)
    .slice()
    .sort((a, b) => String(a.payout_date || '').localeCompare(String(b.payout_date || '')));
}

function fundedRealized(list = []) {
  return list.reduce((sum, trade) => sum + fundedNumber(trade.pnl_usd), 0);
}

/* Verlauf des Kontostands. Zwei Werte je Punkt, weil sie verschiedene Aufgaben haben:
   `value` ist der echte Kontostand (Auszahlungen abgezogen), `peak` der Höchststand für den
   nachlaufenden Boden — den senkt eine Auszahlung bewusst nicht. */
function fundedBalanceCurve(phase, tradeList = [], payoutList = []) {
  if (!phase) return [];
  const start = fundedNumber(phase.start_balance);
  const events = [
    ...tradeList.map(trade => ({
      date: String(trade.trade_date || ''),
      order: `${trade.trade_date || ''} 0 ${trade.created_at || ''}`,
      pnl: fundedNumber(trade.pnl_usd),
      gross: 0,
    })),
    ...payoutList.map(payout => ({
      date: String(payout.payout_date || ''),
      order: `${payout.payout_date || ''} 1 ${payout.created_at || ''}`,
      pnl: 0,
      gross: fundedNumber(payout.gross_usd),
    })),
  ].sort((a, b) => a.order.localeCompare(b.order));

  let profit = 0;
  let paid = 0;
  let peak = start;
  return events.map(event => {
    profit += event.pnl;
    paid += event.gross;
    peak = Math.max(peak, start + profit);
    return { date: event.date, value: start + profit - paid, peak };
  });
}

function fundedFloorAt(phase, peak) {
  const start = fundedNumber(phase?.start_balance);
  const maxLoss = fundedNumber(phase?.max_loss_usd);
  const base = phase?.drawdown_mode === 'trailing' ? Math.max(start, fundedNumber(peak)) : start;
  return base - maxLoss;
}

/* Erster Punkt, an dem der Kontostand den Boden erreicht. Den Boden zu berühren reicht —
   so rechnen die Firmen den maximalen Verlust ab. */
function fundedFloorBreach(phase, curve = []) {
  for (const point of curve) {
    const floor = fundedFloorAt(phase, point.peak);
    if (fundedCents(point.value) <= fundedCents(floor))
      return { date: point.date, value: point.value, floor };
  }
  return null;
}

function fundedDailySeries(list = []) {
  const byDay = new Map();
  list.forEach(trade => {
    const key = String(trade.trade_date || '');
    byDay.set(key, (byDay.get(key) || 0) + fundedNumber(trade.pnl_usd));
  });
  return [...byDay.entries()]
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .map(([date, value]) => ({ date, value }));
}

function fundedDayValue(series = [], dayKey = '') {
  const entry = series.find(day => day.date === dayKey);
  return entry ? entry.value : 0;
}

function fundedWorstDay(series = []) {
  return series.reduce((worst, day) => (!worst || day.value < worst.value ? day : worst), null);
}

function fundedTradingDays(list = []) {
  return new Set(list.map(trade => String(trade.trade_date || ''))).size;
}

/* Die Brücke zum Cockpit: der geplante Risikobetrag je Trade. */
function fundedRiskPerTrade(settings = {}) {
  const balance = fundedNumber(settings?.account_balance);
  const percent = fundedNumber(settings?.default_risk_percent);
  if (balance <= 0 || percent <= 0) return 0;
  return (balance * percent) / 100;
}

/* Der ganze Zustand einer Phase in einem Rutsch. `todayKey` kommt von außen herein,
   damit der Test nicht an der Uhrzeit seines Laufs hängt. */
function fundedPhaseState(phase, tradeList = [], payoutList = [], todayKey = '', options = {}) {
  if (!phase) return { hasPhase: false, status: 'no_phase', locked: false, confirmed: false };

  const riskPerTrade = Math.max(0, fundedNumber(options.riskPerTrade));
  const closed = fundedPhaseTrades(phase, tradeList);
  const payouts = fundedPhasePayouts(phase, payoutList);
  const curve = fundedBalanceCurve(phase, closed, payouts);

  const start = fundedNumber(phase.start_balance);
  const realized = fundedRealized(closed);
  const paidGross = payouts.reduce((sum, payout) => sum + fundedNumber(payout.gross_usd), 0);
  const paidNet = payouts.reduce((sum, payout) => sum + fundedNumber(payout.payout_usd), 0);
  const balance = start + realized - paidGross;
  const peak = curve.reduce((highest, point) => Math.max(highest, point.peak), start);
  const floor = fundedFloorAt(phase, peak);

  const series = fundedDailySeries(closed);
  const dayPnl = fundedDayValue(series, todayKey);
  const worstDay = fundedWorstDay(series);
  const dailyLimit = fundedNumber(phase.daily_loss_limit_usd);

  /* Genau auf dem Limit ist der Tag noch nicht verloren, erst ein Cent darüber. Geprüft wird
     der schlechteste Tag der ganzen Phase, nicht nur heute: ein Bruch von vorgestern
     verschwindet nicht dadurch, dass heute nichts passiert. */
  const dailyBreached = Boolean(worstDay) && fundedCents(worstDay.value) < -fundedCents(dailyLimit);
  const floorBreach = fundedFloorBreach(phase, curve);
  const maxBreached = Boolean(floorBreach);

  /* Ein Gewinntag lässt das volle Limit stehen, ein Verlusttag zehrt es auf. Nie negativ. */
  const dayBuffer = Math.max(0, dailyLimit + Math.min(0, dayPnl));
  const totalBuffer = Math.max(0, balance - floor);

  const target = phase.profit_target_usd == null ? null : fundedNumber(phase.profit_target_usd);
  const hasTarget = target !== null && target > 0;
  const progressPercent = hasTarget ? (realized / target) * 100 : null;
  const progressWidth = hasTarget ? Math.min(100, Math.max(0, progressPercent)) : 0;
  const tradingDays = fundedTradingDays(closed);
  const daysMissing = Math.max(0, fundedNumber(phase.min_trading_days) - tradingDays);
  const targetHit = hasTarget && fundedCents(realized) >= fundedCents(target);
  const targetReached = targetHit && daysMissing === 0;

  const splitPercent = Math.max(0, fundedNumber(options.profitSplitPercent));
  const earnedShare = (Math.max(0, realized) * splitPercent) / 100 - paidNet;

  const confirmed = phase.status !== 'active';
  let status = 'running';
  if (phase.status === 'passed') status = 'passed';
  else if (phase.status === 'failed') status = 'failed';
  else if (maxBreached) status = 'breach_max';
  else if (dailyBreached) status = 'breach_daily';
  else if (targetHit && daysMissing > 0) status = 'target_days_missing';
  else if (targetReached) status = 'target_reached';
  else if (riskPerTrade > 0 && dayBuffer < riskPerTrade) status = 'daily_close';

  return {
    hasPhase: true,
    status,
    confirmed,
    locked: confirmed || status === 'breach_daily' || status === 'breach_max',
    start,
    realized,
    balance,
    paidGross,
    paidNet,
    peak,
    floor,
    dayPnl,
    dayBuffer,
    totalBuffer,
    worstDay,
    dailyLimit,
    maxLoss: fundedNumber(phase.max_loss_usd),
    dailyBreached,
    maxBreached,
    floorBreach,
    suggestedReason: maxBreached ? 'max_loss' : dailyBreached ? 'daily_loss' : '',
    suggestedDate: maxBreached ? floorBreach.date : dailyBreached ? worstDay.date : '',
    hasTarget,
    target,
    progressPercent,
    progressWidth,
    targetHit,
    targetReached,
    tradingDays,
    daysMissing,
    tradeCount: closed.length,
    earnedShare,
    /* Ein bestätigter Bruch bleibt stehen, auch wenn ein korrigierter Trade ihn nicht mehr
       stützt. Stilles Zurücksetzen wäre der schlimmere Fehler — die Karte sagt es stattdessen. */
    staleBreach: phase.status === 'failed' && !dailyBreached && !maxBreached,
    /* Ohne geplantes Risiko gibt es keine Zahl statt einer unendlichen. */
    tradesLeftByRisk: riskPerTrade > 0 ? dayBuffer / riskPerTrade : null,
  };
}

/* Was heute noch möglich ist: das Kleinere aus Puffer-durch-Risiko und Trade-Limit des Tages. */
function fundedTodayPlan(state, options = {}) {
  if (!state?.hasPhase) return { allowed: false, trades: 0, limitedBy: 'none', text: '' };
  if (state.confirmed)
    return {
      allowed: false,
      trades: 0,
      limitedBy: 'phase',
      text: 'Diese Phase ist abgeschlossen. Heute läuft hier nichts mehr.',
    };
  if (state.locked)
    return {
      allowed: false,
      trades: 0,
      limitedBy: 'breach',
      text: 'Für heute ist Schluss. Trag den Bruch ein und mach morgen sauber weiter.',
    };

  const riskPerTrade = Math.max(0, fundedNumber(options.riskPerTrade));
  const maxTradesPerDay = Math.max(0, Math.floor(fundedNumber(options.maxTradesPerDay)));
  const tradesToday = Math.max(0, Math.floor(fundedNumber(options.tradesToday)));
  const byRisk = riskPerTrade > 0 ? Math.floor(state.dayBuffer / riskPerTrade) : null;
  const byCount = maxTradesPerDay > 0 ? Math.max(0, maxTradesPerDay - tradesToday) : null;

  if (byRisk === null && byCount === null)
    return {
      allowed: true,
      trades: null,
      limitedBy: 'none',
      text: `Puffer heute ${fundedMoney(state.dayBuffer)}. Wie viele Trades das sind, sagt dir die Karte, sobald im Cockpit ein Risiko je Trade steht.`,
    };

  const trades = Math.min(...[byRisk, byCount].filter(value => value !== null));
  const limitedBy = byRisk !== null && byRisk <= (byCount ?? Infinity) ? 'risk' : 'count';
  if (trades <= 0)
    return {
      allowed: false,
      trades: 0,
      limitedBy,
      text:
        limitedBy === 'risk'
          ? `Heute kein Trade mehr — der Puffer von ${fundedMoney(state.dayBuffer)} trägt keinen weiteren.`
          : 'Heute kein Trade mehr — dein Trade-Limit für den Tag ist erreicht.',
    };
  return {
    allowed: true,
    trades,
    limitedBy,
    text:
      trades === 1
        ? `Heute ist noch ein Trade drin. Puffer ${fundedMoney(state.dayBuffer)}.`
        : `Heute sind noch ${trades} Trades drin. Puffer ${fundedMoney(state.dayBuffer)}.`,
  };
}

/* Eingabe darf "6000" oder "6%" sein. Umgerechnet wird genau einmal, beim Anlegen —
   gespeichert ist danach die absolute Zahl, damit die Auswertung eine stumpfe Subtraktion ist. */
function fundedParseAmount(raw, base = 0) {
  const text = String(raw ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(',', '.');
  if (!text) return null;
  const percent = text.endsWith('%');
  const number = Number(percent ? text.slice(0, -1) : text);
  if (!Number.isFinite(number)) return null;
  return percent ? (fundedNumber(base) * number) / 100 : number;
}

function fundedAccountPhases(list = [], accountId) {
  return (list || [])
    .filter(phase => phase?.account_id === accountId)
    .slice()
    .sort(
      (a, b) =>
        String(b.started_on || '').localeCompare(String(a.started_on || '')) ||
        String(b.created_at || '').localeCompare(String(a.created_at || '')),
    );
}

/* Zwei aktive Phasen verhindert der Unique-Index. Trifft der Client trotzdem darauf,
   nimmt er die neueste und sagt es, statt zu raten. */
function fundedCurrentPhase(list = [], accountId) {
  const phases = fundedAccountPhases(list, accountId);
  return phases.find(phase => phase.status === 'active') || phases[0] || null;
}

function fundedOpenAccounts(list = []) {
  return (list || []).filter(account => !account.archived_at);
}

/* Ist das Standardkonto archiviert, wird nicht still das nächstbeste genommen — es sei denn,
   es gibt genau eines. Sonst bleibt die Auswahl leer und die Karte fragt nach. */
function fundedResolveSelection(accounts = [], current = null) {
  const open = fundedOpenAccounts(accounts);
  if (current && open.some(account => account.id === current)) return current;
  const single = open.length === 1 ? open[0] : null;
  const preferred = open.find(account => account.is_default) || single;
  return preferred ? preferred.id : null;
}

/* Vorschlag für die nächste Phase. Übernommen wird, was bekannt ist; das Ziel bleibt
   bearbeitbar, weil Phase 2 bei den meisten Firmen ein kleineres hat. */
function fundedNextPhaseDraft(account, phase, mode) {
  if (!account || !phase) return null;
  if (mode !== 'retry' && phase.phase_type === 'funded') return null;
  const nextType = mode === 'retry' ? phase.phase_type : FUNDED_NEXT_PHASE[phase.phase_type];
  return {
    account_id: account.id,
    phase_type: nextType,
    attempt: mode === 'retry' ? fundedNumber(phase.attempt) + 1 : 1,
    start_balance: fundedNumber(account.account_size) || fundedNumber(phase.start_balance),
    profit_target_usd: nextType === 'funded' ? null : fundedNumber(phase.profit_target_usd) || null,
    daily_loss_limit_usd: fundedNumber(phase.daily_loss_limit_usd),
    max_loss_usd: fundedNumber(phase.max_loss_usd),
    drawdown_mode: phase.drawdown_mode || account.default_drawdown_mode || 'static',
    min_trading_days: fundedNumber(phase.min_trading_days),
  };
}

/* ---------- Anbindung an das Trade-Modal ---------- */

/* Zur Auswahl stehen nur offene Konten mit laufender Phase — in eine abgeschlossene Phase
   nachträglich Trades einzuhängen würde ihre Historie verfälschen. */
function fundedTradeOptions() {
  return fundedOpenAccounts(fundedAccounts)
    .map(account => ({ account, phase: fundedCurrentPhase(fundedPhases, account.id) }))
    .filter(entry => entry.phase && entry.phase.status === 'active');
}

function fundedDefaultPhaseId() {
  const account = fundedOpenAccounts(fundedAccounts).find(item => item.is_default);
  const phase = account ? fundedCurrentPhase(fundedPhases, account.id) : null;
  return phase && phase.status === 'active' ? phase.id : '';
}

function fundedTradeOptionsHtml(selectedPhaseId = null) {
  const preselect = selectedPhaseId || fundedDefaultPhaseId();
  const options = fundedTradeOptions().map(
    entry =>
      `<option value="${escapeHtml(entry.phase.id)}"${entry.phase.id === preselect ? ' selected' : ''}>` +
      `${escapeHtml(entry.account.label)} · ${escapeHtml(FUNDED_PHASE_LABELS[entry.phase.phase_type] || 'Phase')}</option>`,
  );
  return ['<option value="">Privat — zählt nicht zur Prüfung</option>', ...options].join('');
}

/* Ohne ausgeführte Migration gibt es die beiden Spalten nicht: dann kommt ein leeres Objekt
   zurück, damit der Trade-Insert unverändert durchläuft. */
function fundedTradePayload(phaseId = null) {
  if (!fundedReady) return {};
  const id = phaseId === null ? $('#tFundedPhase')?.value || '' : phaseId;
  const entry = fundedTradeOptions().find(item => item.phase.id === id);
  return {
    funded_phase_id: entry ? entry.phase.id : null,
    funded_account_id: entry ? entry.account.id : null,
  };
}

/* ---------- Laden ---------- */

function isMissingFundedSchema(error) {
  const message =
    `${error?.code || ''} ${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return (
    /42p01|42703|pgrst204|pgrst205/.test(message) ||
    (/funded_account|funded_phase|funded_payout/.test(message) &&
      /column|schema cache|does not exist|not find/.test(message))
  );
}

async function loadFunded() {
  fundedReady = true;
  const results = await Promise.all([
    sb.from('funded_accounts').select('*').order('position', { ascending: true }),
    sb.from('funded_phases').select('*').order('started_on', { ascending: false }),
    sb.from('funded_payouts').select('*').order('payout_date', { ascending: false }),
  ]);
  /* Ohne ausgeführte Migration bleibt der Rest der App unberührt: leere Listen, ein Hinweis
     auf der Karte, kein Fehler nach oben. */
  if (results.some(result => result.error && isMissingFundedSchema(result.error))) {
    fundedReady = false;
    fundedAccounts = [];
    fundedPhases = [];
    fundedPayouts = [];
    return;
  }
  const failed = results.find(result => result.error);
  if (failed) throw failed.error;
  fundedAccounts = results[0].data || [];
  fundedPhases = results[1].data || [];
  fundedPayouts = results[2].data || [];
  fundedSelectedAccountId = fundedResolveSelection(fundedAccounts, fundedSelectedAccountId);
}

/* ---------- Oberfläche ---------- */

const FUNDED_HEAD = `<div class="funded-head"><div><div class="eyebrow">FUNDED-KONTO</div><h2>Prüfung im Blick</h2></div></div>`;

function fundedProgressHtml(state) {
  /* Ohne Ziel gibt es weder Balken noch Prozentzahl — statt 0 von 0 zu rechnen. */
  if (!state.hasTarget) return '';
  const percent = state.progressPercent;
  const label = `${percent < 0 ? '−' : ''}${Math.abs(percent).toFixed(0)} %`;
  const missing = state.daysMissing
    ? ` · noch ${state.daysMissing} Handelstag${state.daysMissing === 1 ? '' : 'e'} nötig`
    : '';
  return `
    <div class="funded-progress">
      <div class="funded-progress-head">
        <span>Fortschritt zum Ziel</span>
        <b>${escapeHtml(fundedMoney(state.realized))} / ${escapeHtml(fundedMoney(state.target))}</b>
      </div>
      <div class="funded-track"><span style="width:${state.progressWidth.toFixed(1)}%"></span></div>
      <small>${escapeHtml(label + missing)}</small>
    </div>`;
}

function fundedTilesHtml(state) {
  const tiles = [
    ['Puffer heute', fundedMoney(state.dayBuffer), `Tageslimit ${fundedMoney(state.dailyLimit)}`],
    ['Puffer gesamt', fundedMoney(state.totalBuffer), `Boden ${fundedMoney(state.floor)}`],
    ['Kontostand', fundedMoney(state.balance), `Start ${fundedMoney(state.start)}`],
    [
      'Handelstage',
      String(state.tradingDays),
      state.tradeCount === 1 ? '1 Trade' : `${state.tradeCount} Trades`,
    ],
  ];
  return `<div class="funded-tiles">${tiles
    .map(
      ([label, value, meta]) =>
        `<div class="funded-tile"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong><span>${escapeHtml(meta)}</span></div>`,
    )
    .join('')}</div>`;
}

/* Deutlich, aber ohne Drama: ein Satz, was passiert ist, und was jetzt zu tun ist. */
function fundedStatusHtml(phase, state) {
  if (state.status === 'passed')
    return '<div class="funded-note good">Phase bestanden. Die nächste Stufe wartet auf dich.</div>';
  if (state.status === 'failed') {
    const reason = FUNDED_REASON_LABELS[phase.failed_reason] || 'Bruch';
    const stale = state.staleBreach
      ? '<br><span class="funded-stale">Die heutige Datenlage stützt den Eintrag nicht mehr — korrigiere ihn, wenn er falsch war.</span>'
      : '';
    return `<div class="funded-note breach">${escapeHtml(reason)} gerissen${phase.failed_on ? ` am ${escapeHtml(phase.failed_on)}` : ''}. Die Phase ist abgeschlossen, deine Trades bleiben erhalten.${stale}</div>`;
  }
  if (state.status === 'breach_daily')
    return `<div class="funded-note breach">Tagesverlustlimit gerissen: ${escapeHtml(fundedMoney(state.worstDay.value))} am ${escapeHtml(state.worstDay.date)} gegen ein Limit von ${escapeHtml(fundedMoney(state.dailyLimit))}. Trag es ein, dann steht es fest.</div>`;
  if (state.status === 'breach_max')
    return `<div class="funded-note breach">Der Kontostand hat am ${escapeHtml(state.floorBreach.date)} den Verlustboden von ${escapeHtml(fundedMoney(state.floorBreach.floor))} erreicht. Trag es ein, dann steht es fest.</div>`;
  if (state.status === 'target_days_missing')
    return `<div class="funded-note soft">Ziel erreicht. Es fehlen noch ${state.daysMissing} Handelstag${state.daysMissing === 1 ? '' : 'e'} — die sitzt du jetzt ruhig ab.</div>`;
  if (state.status === 'target_reached')
    return '<div class="funded-note good">Ziel erreicht und alle Handelstage gemacht. Du kannst die Phase abschließen.</div>';
  if (state.status === 'daily_close')
    return '<div class="funded-note warn">Der Puffer trägt kein volles Risiko mehr. Ein weiterer Verlust reißt das Tageslimit.</div>';
  return '';
}

function fundedActionsHtml(phase, state) {
  const buttons = [];
  if (state.status === 'breach_daily' || state.status === 'breach_max')
    buttons.push(
      '<button type="button" class="btn danger" onclick="advanceFundedPhase(\'failed\')">Als gerissen eintragen</button>',
    );
  if (state.status === 'target_reached')
    buttons.push(
      '<button type="button" class="btn primary" onclick="advanceFundedPhase(\'passed\')">Phase bestanden</button>',
    );
  if (phase.status === 'failed')
    buttons.push(
      '<button type="button" class="btn primary" onclick="advanceFundedPhase(\'retry\')">Neuer Versuch</button>',
      '<button type="button" class="btn" onclick="reopenFundedPhase()">Eintrag korrigieren</button>',
    );
  if (phase.status === 'passed' && phase.phase_type !== 'funded')
    buttons.push(
      '<button type="button" class="btn primary" onclick="advanceFundedPhase(\'passed\')">Nächste Phase anlegen</button>',
    );
  if (phase.phase_type === 'funded' && phase.status === 'active')
    buttons.push(
      '<button type="button" class="btn" onclick="addFundedPayout()">Auszahlung eintragen</button>',
    );
  buttons.push(
    '<button type="button" class="btn" onclick="archiveFundedAccount()">Konto archivieren</button>',
  );
  return `<div class="funded-actions">${buttons.join('')}</div>`;
}

function fundedChipsHtml() {
  const open = fundedOpenAccounts(fundedAccounts);
  if (open.length < 2) return '';
  return `<div class="funded-chips">${open
    .map(
      account =>
        `<button type="button" class="funded-chip${account.id === fundedSelectedAccountId ? ' active' : ''}" onclick="selectFundedAccount('${escapeHtml(account.id)}')">${escapeHtml(account.label)}</button>`,
    )
    .join('')}</div>`;
}

function fundedFormHtml() {
  const draft = fundedFormDraft || {};
  const accountFields =
    fundedFormMode === 'account'
      ? `<label for="fundedLabel">Name des Kontos</label>
      <input id="fundedLabel" type="text" maxlength="80" placeholder="z. B. Apex 50k">
      <label for="fundedFirm">Firma</label>
      <input id="fundedFirm" type="text" maxlength="80" placeholder="z. B. Apex">
      <label for="fundedSize">Kontogröße in USD</label>
      <input id="fundedSize" type="text" inputmode="decimal" placeholder="50000">
      <label for="fundedFee">Gebühr in USD</label>
      <input id="fundedFee" type="text" inputmode="decimal" placeholder="0">
      <label for="fundedSplit">Dein Gewinnanteil in Prozent</label>
      <input id="fundedSplit" type="text" inputmode="decimal" value="80">`
      : '';
  return `
    <form class="funded-form" onsubmit="return saveFundedForm(event)">
      <div class="funded-form-head">
        <b>${fundedFormMode === 'account' ? 'Neues Konto anlegen' : 'Neue Phase anlegen'}</b>
        <button type="button" class="btn" onclick="closeFundedForm()">Abbrechen</button>
      </div>
      ${accountFields}
      <label for="fundedPhaseType">Phase</label>
      <select id="fundedPhaseType">
        ${Object.entries(FUNDED_PHASE_LABELS)
          .map(
            ([value, label]) =>
              `<option value="${value}"${(draft.phase_type || 'phase1') === value ? ' selected' : ''}>${label}</option>`,
          )
          .join('')}
      </select>
      <label for="fundedStart">Startguthaben der Phase in USD</label>
      <input id="fundedStart" type="text" inputmode="decimal" value="${escapeHtml(draft.start_balance ?? '')}">
      <label for="fundedTarget">Gewinnziel — leer lassen, wenn es keines gibt</label>
      <input id="fundedTarget" type="text" inputmode="decimal" placeholder="6000 oder 6%"
        value="${escapeHtml(draft.profit_target_usd ?? '')}">
      <label for="fundedDaily">Tagesverlustlimit</label>
      <input id="fundedDaily" type="text" inputmode="decimal" placeholder="1250 oder 2,5%"
        value="${escapeHtml(draft.daily_loss_limit_usd ?? '')}">
      <label for="fundedMax">Gesamtverlustlimit</label>
      <input id="fundedMax" type="text" inputmode="decimal" placeholder="2500 oder 5%"
        value="${escapeHtml(draft.max_loss_usd ?? '')}">
      <label for="fundedMode">Drawdown</label>
      <select id="fundedMode">
        <option value="static"${draft.drawdown_mode === 'trailing' ? '' : ' selected'}>Fest ab Startguthaben</option>
        <option value="trailing"${draft.drawdown_mode === 'trailing' ? ' selected' : ''}>Nachlaufend ab Höchststand</option>
      </select>
      <label for="fundedMinDays">Mindesthandelstage</label>
      <input id="fundedMinDays" type="number" min="0" max="60" step="1"
        value="${escapeHtml(draft.min_trading_days ?? 0)}">
      <button type="submit" class="btn primary funded-form-save">Speichern</button>
    </form>`;
}

function renderFunded() {
  const box = $('#fundedCard');
  if (!box) return;

  if (!fundedReady) {
    box.innerHTML = `${FUNDED_HEAD}
      <div class="task-setup-notice">Funded-Tracking muss noch mit der Supabase-Migration
      20260822_funded_accounts_v1.sql eingerichtet werden. Bis dahin läuft alles andere
      unverändert weiter.</div>`;
    return;
  }

  if (fundedFormMode) {
    box.innerHTML = FUNDED_HEAD + fundedFormHtml();
    return;
  }

  const open = fundedOpenAccounts(fundedAccounts);
  if (!open.length) {
    box.innerHTML = `${FUNDED_HEAD}
      <p class="sub">Hier steht später, wie weit deine Prüfung ist: Fortschritt zum Ziel, Puffer bis
      zum Tagesverlustlimit und bis zum Gesamtverlustlimit — und was heute noch möglich ist.</p>
      <div class="funded-actions">
        <button type="button" class="btn primary" onclick="openFundedForm('account')">Konto anlegen</button>
      </div>`;
    return;
  }

  const account = open.find(item => item.id === fundedSelectedAccountId);
  if (!account) {
    box.innerHTML = `${FUNDED_HEAD}${fundedChipsHtml()}
      <p class="sub">Kein Konto ausgewählt. Wähl eins aus, dann rechnet die Karte mit.</p>`;
    return;
  }

  const phase = fundedCurrentPhase(fundedPhases, account.id);
  if (!phase) {
    box.innerHTML = `${FUNDED_HEAD}${fundedChipsHtml()}
      <p class="sub">${escapeHtml(account.label)} hat noch keine Phase. Leg die erste an, dann
      rechnet die Karte mit.</p>
      <div class="funded-actions">
        <button type="button" class="btn primary" onclick="openFundedForm('phase')">Phase anlegen</button>
      </div>`;
    return;
  }

  const settings = typeof tradingSettings === 'object' && tradingSettings ? tradingSettings : {};
  const riskPerTrade = fundedRiskPerTrade(settings);
  const todayKey = fundedDateKey();
  const state = fundedPhaseState(phase, trades, fundedPayouts, todayKey, {
    riskPerTrade,
    profitSplitPercent: account.profit_split_percent,
  });
  const plan = fundedTodayPlan(state, {
    riskPerTrade,
    maxTradesPerDay: settings.max_trades_per_day,
    tradesToday: fundedTradesOnDay(phase, trades, todayKey).length,
  });
  const doubled =
    fundedAccountPhases(fundedPhases, account.id).filter(item => item.status === 'active').length >
    1;

  box.innerHTML = `
    <div class="funded-head">
      <div>
        <div class="eyebrow">FUNDED-KONTO</div>
        <h2>${escapeHtml(account.label)}</h2>
        <p class="sub">${escapeHtml(account.firm || 'Ohne Firma')} ·
          ${escapeHtml(FUNDED_PHASE_LABELS[phase.phase_type] || phase.phase_type)},
          Versuch ${escapeHtml(String(phase.attempt || 1))} ·
          seit ${escapeHtml(phase.started_on || '–')}</p>
      </div>
      <span class="funded-badge state-${escapeHtml(state.status)}">${escapeHtml(FUNDED_PHASE_LABELS[phase.phase_type] || 'Phase')}</span>
    </div>
    ${fundedChipsHtml()}
    ${doubled ? '<div class="funded-note warn">Dieses Konto hat mehr als eine aktive Phase. Angezeigt wird die neueste — schließ die andere ab.</div>' : ''}
    ${fundedStatusHtml(phase, state)}
    ${fundedProgressHtml(state)}
    ${fundedTilesHtml(state)}
    ${
      phase.phase_type === 'funded'
        ? `<div class="funded-note soft">Verdienter Anteil bei ${escapeHtml(String(account.profit_split_percent ?? 0))} %:
        <b>${escapeHtml(fundedMoney(state.earnedShare))}</b> · bereits ausgezahlt ${escapeHtml(fundedMoney(state.paidNet))}</div>`
        : ''
    }
    ${plan.text ? `<div class="funded-today ${plan.allowed ? 'open' : 'closed'}">${escapeHtml(plan.text)}</div>` : ''}
    ${fundedActionsHtml(phase, state)}
    <p class="funded-footnote">Gerechnet wird mit abgeschlossenen Trades. Laufende Positionen zählt
    deine Firma mit, diese Karte nicht — sie ist die Kontrolle für den Tag danach, keine
    Live-Anzeige.</p>`;
}

/* ---------- Aktionen ---------- */

function fundedGuard() {
  if (fundedReady) return true;
  alert('Bitte zuerst die Funded-Migration in Supabase ausführen.');
  return false;
}

function selectFundedAccount(id) {
  fundedSelectedAccountId = id;
  renderFunded();
}

function openFundedForm(mode, draft = null) {
  if (!fundedGuard()) return;
  fundedFormMode = mode;
  fundedFormDraft = draft;
  renderFunded();
}

function closeFundedForm() {
  fundedFormMode = null;
  fundedFormDraft = null;
  renderFunded();
}

function readFundedPhaseInput(base) {
  const start = fundedParseAmount($('#fundedStart')?.value, base);
  const startBalance = start === null ? fundedNumber(base) : start;
  return {
    phase_type: $('#fundedPhaseType')?.value || 'phase1',
    start_balance: startBalance,
    profit_target_usd: fundedParseAmount($('#fundedTarget')?.value, startBalance),
    daily_loss_limit_usd: fundedParseAmount($('#fundedDaily')?.value, startBalance),
    max_loss_usd: fundedParseAmount($('#fundedMax')?.value, startBalance),
    drawdown_mode: $('#fundedMode')?.value || 'static',
    min_trading_days: Math.max(0, Math.round(fundedNumber($('#fundedMinDays')?.value))),
  };
}

/* Fängt vorher ab, was die DB-Checks sonst als englische Fehlermeldung zurückwerfen. */
function fundedValidatePhase(values) {
  if (!(values.start_balance > 0)) return 'Bitte ein Startguthaben größer als 0 eintragen.';
  if (!(values.daily_loss_limit_usd > 0))
    return 'Bitte ein Tagesverlustlimit größer als 0 eintragen.';
  if (!(values.max_loss_usd > 0)) return 'Bitte ein Gesamtverlustlimit größer als 0 eintragen.';
  if (values.profit_target_usd !== null && !(values.profit_target_usd > 0))
    return 'Das Gewinnziel muss größer als 0 sein — oder leer bleiben.';
  return '';
}

async function saveFundedForm(event) {
  event.preventDefault();
  if (!fundedGuard()) return false;
  try {
    if (fundedFormMode === 'account') await createFundedAccount();
    else await createFundedPhase();
  } catch (error) {
    alert(error.message);
  }
  return false;
}

async function createFundedAccount() {
  const label = String($('#fundedLabel')?.value || '').trim();
  if (!label) throw new Error('Bitte einen Namen für das Konto eintragen.');
  const size = fundedParseAmount($('#fundedSize')?.value, 0);
  if (!(size > 0)) throw new Error('Bitte eine Kontogröße größer als 0 eintragen.');
  const values = readFundedPhaseInput(size);
  const problem = fundedValidatePhase(values);
  if (problem) throw new Error(problem);

  const { data, error } = await sb
    .from('funded_accounts')
    .insert({
      user_id: currentUser.id,
      label,
      firm: String($('#fundedFirm')?.value || '').trim(),
      account_size: size,
      fee_usd: Math.max(0, fundedParseAmount($('#fundedFee')?.value, size) || 0),
      profit_split_percent: Math.min(
        100,
        Math.max(0, fundedParseAmount($('#fundedSplit')?.value, 0) ?? 80),
      ),
      default_drawdown_mode: values.drawdown_mode,
      /* Das erste Konto wird Standard, damit neue Trades sofort eine Zuordnung anbieten. */
      is_default: !fundedOpenAccounts(fundedAccounts).length,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;

  const { error: phaseError } = await sb
    .from('funded_phases')
    .insert({ user_id: currentUser.id, account_id: data.id, attempt: 1, ...values });
  if (phaseError) throw phaseError;

  fundedSelectedAccountId = data.id;
  fundedFormMode = null;
  fundedFormDraft = null;
  await loadFunded();
  renderFunded();
}

async function createFundedPhase() {
  const account = fundedAccounts.find(item => item.id === fundedSelectedAccountId);
  if (!account) throw new Error('Kein Konto ausgewählt.');
  const values = readFundedPhaseInput(account.account_size);
  const problem = fundedValidatePhase(values);
  if (problem) throw new Error(problem);
  const { error } = await sb.from('funded_phases').insert({
    user_id: currentUser.id,
    account_id: account.id,
    attempt: fundedNumber(fundedFormDraft?.attempt) || 1,
    ...values,
  });
  if (error) throw error;
  fundedFormMode = null;
  fundedFormDraft = null;
  await loadFunded();
  renderFunded();
}

/* Fortschreiben: bestanden, gerissen oder neuer Versuch. Die alte Phase bleibt immer stehen,
   damit die Historie eines Kontos vollständig lesbar ist. */
async function advanceFundedPhase(mode) {
  if (!fundedGuard()) return;
  const account = fundedAccounts.find(item => item.id === fundedSelectedAccountId);
  if (!account) return;
  const phase = fundedCurrentPhase(fundedPhases, account.id);
  if (!phase) return;
  const today = fundedDateKey();

  if (phase.status === 'active' && (mode === 'failed' || mode === 'passed')) {
    const state = fundedPhaseState(phase, trades, fundedPayouts, today, {
      riskPerTrade: fundedRiskPerTrade(typeof tradingSettings === 'object' ? tradingSettings : {}),
    });
    const patch =
      mode === 'failed'
        ? {
            status: 'failed',
            failed_reason: state.suggestedReason || 'manual',
            failed_on: state.suggestedDate || today,
            ended_on: state.suggestedDate || today,
          }
        : { status: 'passed', ended_on: today };
    const question =
      mode === 'failed'
        ? 'Phase als gerissen eintragen? Der Eintrag bleibt stehen, auch wenn du später einen Trade korrigierst.'
        : 'Phase als bestanden eintragen?';
    if (!confirm(question)) return;
    const { error } = await sb
      .from('funded_phases')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', phase.id);
    if (error) return alert(error.message);
    await loadFunded();
    /* Nach einem Bruch entscheidet Christian in Ruhe: neuer Versuch oder Konto archivieren. */
    if (mode === 'failed') return renderFunded();
  }

  const source = fundedCurrentPhase(fundedPhases, account.id) || phase;
  const draft = fundedNextPhaseDraft(account, source, mode === 'retry' ? 'retry' : 'passed');
  if (!draft) return renderFunded();
  openFundedForm('phase', draft);
}

async function reopenFundedPhase() {
  if (!fundedGuard()) return;
  const phase = fundedCurrentPhase(fundedPhases, fundedSelectedAccountId);
  if (!phase || phase.status === 'active') return;
  if (!confirm('Eintrag zurücknehmen und die Phase wieder laufen lassen?')) return;
  const { error } = await sb
    .from('funded_phases')
    .update({
      status: 'active',
      failed_reason: '',
      failed_on: null,
      ended_on: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', phase.id);
  if (error) return alert(error.message);
  await loadFunded();
  renderFunded();
}

/* Archivieren löscht nichts: Trades, Phasen und Auszahlungen bleiben stehen. */
async function archiveFundedAccount() {
  if (!fundedGuard()) return;
  const account = fundedAccounts.find(item => item.id === fundedSelectedAccountId);
  if (!account) return;
  if (!confirm(`${account.label} archivieren? Deine Trades und die Historie bleiben erhalten.`))
    return;
  const { error } = await sb
    .from('funded_accounts')
    .update({
      archived_at: new Date().toISOString(),
      is_default: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', account.id);
  if (error) return alert(error.message);
  fundedSelectedAccountId = null;
  await loadFunded();
  renderFunded();
}

async function addFundedPayout() {
  if (!fundedGuard()) return;
  const account = fundedAccounts.find(item => item.id === fundedSelectedAccountId);
  const phase = account ? fundedCurrentPhase(fundedPhases, account.id) : null;
  if (!phase) return;
  const gross = fundedParseAmount(prompt('Wie viel verlässt das Konto (brutto, in USD)?', ''), 0);
  if (gross === null || gross < 0) return;
  const split = fundedNumber(account.profit_split_percent);
  const net = fundedParseAmount(
    prompt('Wie viel kommt bei dir an (netto, in USD)?', ((gross * split) / 100).toFixed(2)),
    0,
  );
  if (net === null || net < 0) return;
  const state = fundedPhaseState(phase, trades, fundedPayouts, fundedDateKey(), {
    profitSplitPercent: split,
  });
  if (
    gross > state.realized &&
    !confirm('Die Auszahlung ist größer als der Gewinn dieser Phase. Trotzdem eintragen?')
  )
    return;
  const { error } = await sb.from('funded_payouts').insert({
    user_id: currentUser.id,
    account_id: account.id,
    phase_id: phase.id,
    payout_date: fundedDateKey(),
    gross_usd: gross,
    payout_usd: net,
  });
  if (error) return alert(error.message);
  await loadFunded();
  renderFunded();
}
