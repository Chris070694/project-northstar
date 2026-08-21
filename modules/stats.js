/* Kennzahlen und Verlaufsgrafiken für das Trading Journal.
   Reine Rechenfunktionen plus zwei selbst gezeichnete SVG-Charts — keine Bibliothek,
   kein Schema-Eingriff. Grundlage sind die vorhandenen Felder eines Trades:
   trade_date, pnl_usd, r_multiple, result. */

const STATS_RANGES = {
  '1M': 30,
  '3M': 90,
  all: null,
};
let statsRange = '1M';

/* Ein Trade zählt, sobald er ein Ergebnis hat. Offene bleiben außen vor. */
function statsClosedTrades(list = trades) {
  return (list || [])
    .filter(trade => (trade.result || deriveTradeResult(trade.pnl_usd)) !== 'open')
    .slice()
    .sort((a, b) => String(a.trade_date).localeCompare(String(b.trade_date)));
}

function statsInRange(list, range = statsRange) {
  const days = STATS_RANGES[range];
  if (!days) return list;
  const limit = new Date();
  limit.setDate(limit.getDate() - days);
  const key = limit.toISOString().slice(0, 10);
  return list.filter(trade => String(trade.trade_date) >= key);
}

const statsPnl = trade => Number(trade.pnl_usd) || 0;
const statsR = trade => Number(trade.r_multiple) || 0;

function statsNetPnl(list) {
  return list.reduce((sum, trade) => sum + statsPnl(trade), 0);
}

function statsNetR(list) {
  return list.reduce((sum, trade) => sum + statsR(trade), 0);
}

function statsWinRate(list) {
  if (!list.length) return 0;
  return (list.filter(trade => statsPnl(trade) > 0).length / list.length) * 100;
}

/* Bruttogewinn geteilt durch Bruttoverlust. Ohne Verluste ist der Wert nicht definiert. */
function statsProfitFactor(list) {
  const gross = list.reduce((sum, trade) => sum + Math.max(0, statsPnl(trade)), 0);
  const loss = Math.abs(list.reduce((sum, trade) => sum + Math.min(0, statsPnl(trade)), 0));
  if (!loss) return gross ? Infinity : 0;
  return gross / loss;
}

function statsAvgWinR(list) {
  const wins = list.filter(trade => statsR(trade) > 0);
  return wins.length ? wins.reduce((sum, trade) => sum + statsR(trade), 0) / wins.length : 0;
}

function statsAvgLossR(list) {
  const losses = list.filter(trade => statsR(trade) < 0);
  return losses.length ? losses.reduce((sum, trade) => sum + statsR(trade), 0) / losses.length : 0;
}

/* Erwartungswert je Trade in R: was dieses Setup im Schnitt einbringt. */
function statsExpectancyR(list) {
  if (!list.length) return 0;
  return statsNetR(list) / list.length;
}

/* Kumulierter Verlauf — Grundlage für Kurve und Drawdown. */
function statsEquityCurve(list) {
  let running = 0;
  return list.map(trade => {
    running += statsPnl(trade);
    return { date: trade.trade_date, value: running };
  });
}

/* Abstand zum bisherigen Höchststand, immer null oder negativ. */
function statsDrawdownSeries(curve) {
  let peak = 0;
  return curve.map(point => {
    peak = Math.max(peak, point.value);
    return { date: point.date, value: point.value - peak };
  });
}

function statsMaxDrawdown(curve) {
  return statsDrawdownSeries(curve).reduce((worst, point) => Math.min(worst, point.value), 0);
}

/* Nettogewinn im Verhältnis zum tiefsten Einbruch. */
function statsRecoveryFactor(list) {
  const net = statsNetPnl(list);
  const maxDd = Math.abs(statsMaxDrawdown(statsEquityCurve(list)));
  if (!maxDd) return net > 0 ? Infinity : 0;
  return net / maxDd;
}

/* Aktuelle Serie: positiv = Gewinne am Stück, negativ = Verluste am Stück. */
function statsCurrentStreak(list) {
  let streak = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    const pnl = statsPnl(list[i]);
    if (pnl === 0) break;
    if (streak === 0) streak = pnl > 0 ? 1 : -1;
    else if (streak > 0 && pnl > 0) streak++;
    else if (streak < 0 && pnl < 0) streak--;
    else break;
  }
  return streak;
}

function statsDailyPnl(list) {
  const byDay = new Map();
  list.forEach(trade => {
    const key = trade.trade_date;
    byDay.set(key, (byDay.get(key) || 0) + statsPnl(trade));
  });
  return [...byDay.entries()]
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .map(([date, value]) => ({ date, value }));
}

