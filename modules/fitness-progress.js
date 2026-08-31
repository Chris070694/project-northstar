/* Fitness-Fortschritt — wird die Übung schwerer oder nicht?

   Die Daten kommen fertig aggregiert aus der Sicht `fitness_progress_v`: eine
   Zeile je Übung und Trainingstag, mit e1RM (Epley), Volumen, Topgewicht,
   Saetzen und Wiederholungen. Gerechnet wird in der Datenbank, weil dort die
   Satzprotokolle liegen — hier wird nur ausgewaehlt und gezeichnet.

   Gezeichnet wird als eigenes SVG, so wie die Kapitalkurve im Trading-Teil.
   Keine Diagramm-Bibliothek: die App soll offline laufen, und ein zweites
   Diagramm-Aussehen in derselben App waere ein Bruch. */

let fitnessProgressRows = [];
let fitnessProgressReady = false;
let fitnessProgressExercise = '';
let fitnessProgressRange = '90'; /* 30 | 90 | all */

const FITNESS_PROGRESS_RANGES = { 30: 30, 90: 90, all: null };
const FITNESS_PROGRESS_CHART = { width: 640, height: 170, padding: 14 };

function isMissingFitnessProgressView(error) {
  const nachricht = `${error?.code || ''} ${error?.message || ''}`;
  return (
    error?.code === '42P01' ||
    (/fitness_progress_v|fitness_session_volume_v/.test(nachricht) &&
      /does not exist|schema cache/i.test(nachricht))
  );
}

async function loadFitnessProgress() {
  const { data, error } = await sb
    .from('fitness_progress_v')
    .select('*')
    .order('session_date', { ascending: true });

  if (error) {
    /* Fehlt die Sicht, ist das kein Absturz — die Karte sagt es und der Rest
       der Fitness-Seite laeuft weiter. Jeder andere Fehler gehoert nach oben. */
    if (!isMissingFitnessProgressView(error)) throw error;
    fitnessProgressReady = false;
    fitnessProgressRows = [];
    return;
  }
  fitnessProgressReady = true;
  fitnessProgressRows = Array.isArray(data) ? data : [];
}

/* ---------------------------------------------------------------------------
   Auswahl
   --------------------------------------------------------------------------- */

/* Nach Anzahl der Trainingstage sortiert: die Uebung mit der laengsten Historie
   ist die einzige, bei der eine Kurve am Anfang ueberhaupt etwas zeigt. */
function fitnessProgressExerciseList(rows = fitnessProgressRows) {
  const nach = new Map();
  for (const row of rows) {
    const name = String(row?.exercise_name || '').trim();
    if (!name) continue;
    const eintrag = nach.get(name) || { name, tage: 0, muskel: row.muscle_group || '' };
    eintrag.tage += 1;
    nach.set(name, eintrag);
  }
  return [...nach.values()].sort((a, b) => b.tage - a.tage || a.name.localeCompare(b.name, 'de'));
}

function fitnessProgressTagKey(datum = new Date()) {
  return `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, '0')}-${String(
    datum.getDate(),
  ).padStart(2, '0')}`;
}

/* Der Zeitraum zaehlt Tage zurueck vom heutigen Tag. Verglichen wird als Text
   (YYYY-MM-DD), nicht ueber Date-Objekte: session_date ist ein Datum ohne
   Uhrzeit, `new Date('2026-08-30')` waere Mitternacht UTC und in Wien damit
   der Vortag — der aelteste Eintrag wuerde je nach Zeitzone herausfallen. */
function fitnessProgressGrenze(range = fitnessProgressRange, heute = new Date()) {
  const tage = FITNESS_PROGRESS_RANGES[range];
  if (!tage) return '';
  return fitnessProgressTagKey(
    new Date(heute.getFullYear(), heute.getMonth(), heute.getDate() - tage + 1),
  );
}

function fitnessProgressSeries(
  exercise = fitnessProgressExercise,
  range = fitnessProgressRange,
  rows = fitnessProgressRows,
  heute = new Date(),
) {
  const grenze = fitnessProgressGrenze(range, heute);
  return rows
    .filter(row => row?.exercise_name === exercise)
    .filter(row => typeof row?.session_date === 'string' && row.session_date)
    .filter(row => !grenze || row.session_date >= grenze)
    .sort((a, b) => String(a.session_date).localeCompare(String(b.session_date)));
}

