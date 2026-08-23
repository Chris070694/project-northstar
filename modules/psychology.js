/* Psychologie-Auswertung des Trading-Journals.

   Grundlage ist allein das globale trades-Array, das loadTrades() ohnehin füllt:
   keine eigene Supabase-Abfrage, keine neue Spalte, keine Migration. Dieses Modul
   kann daher nichts brechen, was nicht schon in loadTrades() bricht.

   Gerechnet wird mit statsClosedTrades / statsPnl / statsR aus stats.js, damit
   "Gewinn" hier dasselbe heißt wie in den Kennzahlen daneben: pnl_usd > 0.

   Drei Eigenheiten der Daten bestimmen fast alles hier:
   1. emotion, emotion_after, execution_score und followed_plan haben Vorgabewerte.
      Ein nie berührtes Feld sieht aus wie eine bewusste Angabe. Deshalb zählen für
      diese Felder nur Trades mit Checkliste, und der Altbestand wird genannt.
   2. r_multiple ist 0, wenn beim Speichern kein Risiko stand — R ist dann unbekannt,
      nicht null. Solche Trades fallen aus jeder R-Rechnung heraus und werden gezählt.
   3. Unter der Mindestmenge zeigt die Karte Rohzahlen oder den Aufbaustand,
      niemals eine Prozentzahl und niemals ein nacktes Zeichen. */

const PSY_MIN_ANZEIGE = 5;
const PSY_MIN_QUOTE = 12;
const PSY_MIN_VERGLEICH = 20;
const PSY_MIN_MITTEL_R = 8;
const PSY_MIN_RANGLISTE = 8;
const PSY_MIN_KORRELATION = 25;
const PSY_MIN_MODUL = 10;
const PSY_MIN_DOKU = 10;

/* Steht fast alles auf Ruhig, misst A1 die Voreinstellung des Formulars. */
const PSY_RUHIG_WARNUNG = 0.85;
const PSY_LEGACY_LABEL = 'Ältere Regelformulierung';
const PSY_GEFASST = ['Ruhig', 'Erleichtert'];
const PSY_UEBERMUT = ['Gierig', 'FOMO'];
const PSY_LESELISTE_MAX = 5;

/* ---------- Zugriff auf andere Module, ohne eine Ladereihenfolge zu erzwingen ---------- */

function psyChecks() {
  return typeof TRADE_CHECKS !== 'undefined' && Array.isArray(TRADE_CHECKS) ? TRADE_CHECKS : [];
}

function psyHasChecklist(trade) {
  if (typeof hasTradeChecklist === 'function') return hasTradeChecklist(trade);
  return Boolean(trade?.pre_trade_checklist && Object.keys(trade.pre_trade_checklist).length);
}

/* Ohne Cockpit-Migration fehlen die ausgewerteten Spalten komplett — dann sagt die
   Karte das, statt Nullen zu zeigen. Gleiches Muster wie isMissingTradingCockpitSchema. */
function psySchemaReady() {
  return typeof tradingCockpitReady === 'undefined' ? true : Boolean(tradingCockpitReady);
}

function psyTrades(list) {
  if (Array.isArray(list)) return list;
  return typeof trades !== 'undefined' && Array.isArray(trades) ? trades : [];
}

/* ---------- Rechenwerkzeug ---------- */

/* R ist nur verwertbar, wenn es wirklich gemessen wurde. r_multiple === 0 bei einem
   Ergebnis ungleich null heißt "Risiko war 0, R unbekannt" — nicht "R war null". */
function psyHasR(trade) {
  const raw = Number(trade?.r_multiple);
  if (!Number.isFinite(raw)) return false;
  if (raw === 0 && statsPnl(trade) !== 0) return false;
  return true;
}

/* Wilson-Intervall, 95 %. Aus "3 von 3" wird 100 % (44–100 %) statt einer Gewissheit. */
function psyWilson(k, n) {
  if (!n || n < 0) return null;
  const z = 1.96;
  const z2 = z * z;
  const center = (k + z2 / 2) / (n + z2);
  const spread = (z / (n + z2)) * Math.sqrt((k * (n - k)) / n + z2 / 4);
  return {
    k,
    n,
    rate: k / n,
    low: Math.max(0, center - spread),
    high: Math.min(1, center + spread),
  };
}

/* sum ist Buchhaltung über die Vergangenheit und immer gültig, mean eine Behauptung
   über die Zukunft. Bei n < 2 gibt es keinen Standardfehler — null, nicht Infinity. */
function psyMeanR(list) {
  const values = (list || []).filter(psyHasR).map(statsR);
  const n = values.length;
  const sum = values.reduce((acc, value) => acc + value, 0);
  if (!n) return { n: 0, sum: 0, mean: null, se: null };
  const mean = sum / n;
  if (n < 2) return { n, sum, mean, se: null };
  const varianz = values.reduce((acc, value) => acc + (value - mean) ** 2, 0) / (n - 1);
  return { n, sum, mean, se: Math.sqrt(varianz / n) };
}