function formatStatsMoney(value) {
  if (!Number.isFinite(value)) return '–';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatStatsRatio(value) {
  if (!Number.isFinite(value)) return '∞';
  return value.toFixed(2);
}

function formatStatsR(value) {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded > 0 ? '+' : ''}${rounded}R`;
}

/* ---------- Charts: von Hand gezeichnet, damit keine Bibliothek nötig ist ---------- */

const STATS_CHART = { width: 640, height: 150, padding: 6 };

function statsChartPoints(values, width, height, padding) {
  if (!values.length) return [];
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const stepX = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;
  return values.map((value, index) => ({
    x: padding + index * stepX,
    y: padding + (1 - (value - min) / span) * (height - padding * 2),
  }));
}

function statsEquityChart(curve) {
  const { width, height, padding } = STATS_CHART;
  if (curve.length < 2)
    return '<p class="stats-empty">Ab dem zweiten abgeschlossenen Trade zeichnet sich hier deine Kurve.</p>';
  const points = statsChartPoints(
    curve.map(point => point.value),
    width,
    height,
    padding,
  );
  const line = points.map(point => `${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' L ');
  const area = `M ${line} L ${points[points.length - 1].x.toFixed(1)} ${height} L ${points[0].x.toFixed(1)} ${height} Z`;
  const last = curve[curve.length - 1].value;
  return `<svg class="stats-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img"
      aria-label="Kumulierter Gewinnverlauf, aktuell ${formatStatsMoney(last)}">
      <defs><linearGradient id="statsEquityFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#70e5ff" stop-opacity="0.26"></stop>
        <stop offset="1" stop-color="#70e5ff" stop-opacity="0"></stop>
      </linearGradient></defs>
      <path d="${area}" fill="url(#statsEquityFill)"></path>
      <path d="M ${line}" fill="none" stroke="#70e5ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>`;
}

/* Tagesergebnisse: Vorzeichen steckt in der Richtung des Balkens, die Farbe wiederholt es nur. */
function statsDailyChart(days) {
  if (!days.length)
    return '<p class="stats-empty">Noch keine abgeschlossenen Trades in diesem Zeitraum.</p>';
  const shown = days.slice(-30);
  const peak = Math.max(...shown.map(day => Math.abs(day.value)), 1);
  const bars = shown
    .map(day => {
      const share = Math.abs(day.value) / peak;
      const height = Math.max(3, Math.round(share * 46));
      const positive = day.value >= 0;
      return `<div class="stats-day" title="${escapeHtml(day.date)}: ${escapeHtml(formatStatsMoney(day.value))}">
        <div class="stats-day-top">${positive ? `<i style="height:${height}px" class="pos"></i>` : ''}</div>
        <div class="stats-day-bottom">${positive ? '' : `<i style="height:${height}px" class="neg"></i>`}</div>
      </div>`;
    })
    .join('');
  return `<div class="stats-days" role="img" aria-label="Tagesergebnisse der letzten ${shown.length} Handelstage">${bars}</div>`;
}

function setStatsRange(range) {
  if (!(range in STATS_RANGES)) return;
  statsRange = range;
  renderTradingStats();
}

function renderTradingStats() {
  const box = $('#tradingStats');
  if (!box) return;
  const closed = statsInRange(statsClosedTrades());
  const curve = statsEquityCurve(closed);
  const streak = statsCurrentStreak(closed);

  const tiles = [
    ['Netto', formatStatsMoney(statsNetPnl(closed)), statsNetPnl(closed) >= 0 ? 'pos' : 'neg'],
    ['Profit Factor', formatStatsRatio(statsProfitFactor(closed)), ''],
    ['Trefferquote', closed.length ? `${statsWinRate(closed).toFixed(0)} %` : '–', ''],
    ['Expectancy', closed.length ? formatStatsR(statsExpectancyR(closed)) : '–', ''],
    ['Ø Gewinn', closed.length ? formatStatsR(statsAvgWinR(closed)) : '–', ''],
    ['Ø Verlust', closed.length ? formatStatsR(statsAvgLossR(closed)) : '–', ''],
    ['Max Drawdown', formatStatsMoney(statsMaxDrawdown(curve)), 'neg'],
    ['Recovery Factor', formatStatsRatio(statsRecoveryFactor(closed)), ''],
    [
      'Serie',
      streak === 0
        ? '–'
        : `${Math.abs(streak)} ${Math.abs(streak) === 1 ? (streak > 0 ? 'Gewinn' : 'Verlust') : streak > 0 ? 'Gewinne' : 'Verluste'}`,
      streak > 0 ? 'pos' : streak < 0 ? 'neg' : '',
    ],
    ['Trades', String(closed.length), ''],
  ];

  const rangeButtons = Object.keys(STATS_RANGES)
    .map(
      key =>
        `<button type="button" class="stats-range${key === statsRange ? ' active' : ''}" onclick="setStatsRange('${key}')">${key === 'all' ? 'Alles' : key}</button>`,
    )
    .join('');

  box.innerHTML = `
    <div class="stats-head">
      <div><div class="eyebrow">Auswertung</div><h2>Kennzahlen</h2></div>
      <div class="stats-ranges">${rangeButtons}</div>
    </div>
    <div class="stats-grid">
      ${tiles
        .map(
          ([label, value, tone]) =>
            `<div class="stats-tile"><small>${escapeHtml(label)}</small><strong class="${tone}">${escapeHtml(value)}</strong></div>`,
        )
        .join('')}
    </div>
    <div class="stats-figure">
      <div class="stats-figure-title">Kapitalkurve</div>
      ${statsEquityChart(curve)}
    </div>
    <div class="stats-figure">
      <div class="stats-figure-title">Tagesergebnis</div>
      ${statsDailyChart(statsDailyPnl(closed))}
    </div>`;
}