/* ---------------------------------------------------------------------------
   Kennzahl: e1RM, wo es sie gibt — sonst Volumen
   --------------------------------------------------------------------------- */

/* Die Sicht rechnet e1RM nur fuer Saetze bis zwoelf Wiederholungen; darueber
   wird die Epley-Formel unbrauchbar. Bei Uebungen, die immer hochrepetitiv
   gefahren werden (Wadeln), steht deshalb ueberall null.

   Die Karte faellt dort auf das Volumen zurueck, statt ein leeres Diagramm zu
   zeigen. Ein leeres Diagramm sieht aus wie "kein Fortschritt" — und das waere
   eine falsche Aussage ueber ein Training, das stattgefunden hat. */
function fitnessProgressMetric(reihe) {
  return reihe.some(row => Number(row?.e1rm_kg) > 0) ? 'e1rm' : 'volumen';
}

const FITNESS_PROGRESS_LABELS = {
  e1rm: { kurz: 'e1RM', lang: 'Geschätztes Maximalgewicht' },
  volumen: { kurz: 'Volumen', lang: 'Volumen pro Training' },
};

/* Achtung: Number(null) ist 0, nicht ungueltig — und Number('') ebenso. Ohne
   die Pruefung davor waere ein fehlendes e1RM (Wadeln) als echte Null in die
   Kurve gelaufen und haette einen Absturz auf 0 kg behauptet, den es nie gab.
   Dieselbe Falle wie new Date(null) im Wirtschaftskalender. */
function fitnessProgressValue(row, metric) {
  const roh = metric === 'e1rm' ? row?.e1rm_kg : row?.volume_kg;
  if (roh === null || roh === undefined || roh === '') return null;
  const zahl = Number(roh);
  return Number.isFinite(zahl) ? zahl : null;
}

function fitnessProgressValues(reihe, metric) {
  return reihe.map(row => fitnessProgressValue(row, metric)).filter(wert => wert !== null);
}

function formatFitnessProgressNumber(wert) {
  if (!Number.isFinite(wert)) return '–';
  /* Volumen geht schnell in die Zehntausende — als Tonnen bleibt es lesbar. */
  if (Math.abs(wert) >= 1000) return `${(wert / 1000).toFixed(1).replace('.', ',')} t`;
  const gerundet = wert.toFixed(1);
  return `${(gerundet.endsWith('.0') ? gerundet.slice(0, -2) : gerundet).replace('.', ',')} kg`;
}

/* ---------------------------------------------------------------------------
   Kennzahlen und Trend
   --------------------------------------------------------------------------- */

function fitnessProgressStats(reihe, metric) {
  const werte = fitnessProgressValues(reihe, metric);
  if (!werte.length) return null;
  const erster = werte[0];
  const letzter = werte[werte.length - 1];
  /* Ohne zweiten Punkt gibt es keine Veraenderung — nicht null. Null hiesse
     "nichts passiert", und das ist etwas anderes als "wir wissen es noch nicht". */
  const veraenderung = werte.length > 1 ? letzter - erster : null;
  const prozent = werte.length > 1 && erster > 0 ? ((letzter - erster) / erster) * 100 : null;
  return { erster, letzter, bestwert: Math.max(...werte), veraenderung, prozent, punkte: werte.length };
}

/* Ausgleichsgerade nach kleinsten Quadraten ueber (Index, Wert). Erst ab drei
   Punkten: durch zwei Punkte ist die Gerade die Daten selbst und behauptet
   einen Trend, wo nur eine Verbindung ist. */
function fitnessProgressTrend(werte) {
  if (werte.length < 3) return null;
  const n = werte.length;
  const mittelX = (n - 1) / 2;
  const mittelY = werte.reduce((summe, wert) => summe + wert, 0) / n;
  let zaehler = 0;
  let nenner = 0;
  werte.forEach((wert, index) => {
    zaehler += (index - mittelX) * (wert - mittelY);
    nenner += (index - mittelX) ** 2;
  });
  if (!nenner) return null;
  const steigung = zaehler / nenner;
  const achse = mittelY - steigung * mittelX;
  return { steigung, von: achse, bis: achse + steigung * (n - 1) };
}