/* Durchschnittsränge bei Bindungen — Score 7 ist der Vorgabewert und dominiert. */
function psyRanks(values) {
  const order = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value || a.index - b.index);
  const ranks = new Array(values.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1].value === order[i].value) j++;
    const rank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[order[k].index] = rank;
    i = j + 1;
  }
  return ranks;
}

/* Spearman über die Tie-korrigierte Pearson-Formel auf Rängen. Die 6Σd²-Kurzform
   ist bei Bindungen schlicht falsch, und Bindungen sind hier die Regel. */
function psySpearman(pairs) {
  const clean = (pairs || []).filter(
    pair => Number.isFinite(Number(pair?.[0])) && Number.isFinite(Number(pair?.[1])),
  );
  const n = clean.length;
  if (n < 2) return null;
  const rx = psyRanks(clean.map(pair => Number(pair[0])));
  const ry = psyRanks(clean.map(pair => Number(pair[1])));
  const mx = rx.reduce((acc, value) => acc + value, 0) / n;
  const my = ry.reduce((acc, value) => acc + value, 0) / n;
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i++) {
    cov += (rx[i] - mx) * (ry[i] - my);
    vx += (rx[i] - mx) ** 2;
    vy += (ry[i] - my) ** 2;
  }
  const denom = Math.sqrt(vx * vy);
  /* Alle Werte gleich: es gibt keine Rangfolge, also auch keinen Koeffizienten. */
  if (!denom) return null;
  return { rho: cov / denom, n };
}

/* ---------- Textbausteine ---------- */

const psyCount = (n, ein, viele) => `${n} ${n === 1 ? ein : viele}`;

function psyPercent(value) {
  if (!Number.isFinite(value)) return 'unbekannt';
  return `${Math.round(value * 100)} %`;
}

function psyR(value) {
  if (!Number.isFinite(value)) return 'unbekannt';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}R`;
}

function psyRho(value) {
  if (!Number.isFinite(value)) return 'unbekannt';
  return value.toFixed(2);
}

/* ---------- Gruppen ---------- */

function psyGroup(label, list) {
  const menge = list || [];
  const wins = menge.filter(trade => statsPnl(trade) > 0).length;
  const mitR = menge.filter(psyHasR);
  return {
    label,
    trades: menge,
    n: menge.length,
    wins,
    quote: psyWilson(wins, menge.length),
    r: psyMeanR(menge),
    erwartung: mitR.length ? statsExpectancyR(mitR) : null,
  };
}

/* Ein Richtungssatz erst bei genug Trades je Gruppe UND getrennten Intervallen.
   Lieber eine Erkenntnis zu spät als eine falsche zu früh. */
function psyDirection(a, b) {
  if (a.n < PSY_MIN_VERGLEICH || b.n < PSY_MIN_VERGLEICH)
    return {
      klar: false,
      text: `Für einen Richtungssatz braucht CPRB ${PSY_MIN_VERGLEICH} Trades je Gruppe — hier sind es ${a.n} (${a.label}) und ${b.n} (${b.label}).`,
    };
  if (!a.quote || !b.quote) return { klar: false, text: 'Eine der beiden Gruppen ist leer.' };
  const disjunkt = a.quote.high < b.quote.low || b.quote.high < a.quote.low;
  if (!disjunkt)
    return {
      klar: false,
      text: 'Die Intervalle überlappen sich. Beide Gruppen sind mit demselben wahren Wert vereinbar — deshalb steht hier bewusst kein Satz.',
    };
  const vorn = a.quote.rate > b.quote.rate ? a : b;
  return {
    klar: true,
    text: `${vorn.label} liegt vorn, und die Intervalle überschneiden sich nicht. Das ist ein Zusammenhang, keine Ursache.`,
  };
}

/* ---------- A1 · A2 Gefühlslage vor dem Trade ---------- */

function psyEmotionAuswertung(cockpit) {
  const mit = cockpit.filter(trade => String(trade.emotion || '').trim() !== '');
  const ruhig = mit.filter(trade => trade.emotion === 'Ruhig');
  const unruhig = mit.filter(trade => trade.emotion !== 'Ruhig');
  const gruppen = [psyGroup('Ruhig', ruhig), psyGroup('Unruhig', unruhig)];
  const anteilRuhig = mit.length ? ruhig.length / mit.length : null;
  const vorgabeVerdacht = anteilRuhig !== null && anteilRuhig > PSY_RUHIG_WARNUNG;
  const einzeln = new Map();
  mit.forEach(trade => {
    const key = String(trade.emotion);
    if (!einzeln.has(key)) einzeln.set(key, []);
    einzeln.get(key).push(trade);
  });
  const werte = [...einzeln.entries()]
    .map(([label, list]) => psyGroup(label, list))
    .sort((a, b) => b.n - a.n);
  return {
    n: mit.length,
    ohneAngabe: cockpit.length - mit.length,
    gruppen,
    anteilRuhig,
    vorgabeVerdacht,
    /* Kein Richtungssatz, solange die Karte womöglich nur die Voreinstellung misst. */
    richtung: vorgabeVerdacht
      ? {
          klar: false,
          text: 'Kein Richtungssatz, solange fast alle Trades auf dem Vorgabewert stehen.',
        }
      : psyDirection(gruppen[0], gruppen[1]),
    werte,
    rangfaehig: werte.filter(wert => wert.n >= PSY_MIN_QUOTE).length >= 2,
  };
}

/* ---------- A3 Plan eingehalten ---------- */

function psyPlanAuswertung(cockpit) {
  const mitPlan = psyGroup('Nach Plan', cockpit.filter(trade => trade.followed_plan === true));
  const ohnePlan = psyGroup('Ohne Plan', cockpit.filter(trade => trade.followed_plan !== true));
  const planR = mitPlan.trades.filter(psyHasR);
  const abweichR = psyMeanR(ohnePlan.trades);
  /* Rechnung, keine Messung: unterstellt, die Abweichler wären wie die Plan-Trades gelaufen. */
  const preis =
    mitPlan.n >= PSY_MIN_VERGLEICH && planR.length && abweichR.n
      ? abweichR.sum - abweichR.n * statsExpectancyR(planR)
      : null;
  return {
    n: cockpit.length,
    gruppen: [mitPlan, ohnePlan],
    richtung: psyDirection(mitPlan, ohnePlan),
    preis,
    preisBasis: abweichR.n,
  };
}

/* ---------- A4 Regelbrüche ---------- */

function psyRuleAuswertung(cockpit) {
  const basis = cockpit.filter(psyHasR);
  const bekannt = new Set(psyChecks().map(item => item.label));
  const topf = new Map();
  const topfFor = label => {
    if (!topf.has(label))
      topf.set(label, { label, vorkommen: 0, summeR: 0, isoliert: [], trades: [] });
    return topf.get(label);
  };
  /* Reihenfolge der Checkliste zuerst, damit die Tabelle stabil bleibt. */
  psyChecks().forEach(item => topfFor(item.label));
  basis.forEach(trade => {
    const breaks = Array.isArray(trade.rule_breaks) ? trade.rule_breaks : [];
    breaks.forEach(raw => {
      const label = bekannt.has(raw) ? raw : PSY_LEGACY_LABEL;
      const eintrag = topfFor(label);
      eintrag.vorkommen++;
      eintrag.summeR += statsR(trade);
      eintrag.trades.push(trade);
      if (breaks.length === 1) eintrag.isoliert.push(trade);
    });
  });
  const zeilen = [...topf.values()].map(eintrag => ({
    ...eintrag,
    isoliertR: psyMeanR(eintrag.isoliert),
  }));
  const rangfaehig = zeilen
    .filter(zeile => zeile.isoliertR.n >= PSY_MIN_RANGLISTE)
    .sort((a, b) => a.isoliertR.mean - b.isoliertR.mean);
  let spitze = null;
  if (rangfaehig.length === 1) spitze = { zeile: rangfaehig[0], eindeutig: true };
  else if (rangfaehig.length > 1) {
    const [erst, zweit] = rangfaehig;
    const abstand = zweit.isoliertR.mean - erst.isoliertR.mean;
    const fehler = (erst.isoliertR.se || 0) + (zweit.isoliertR.se || 0);
    spitze = { zeile: erst, eindeutig: abstand > fehler };
  }
  /* Vergleichsmaß für den Spitzenreiter: alle übrigen Trades mit verwertbarem R. */
  const rest = spitze
    ? psyMeanR(basis.filter(trade => !spitze.zeile.isoliert.includes(trade)))
    : psyMeanR([]);
  return {
    n: basis.length,
    ohneR: cockpit.length - basis.length,
    zeilen: zeilen.sort((a, b) => b.vorkommen - a.vorkommen),
    spitze,
    rest,
  };
}

/* ---------- A5 Ausführung ---------- */

function psyExecutionAuswertung(cockpit) {
  const basis = cockpit.filter(psyHasR);
  const mitScore = basis.filter(trade => Number(trade.execution_score) > 0);
  const paare = mitScore.map(trade => [Number(trade.execution_score), statsR(trade)]);
  const anzahlChecks = psyChecks().length || 8;
  /* Gegentest: die Häkchen entstehen aus einer Liste, die vor dem Speichern
     abgearbeitet wird — weniger rückschauanfällig als ein Regler, aber im selben Formular. */
  const haken = basis
    .filter(trade => Array.isArray(trade.rule_breaks))
    .map(trade => [anzahlChecks - trade.rule_breaks.length, statsR(trade)]);
  const baender = [
    { label: '1–4', min: 1, max: 4 },
    { label: '5–7', min: 5, max: 7 },
    { label: '8–10', min: 8, max: 10 },
  ].map(band => ({
    ...band,
    r: psyMeanR(
      mitScore.filter(trade => {
        const score = Number(trade.execution_score);
        return score >= band.min && score <= band.max;
      }),
    ),
  }));
  return {
    n: paare.length,
    ohneScore: basis.length - mitScore.length,
    spearman: paare.length >= PSY_MIN_KORRELATION ? psySpearman(paare) : null,
    gegentest: haken.length >= PSY_MIN_KORRELATION ? psySpearman(haken) : null,
    gegentestN: haken.length,
    baender,
  };
}

/* ---------- A6 Stimmung danach ---------- */

function psyAfterAuswertung(cockpit) {
  const basis = cockpit.filter(trade => String(trade.emotion_after || '').trim() !== '');
  const gruppen = [
    { label: 'Nach Gewinn', list: basis.filter(trade => statsPnl(trade) > 0) },
    { label: 'Nach Verlust', list: basis.filter(trade => statsPnl(trade) < 0) },
    { label: 'Break-even', list: basis.filter(trade => statsPnl(trade) === 0) },
  ].map(gruppe => {
    const verteilung = new Map();
    gruppe.list.forEach(trade => {
      const key = String(trade.emotion_after);
      verteilung.set(key, (verteilung.get(key) || 0) + 1);
    });
    return {
      label: gruppe.label,
      n: gruppe.list.length,
      verteilung: [...verteilung.entries()]
        .map(([wert, anzahl]) => ({ wert, anzahl }))
        .sort((a, b) => b.anzahl - a.anzahl),
    };
  });
  const verluste = basis.filter(trade => statsPnl(trade) < 0);
  const gewinne = basis.filter(trade => statsPnl(trade) > 0);
  const gefasst = verluste.filter(trade => PSY_GEFASST.includes(trade.emotion_after)).length;
  const uebermut = gewinne.filter(trade => PSY_UEBERMUT.includes(trade.emotion_after)).length;
  return {
    n: basis.length,
    ohneAngabe: cockpit.length - basis.length,
    gruppen,
    fassung: { n: verluste.length, k: gefasst, quote: psyWilson(gefasst, verluste.length) },
    uebermut: { n: gewinne.length, k: uebermut, quote: psyWilson(uebermut, gewinne.length) },
  };
}

/* ---------- A7 Selbstwiderspruch: gilt ab dem ersten Trade ---------- */

function psyContradictions(cockpit) {
  const planTrotzOffen = cockpit.filter(
    trade => trade.followed_plan === true && (trade.rule_breaks || []).length > 0,
  );
  const ruhigBehauptet = cockpit.filter(
    trade =>
      trade.pre_trade_checklist?.emotion === true &&
      String(trade.emotion || '').trim() !== '' &&
      trade.emotion !== 'Ruhig',
  );
  return { planTrotzOffen, ruhigBehauptet };
}

/* ---------- A8 Dokumentationsdisziplin ---------- */

function psyDocAuswertung(closed) {
  const gefuellt = (trade, feld) => String(trade[feld] || '').trim() !== '';
  const verluste = closed.filter(trade => statsPnl(trade) < 0);
  return {
    n: closed.length,
    mistakes: closed.filter(trade => gefuellt(trade, 'mistakes')).length,
    learning: closed.filter(trade => gefuellt(trade, 'learning')).length,
    verlusteN: verluste.length,
    verlusteLearning: verluste.filter(trade => gefuellt(trade, 'learning')).length,
  };
}

/* ---------- Gesamtauswertung ---------- */

function psyAuswertung(list, today = new Date()) {
  const quelle = psyTrades(list);
  const closed = statsClosedTrades(quelle);
  const cockpit = closed.filter(psyHasChecklist);
  return {
    today,
    schemaReady: psySchemaReady(),
    gesamt: quelle.length,
    offen: quelle.length - closed.length,
    closed,
    cockpit,
    altbestand: closed.length - cockpit.length,
    ohneR: cockpit.filter(trade => !psyHasR(trade)).length,
    aufbau: cockpit.length < PSY_MIN_MODUL,
    emotion: psyEmotionAuswertung(cockpit),
    plan: psyPlanAuswertung(cockpit),
    regeln: psyRuleAuswertung(cockpit),
    ausfuehrung: psyExecutionAuswertung(cockpit),
    danach: psyAfterAuswertung(cockpit),
    widerspruch: psyContradictions(cockpit),
    doku: psyDocAuswertung(closed),
  };
}

/* ---------- Ausgabe ---------- */

/* Rohzahlen sind Tatsachen, Prozente sind Behauptungen. Unter der Schwelle also
   "3 von 7", darunter nur der Aufbaustand — nie ein nacktes Zeichen. */
function psyQuoteText(gruppe) {
  if (gruppe.n < PSY_MIN_ANZEIGE)
    return `${psyCount(gruppe.n, 'Trade', 'Trades')} — ab ${PSY_MIN_QUOTE} zeigt CPRB hier eine Quote.`;
  if (gruppe.n < PSY_MIN_QUOTE)
    return `${gruppe.wins} von ${gruppe.n} gewonnen — ab ${PSY_MIN_QUOTE} Trades kommt eine Quote dazu.`;
  return `${psyPercent(gruppe.quote.rate)} (${psyPercent(gruppe.quote.low)}–${psyPercent(gruppe.quote.high)}) über ${gruppe.n} Trades`;
}

function psyRText(r) {
  if (!r.n) return `Kein Trade mit verwertbarem R.`;
  if (r.n < PSY_MIN_MITTEL_R)
    return `Summe ${psyR(r.sum)} über ${psyCount(r.n, 'Trade', 'Trades')} mit R — ein Mittelwert ab ${PSY_MIN_MITTEL_R}.`;
  const fehler = r.se === null ? '' : ` (±${r.se.toFixed(2)})`;
  return `Ø ${psyR(r.mean)}${fehler} je Trade, Summe ${psyR(r.sum)} über ${r.n} Trades.`;
}

function psyGroupCard(gruppe) {
  return `<div class="psy-group">
      <small>${escapeHtml(gruppe.label)}</small>
      <strong>${escapeHtml(psyQuoteText(gruppe))}</strong>
      <span>${escapeHtml(psyRText(gruppe.r))}</span>
    </div>`;
}

function psySaySection(richtung) {
  return `<p class="psy-say ${richtung.klar ? 'klar' : 'offen'}">${escapeHtml(richtung.text)}</p>`;
}

function psyTradeChips(list, leer) {
  if (!list.length) return `<p class="psy-sub">${escapeHtml(leer)}</p>`;
  return `<div class="psy-chips">${list
    .map(
      trade =>
        `<button type="button" class="psy-chip" onclick="showTradeDetail('${escapeHtml(String(trade.id ?? ''))}')">${escapeHtml(trade.trade_date || 'ohne Datum')} · ${escapeHtml(trade.market || 'ohne Markt')}</button>`,
    )
    .join('')}</div>`;
}

function psyContradictionHtml(daten) {
  const w = daten.widerspruch;
  return `<section class="psy-block">
      <h3>Selbstwiderspruch</h3>
      <p class="psy-sub">Keine Statistik, sondern Tatsachen über einzelne Datensätze — gültig ab dem ersten Trade.</p>
      <div class="psy-contra">
        <div>
          <strong>${psyCount(w.planTrotzOffen.length, 'Trade', 'Trades')}</strong>
          <span>„Plan eingehalten“ angehakt, obwohl noch Regeln offen waren.</span>
          ${psyTradeChips(w.planTrotzOffen, 'Kein solcher Trade.')}
        </div>
        <div>
          <strong>${psyCount(w.ruhigBehauptet.length, 'Trade', 'Trades')}</strong>
          <span>„Ruhig genug“ bestätigt, während die Gefühlslage nicht auf Ruhig stand.</span>
          ${psyTradeChips(w.ruhigBehauptet, 'Kein solcher Trade.')}
        </div>
      </div>
    </section>`;
}

function psyEmotionHtml(daten) {
  const e = daten.emotion;
  const warnung = e.vorgabeVerdacht
    ? `<p class="psy-warn">Fast alle deine Trades stehen auf Ruhig (${psyPercent(e.anteilRuhig)}) — das ist der Vorgabewert des Formulars. Hier wird gerade eine Voreinstellung gemessen, keine Stimmung.</p>`
    : '';
  const liste = e.werte.length
    ? `<ul class="psy-list">${e.werte
        .map(
          wert =>
            `<li><span>${escapeHtml(wert.label)}</span><b>${escapeHtml(
              wert.n >= PSY_MIN_QUOTE
                ? `${psyPercent(wert.quote.rate)} (${psyPercent(wert.quote.low)}–${psyPercent(wert.quote.high)}) · ${wert.n} Trades`
                : `${wert.wins} von ${wert.n} gewonnen`,
            )}</b></li>`,
        )
        .join('')}</ul>`
    : `<p class="psy-sub">Noch kein Cockpit-Trade mit Angabe zur Gefühlslage.</p>`;
  return `<section class="psy-block">
      <h3>Gefühlslage vor dem Trade</h3>
      <p class="psy-sub">${escapeHtml(`${psyCount(e.n, 'Trade', 'Trades')} mit Angabe${e.ohneAngabe ? `, ${e.ohneAngabe} ohne` : ''}.`)}</p>
      ${warnung}
      <div class="psy-groups">${e.gruppen.map(psyGroupCard).join('')}</div>
      ${psySaySection(e.richtung)}
      <h4>Die einzelnen Gefühle</h4>
      ${liste}
      <p class="psy-sub">${escapeHtml(
        e.rangfaehig
          ? `Eine Rangfolge trägt, sobald mehrere Gefühle über ${PSY_MIN_QUOTE} Trades liegen — das ist hier der Fall.`
          : `Eine Rangfolge der Gefühle zeigt CPRB erst, wenn mindestens zwei Werte ${PSY_MIN_QUOTE} Trades erreichen.`,
      )}</p>
    </section>`;
}

function psyPlanHtml(daten) {
  const p = daten.plan;
  const preis =
    p.preis === null
      ? `<p class="psy-sub">${escapeHtml(`Den Preis des Abweichens rechnet CPRB ab ${PSY_MIN_VERGLEICH} Plan-Trades mit verwertbarem R.`)}</p>`
      : `<div class="psy-preis">
          <strong>${escapeHtml(psyR(p.preis))}</strong>
          <span>${escapeHtml(`Preis des Abweichens über ${psyCount(p.preisBasis, 'Trade', 'Trades')} ohne Plan.`)}</span>
          <em>Diese Zahl unterstellt, dass die Abweichler wie deine Plan-Trades gelaufen wären. Das steht nirgends in den Daten.</em>
        </div>`;
  return `<section class="psy-block">
      <h3>Mit und ohne eingehaltenen Plan</h3>
      <p class="psy-sub">Nur Trades mit Checkliste: „nicht nach Plan“ ist der Vorgabewert der Spalte, und ein Vorgabewert ist keine Antwort.</p>
      <div class="psy-groups">${p.gruppen.map(psyGroupCard).join('')}</div>
      ${psySaySection(p.richtung)}
      ${preis}
    </section>`;
}

function psyRuleHtml(daten) {
  const r = daten.regeln;
  const zeilen = r.zeilen.length
    ? r.zeilen
        .map(
          zeile => `<tr>
            <td>${escapeHtml(zeile.label)}</td>
            <td>${zeile.vorkommen}</td>
            <td>${escapeHtml(zeile.vorkommen ? psyR(zeile.summeR) : 'kein Vorkommen')}</td>
            <td>${zeile.isoliert.length}</td>
            <td>${escapeHtml(
              zeile.isoliertR.n >= PSY_MIN_RANGLISTE
                ? `${psyR(zeile.isoliertR.mean)}${zeile.isoliertR.se === null ? '' : ` (±${zeile.isoliertR.se.toFixed(2)})`}`
                : `${zeile.isoliertR.n} von ${PSY_MIN_RANGLISTE} isolierten Fällen`,
            )}</td>
          </tr>`,
        )
        .join('')
    : '<tr><td colspan="5">Noch kein Cockpit-Trade mit verwertbarem R.</td></tr>';
  let satz = `Ein Ø-R-Wert je Regel erscheint ab ${PSY_MIN_RANGLISTE} isolierten Fällen — nur dort ist der Verlust einer einzigen Regel zurechenbar.`;
  if (r.spitze && r.spitze.eindeutig)
    satz = `Wenn du „${r.spitze.zeile.label}“ als Einziges überspringst, liegt dein Schnitt bei ${psyR(r.spitze.zeile.isoliertR.mean)} statt ${psyR(r.rest.mean)} über alle anderen Trades. ${psyCount(r.spitze.zeile.isoliert.length, 'isolierter Fall', 'isolierte Fälle')}.`;
  else if (r.spitze) satz = 'Mehrere Regelbrüche liegen gleichauf — kein Platz 1.';
  return `<section class="psy-block">
      <h3>Welcher Regelbruch am teuersten ist</h3>
      <p class="psy-sub">${escapeHtml(`Grundlage: ${psyCount(r.n, 'Cockpit-Trade', 'Cockpit-Trades')} mit verwertbarem R${r.ohneR ? `, ${r.ohneR} ohne` : ''}. Ein Trade mit drei Regelbrüchen zählt in drei Töpfe — deshalb die Spalte „Isoliert“.`)}</p>
      <div class="psy-scroll"><table class="psy-table">
        <thead><tr><th>Regel</th><th>Vorkommen</th><th>ΣR</th><th>Isoliert</th><th>Ø R isoliert</th></tr></thead>
        <tbody>${zeilen}</tbody>
      </table></div>
      <p class="psy-say ${r.spitze && r.spitze.eindeutig ? 'klar' : 'offen'}">${escapeHtml(satz)}</p>
    </section>`;
}

/* Genug Paare heißt noch nicht rechenbar: sind alle Werte gleich, gibt es keine
   Rangfolge und damit keinen Koeffizienten. Das sagt die Karte, statt zu schweigen. */
function psyRhoText(ergebnis, n, gleichSatz) {
  if (ergebnis)
    return `rho = ${psyRho(ergebnis.rho)} über ${ergebnis.n} Trades. Das ist ein Zusammenhang, keine Ursache.`;
  if (n >= PSY_MIN_KORRELATION) return gleichSatz;
  return `Eine Rangkorrelation zeigt CPRB ab ${PSY_MIN_KORRELATION} Paaren — hier sind es ${n}.`;
}

function psyExecutionHtml(daten) {
  const a = daten.ausfuehrung;
  const rhoText = psyRhoText(
    a.spearman,
    a.n,
    'Alle Ausführungsnoten sind gleich — meist der Vorgabewert 7. Ohne Unterschiede gibt es keinen Zusammenhang zu rechnen.',
  );
  const gegenText = `Gegentest über die Häkchen statt den Regler: ${psyRhoText(
    a.gegentest,
    a.gegentestN,
    'Alle Trades haben gleich viele Häkchen — auch hier gibt es nichts zu rechnen.',
  )}`;
  const baender = a.baender
    .map(
      band => `<div class="psy-group">
        <small>${escapeHtml(`Score ${band.label}`)}</small>
        <strong>${escapeHtml(
          band.r.n >= PSY_MIN_MITTEL_R
            ? `Ø ${psyR(band.r.mean)}${band.r.se === null ? '' : ` (±${band.r.se.toFixed(2)})`}`
            : `${psyCount(band.r.n, 'Trade', 'Trades')} mit R`,
        )}</strong>
        <span>${escapeHtml(
          band.r.n >= PSY_MIN_MITTEL_R
            ? `${band.r.n} Trades, Summe ${psyR(band.r.sum)}`
            : `Ein Ø-Wert ab ${PSY_MIN_MITTEL_R} Trades je Band.`,
        )}</span>
      </div>`,
    )
    .join('');
  return `<section class="psy-block">
      <h3>Ausführungsnote und Ergebnis</h3>
      <p class="psy-sub">${escapeHtml(`${psyCount(a.n, 'Paar', 'Paare')} aus Score und R${a.ohneScore ? `, ${a.ohneScore} Trades ohne Score` : ''}.`)}</p>
      <div class="psy-groups">${baender}</div>
      <p class="psy-say offen">${escapeHtml(rhoText)}</p>
      <p class="psy-sub">${escapeHtml(gegenText)}</p>
      <p class="psy-warn">Der Regler wird im selben Formular bewegt, nachdem das Ergebnis feststeht. Ein positiver Zusammenhang heißt zuerst einmal: du bewertest Gewinner im Rückblick besser.</p>
    </section>`;
}

function psyAfterHtml(daten) {
  const d = daten.danach;
  const gruppen = d.gruppen
    .map(
      gruppe => `<div class="psy-group">
        <small>${escapeHtml(gruppe.label)}</small>
        <strong>${escapeHtml(psyCount(gruppe.n, 'Trade', 'Trades'))}</strong>
        <span>${escapeHtml(
          gruppe.verteilung.length
            ? gruppe.verteilung
                .map(eintrag =>
                  gruppe.n >= PSY_MIN_QUOTE
                    ? `${eintrag.wert}: ${psyPercent(eintrag.anzahl / gruppe.n)}`
                    : `${eintrag.wert}: ${eintrag.anzahl}`,
                )
                .join(' · ')
            : 'Keine Angabe zur Stimmung danach.',
        )}</span>
      </div>`,
    )
    .join('');
  const quoteZeile = (titel, wert, erklaerung) => {
    const text =
      wert.n >= PSY_MIN_QUOTE
        ? `${psyPercent(wert.quote.rate)} (${psyPercent(wert.quote.low)}–${psyPercent(wert.quote.high)}) über ${wert.n} Trades`
        : `${wert.k} von ${wert.n} — eine Quote ab ${PSY_MIN_QUOTE} Trades`;
    return `<div class="psy-group"><small>${escapeHtml(titel)}</small><strong>${escapeHtml(text)}</strong><span>${escapeHtml(erklaerung)}</span></div>`;
  };
  return `<section class="psy-block">
      <h3>Stimmung nach dem Trade</h3>
      <p class="psy-sub">${escapeHtml(`${psyCount(d.n, 'Cockpit-Trade', 'Cockpit-Trades')} mit Angabe${d.ohneAngabe ? `, ${d.ohneAngabe} ohne` : ''}. Dass es nach Verlusten schlechter aussieht, ist trivial — die beiden Quoten darunter sind es nicht.`)}</p>
      <div class="psy-groups">${gruppen}</div>
      <div class="psy-groups">
        ${quoteZeile('Fassungsquote nach Verlust', d.fassung, 'Ruhig oder Erleichtert nach einem Verlust — genau das, was die Checkliste vorher behauptet hat.')}
        ${quoteZeile('Übermut nach Gewinn', d.uebermut, 'Gierig oder FOMO nach einem Gewinn. Kein Vergleich mit der Fassungsquote — verschiedene Skalen.')}
      </div>
    </section>`;
}

function psyDocHtml(daten) {
  const d = daten.doku;
  if (d.n < PSY_MIN_DOKU)
    return `<section class="psy-block">
        <h3>Dokumentationsdisziplin</h3>
        <p class="psy-sub">${escapeHtml(`${psyCount(d.n, 'abgeschlossener Trade', 'abgeschlossene Trades')} — ab ${PSY_MIN_DOKU} zeigt CPRB hier deine Journalführung.`)}</p>
      </section>`;
  /* Nur bei eindeutiger Spitze. Liegen mehrere Regelbrueche gleichauf, sagt der
     Abschnitt darueber genau das -- eine Leseliste zu einer einzelnen Regel
     wuerde ihm direkt widersprechen. */
  const spitze = daten.regeln.spitze && daten.regeln.spitze.eindeutig ? daten.regeln.spitze : null;
  const hatText = trade =>
    String(trade.mistakes || '').trim() !== '' || String(trade.learning || '').trim() !== '';
  const texte = spitze ? spitze.zeile.isoliert.filter(hatText).slice(0, PSY_LESELISTE_MAX) : [];
  const leseliste = texte.length
    ? `<h4>${escapeHtml(`Deine Notizen zu „${spitze.zeile.label}“`)}</h4>
      <ul class="psy-notes">${texte
        .map(
          trade =>
            `<li><small>${escapeHtml(trade.trade_date || 'ohne Datum')}</small><p>${escapeHtml(trade.mistakes || '')}</p><p>${escapeHtml(trade.learning || '')}</p></li>`,
        )
        .join('')}</ul>
      <p class="psy-sub">Lesestoff, keine Analyse — Freitexte wertet CPRB nicht aus.</p>`
    : '';
  return `<section class="psy-block">
      <h3>Dokumentationsdisziplin</h3>
      <p class="psy-sub">Das hier ist eine Aussage über deine Journalführung, nicht über deinen Handel.</p>
      <ul class="psy-list">
        <li><span>Fehler notiert</span><b>${escapeHtml(`${d.mistakes} von ${d.n} Trades`)}</b></li>
        <li><span>Learning notiert</span><b>${escapeHtml(`${d.learning} von ${d.n} Trades`)}</b></li>
        <li><span>Learning nach Verlusten</span><b>${escapeHtml(`${d.verlusteLearning} von ${d.verlusteN} Verlust-Trades`)}</b></li>
      </ul>
      ${leseliste}
    </section>`;
}

function psyBuildHtml(daten) {
  const anteil = Math.min(100, Math.round((daten.cockpit.length / PSY_MIN_MODUL) * 100));
  return `<section class="psy-block">
      <h3>Aufbaustand</h3>
      <div class="psy-progress"><i style="width:${anteil}%"></i></div>
      <p class="psy-sub">${escapeHtml(`${daten.cockpit.length} von ${PSY_MIN_MODUL} Cockpit-Trades. Erst dann rechnet CPRB hier etwas aus.`)}</p>
      <p class="psy-sub">${escapeHtml(
        `Ab ${PSY_MIN_MODUL} abgeschlossenen Trades mit Checkliste beginnt die Auswertung, ab ${PSY_MIN_QUOTE} je Gruppe kommen Quoten mit Intervall dazu, ab ${PSY_MIN_VERGLEICH} je Gruppe ein Richtungssatz, ab ${PSY_MIN_KORRELATION} Paaren die Rangkorrelation zur Ausführungsnote.`,
      )}</p>
    </section>`;
}

function psyHtml(daten) {
  const datum = new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(daten.today);
  const titel = '<div><div class="eyebrow">Auswertung</div><h2>Psychologie</h2></div>';
  const plakette = `<div class="psy-basis">${escapeHtml(`${psyCount(daten.cockpit.length, 'Cockpit-Trade', 'Cockpit-Trades')}`)}</div>`;
  if (!daten.schemaReady)
    return `<div class="psy-head">${titel}</div><p class="psy-warn">Ohne die Trading-Cockpit-Migration fehlen Checkliste, Ausführungsnote und Stimmung. Bis dahin kann diese Karte nichts auswerten — und zeigt deshalb keine Zahlen.</p>`;
  const kopf = `<div class="psy-head">${titel}${plakette}</div>`;
  const hinweis = `<p class="psy-sub">${escapeHtml(
    `Grundlage sind ${psyCount(daten.cockpit.length, 'abgeschlossener Trade', 'abgeschlossene Trades')} mit Checkliste. ` +
      `${psyCount(daten.altbestand, 'älterer Trade', 'ältere Trades')} ohne Checkliste und ` +
      `${psyCount(daten.offen, 'offener Trade', 'offene Trades')} zählen hier nicht mit. ` +
      `Bei ${psyCount(daten.ohneR, 'Cockpit-Trade', 'Cockpit-Trades')} ist R unbekannt, weil beim Speichern kein Risiko stand — ` +
      `sie fallen aus allen R-Rechnungen heraus.`,
  )}</p>`;
  const fuss = `<p class="psy-foot">${escapeHtml(
    `Stand ${datum}. Diese Karte zeigt Gleichzeitigkeiten, keine Ursachen — und keine Signifikanz: bei deiner Trade-Zahl wäre jeder p-Wert eine Höflichkeitslüge. Emotion, Stimmung danach, Ausführungsnote und „nach Plan“ werden alle im selben Formular gespeichert, nachdem das Ergebnis feststand.`,
  )}</p>`;
  if (daten.aufbau)
    return `${kopf}${hinweis}${psyBuildHtml(daten)}${psyContradictionHtml(daten)}${fuss}`;
  return `${kopf}${hinweis}
    ${psyEmotionHtml(daten)}
    ${psyPlanHtml(daten)}
    ${psyRuleHtml(daten)}
    ${psyExecutionHtml(daten)}
    ${psyAfterHtml(daten)}
    ${psyContradictionHtml(daten)}
    ${psyDocHtml(daten)}
    ${fuss}`;
}

function renderTradingPsychology(today = new Date()) {
  const box = $('#tradingPsychology');
  if (!box) return;
  box.innerHTML = psyHtml(psyAuswertung(psyTrades(), today));
}