/* Ein PR ist ein Wert, der alles davor uebertrifft. Der erste Punkt zaehlt
   nicht — sonst waere jeder Anfang ein Rekord. */
function fitnessProgressPRs(werte) {
  const marken = [];
  let bisher = -Infinity;
  werte.forEach((wert, index) => {
    if (index > 0 && wert > bisher) marken.push(index);
    bisher = Math.max(bisher, wert);
  });
  return marken;
}

/* ---------------------------------------------------------------------------
   Zeichnen
   --------------------------------------------------------------------------- */

/* Eigene Achse statt statsChartPoints: die dort verankert bei null. Fuer Geld
   ist das richtig, fuer Gewichte nicht — 28 auf 35 kg waere auf einer Skala ab
   null ein kaum sichtbarer Knick. Hier umschliesst die Achse die Daten. */
function fitnessProgressDomain(werte) {
  const min = Math.min(...werte);
  const max = Math.max(...werte);
  const spanne = max - min;
  /* Flache Reihe: kuenstliche Spanne von 1. Damit liegt die Linie exakt in der
     Mitte, statt durch null geteilt zu werden. Das ist bei Christian gerade der
     haeufigste Fall und nicht der seltenste — fuenf seiner Uebungen stehen still. */
  const luft = spanne ? spanne * 0.15 : 1;
  return { unten: min - luft, oben: max + luft };
}

function fitnessProgressX(index, anzahl, masse = FITNESS_PROGRESS_CHART) {
  const { width, padding } = masse;
  const schritt = anzahl > 1 ? (width - padding * 2) / (anzahl - 1) : 0;
  return padding + index * schritt;
}

/* Alles, was gezeichnet wird — Datenlinie und Trendgerade — geht durch diese
   eine Funktion mit derselben Achse. Zwei getrennte Rechnungen waeren zwei
   Skalen im selben Bild: die Trendlinie zeigte in die richtige Richtung an der
   falschen Stelle. Die Enden der Trendgeraden koennen ausserhalb der Daten
   liegen, deshalb wird geklemmt. */
function fitnessProgressY(wert, domain, masse = FITNESS_PROGRESS_CHART) {
  const { height, padding } = masse;
  const anteil = (wert - domain.unten) / (domain.oben - domain.unten);
  const y = padding + (1 - anteil) * (height - padding * 2);
  return Math.min(height - padding, Math.max(padding, y));
}

function fitnessProgressPoints(werte, masse = FITNESS_PROGRESS_CHART) {
  if (!werte.length) return [];
  const domain = fitnessProgressDomain(werte);
  return werte.map((wert, index) => ({
    x: fitnessProgressX(index, werte.length, masse),
    y: fitnessProgressY(wert, domain, masse),
  }));
}

function fitnessProgressChart(reihe, metric) {
  const werte = fitnessProgressValues(reihe, metric);
  const { width, height } = FITNESS_PROGRESS_CHART;
  if (werte.length < 2) return '';

  const domain = fitnessProgressDomain(werte);
  const punkte = fitnessProgressPoints(werte);
  const linie = punkte.map(punkt => `${punkt.x.toFixed(1)} ${punkt.y.toFixed(1)}`).join(' L ');
  const flaeche = `M ${linie} L ${punkte[punkte.length - 1].x.toFixed(1)} ${height} L ${punkte[0].x.toFixed(1)} ${height} Z`;

  const trend = fitnessProgressTrend(werte);
  const trendLinie = trend
    ? `<line class="fp-trend" x1="${punkte[0].x.toFixed(1)}" y1="${fitnessProgressY(trend.von, domain).toFixed(1)}"
        x2="${punkte[punkte.length - 1].x.toFixed(1)}" y2="${fitnessProgressY(trend.bis, domain).toFixed(1)}"></line>`
    : '';

  const prs = fitnessProgressPRs(werte)
    .map(index => {
      const punkt = punkte[index];
      const datum = reihe[index]?.session_date || '';
      return `<circle class="fp-pr" cx="${punkt.x.toFixed(1)}" cy="${punkt.y.toFixed(1)}" r="4.5"><title>Bestwert am ${escapeHtml(datum)}: ${escapeHtml(formatFitnessProgressNumber(werte[index]))}</title></circle>`;
    })
    .join('');

  const letzter = punkte[punkte.length - 1];
  const label = FITNESS_PROGRESS_LABELS[metric];
  return `<svg class="fp-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img"
      aria-label="${escapeHtml(label.lang)}, von ${escapeHtml(formatFitnessProgressNumber(werte[0]))} auf ${escapeHtml(formatFitnessProgressNumber(werte[werte.length - 1]))}">
      <defs><linearGradient id="fpFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#54efb1" stop-opacity="0.24"></stop>
        <stop offset="1" stop-color="#54efb1" stop-opacity="0"></stop>
      </linearGradient></defs>
      <path class="fp-fill" d="${flaeche}" fill="url(#fpFill)"></path>
      ${trendLinie}
      <path class="fp-line" d="M ${linie}" fill="none"></path>
      ${prs}
      <circle class="fp-last" cx="${letzter.x.toFixed(1)}" cy="${letzter.y.toFixed(1)}" r="3.5"></circle>
    </svg>`;
}

/* ---------------------------------------------------------------------------
   Ausgabe
   --------------------------------------------------------------------------- */

function setFitnessProgressExercise(name) {
  fitnessProgressExercise = name;
  renderFitnessProgress();
}

/* Die Knoepfe reichen den Index durch, nicht den Namen. Uebungsnamen kommen aus
   der Datenbank und stehen sonst in einem onclick-Text — ein Name mit einem
   Anfuehrungszeichen wuerde den Aufruf zerlegen. */
function pickFitnessProgressExercise(index) {
  const uebung = fitnessProgressExerciseList()[Number(index)];
  if (uebung) setFitnessProgressExercise(uebung.name);
}

function setFitnessProgressRange(range) {
  fitnessProgressRange = FITNESS_PROGRESS_RANGES[range] === undefined ? 'all' : range;
  renderFitnessProgress();
}

/* Der Prozentwert steht in einer zweiten Zeile, nicht hinter dem Kilo-Wert:
   "+4,2 kg · +14 %" passt auf dem Handy nicht in ein Drittel der Breite und
   wurde abgeschnitten — die Zahl war da, nur nicht lesbar. */
function fitnessProgressKachel(label, wert, ton = '', zusatz = '') {
  return `<div class="fp-tile"><small>${escapeHtml(label)}</small><strong class="${ton}">${escapeHtml(wert)}</strong>${
    zusatz ? `<em class="${ton}">${escapeHtml(zusatz)}</em>` : ''
  }</div>`;
}

function renderFitnessProgress() {
  const karte = $('#fitnessProgressCard');
  if (!karte) {
    console.warn('fitness-progress.js: #fitnessProgressCard fehlt — der Verlauf wird nicht gezeigt.');
    return;
  }
  const koerper = $('#fitnessProgressBody');
  const auswahl = $('#fitnessProgressPicker');
  const notiz = $('#fitnessProgressNotice');

  if (!fitnessProgressReady) {
    notiz.classList.remove('hide');
    auswahl.innerHTML = '';
    koerper.innerHTML = '';
    return;
  }
  notiz.classList.add('hide');

  const uebungen = fitnessProgressExerciseList();
  if (!uebungen.length) {
    auswahl.innerHTML = '';
    koerper.innerHTML =
      '<p class="fp-empty">Noch kein abgeschlossener Satz aufgezeichnet. Nach dem ersten Training steht hier deine Kurve.</p>';
    return;
  }

  /* Ohne Auswahl die Uebung mit den meisten Trainingstagen — die einzige, bei
     der am Anfang ueberhaupt etwas zu sehen ist. */
  if (!uebungen.some(uebung => uebung.name === fitnessProgressExercise)) {
    fitnessProgressExercise = uebungen[0].name;
  }

  auswahl.innerHTML = uebungen
    .map(
      (uebung, index) =>
        `<button type="button" class="fp-pick${uebung.name === fitnessProgressExercise ? ' active' : ''}"
          onclick="pickFitnessProgressExercise(${index})">${escapeHtml(uebung.name)}<span>${uebung.tage}</span></button>`,
    )
    .join('');

  /* Die Kennzahl richtet sich nach der ganzen Historie, nicht nach dem
     gewaehlten Zeitraum: sonst wechselte die Achse beim Umschalten von e1RM auf
     Volumen, nur weil im kurzen Fenster zufaellig kein Satz unter zwoelf
     Wiederholungen liegt. */
  const metric = fitnessProgressMetric(fitnessProgressSeries(fitnessProgressExercise, 'all'));
  const label = FITNESS_PROGRESS_LABELS[metric];
  const reihe = fitnessProgressSeries(fitnessProgressExercise, fitnessProgressRange);
  const stats = fitnessProgressStats(reihe, metric);

  const zeitraum = ['30', '90', 'all']
    .map(
      key =>
        `<button type="button" class="fp-range${key === fitnessProgressRange ? ' active' : ''}"
          onclick="setFitnessProgressRange('${key}')">${key === 'all' ? 'Alles' : `${key} T`}</button>`,
    )
    .join('');
  const kopf = `<div class="fp-toolbar"><span class="fp-metric">${escapeHtml(label.lang)}</span><div class="fp-ranges">${zeitraum}</div></div>`;

  /* Ein leerer Zeitraum ist etwas anderes als eine Uebung ohne Daten. Beides
     als leeres Diagramm zu zeigen, waere dieselbe Luege wie beim Kalender. */
  if (!stats) {
    koerper.innerHTML = `${kopf}
      <p class="fp-empty">In diesem Zeitraum kein Training bei <b>${escapeHtml(fitnessProgressExercise)}</b>. Nimm einen längeren Zeitraum.</p>`;
    return;
  }

  const richtung =
    stats.veraenderung === null || stats.veraenderung === 0
      ? ''
      : stats.veraenderung > 0
        ? 'pos'
        : 'neg';
  const veraenderungText =
    stats.veraenderung === null
      ? 'erst ein Training'
      : `${stats.veraenderung > 0 ? '+' : ''}${formatFitnessProgressNumber(stats.veraenderung)}`;
  const veraenderungProzent =
    stats.prozent === null || stats.prozent === 0
      ? ''
      : `${stats.prozent > 0 ? '+' : ''}${stats.prozent.toFixed(0)} %`;

  const diagramm = fitnessProgressChart(reihe, metric);
  const hinweis =
    metric === 'volumen'
      ? '<small class="fp-note">Für diese Übung zeigt die Kurve das Volumen (Gewicht × Wiederholungen). Ein geschätztes Maximalgewicht lässt sich erst bei Sätzen bis zwölf Wiederholungen sinnvoll rechnen.</small>'
      : '';
  const flach =
    stats.punkte > 2 && stats.veraenderung === 0
      ? '<small class="fp-note">Über diesen Zeitraum unverändert. Zeit, das Gewicht zu erhöhen.</small>'
      : '';

  koerper.innerHTML = `${kopf}
    <div class="fp-tiles">
      ${fitnessProgressKachel('Aktuell', formatFitnessProgressNumber(stats.letzter))}
      ${fitnessProgressKachel('Bestwert', formatFitnessProgressNumber(stats.bestwert))}
      ${fitnessProgressKachel('Veränderung', veraenderungText, richtung, veraenderungProzent)}
    </div>
    ${diagramm || '<p class="fp-empty">Ein Trainingstag reicht für keine Kurve — ab dem zweiten zeichnet sie sich.</p>'}
    ${hinweis}
    ${flach}`;

  /* Die Linie braucht ihre eigene Laenge, damit sie sich zeichnen kann —
     dieselbe Mechanik wie bei der Kapitalkurve. */
  const linie = koerper.querySelector?.('.fp-line');
  if (linie?.getTotalLength) linie.style.setProperty('--fp-len', linie.getTotalLength());
}
