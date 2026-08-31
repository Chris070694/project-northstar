/* Fitness-Fortschritt.

   Die heiklen Stellen sind nicht das Zeichnen, sondern die Randfälle in
   Christians echten Daten: fünf seiner Übungen stehen still (Spanne null), eine
   hat gar kein e1RM (Wadeln, immer über zwölf Wiederholungen), und eine ist
   rückläufig. Genau die werden hier geprüft — mit den Zeilen aus der Datenbank,
   nicht mit erfundenen. */

const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const quelle = fs.readFileSync('modules/fitness-progress.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const styles = fs.readFileSync('styles.css', 'utf8');
const serviceWorker = fs.readFileSync('sw.js', 'utf8');

const knoten = new Map();
const machKnoten = () => {
  const el = { innerHTML: '', textContent: '', klassen: new Set() };
  el.classList = {
    add: name => el.klassen.add(name),
    remove: name => el.klassen.delete(name),
    contains: name => el.klassen.has(name),
  };
  el.querySelector = () => null;
  return el;
};
const context = vm.createContext({
  console: { warn: () => {}, log: () => {}, error: () => {} },
  Number,
  Math,
  Date,
  Map,
  Infinity,
  $: selektor => {
    if (!knoten.has(selektor)) knoten.set(selektor, machKnoten());
    return knoten.get(selektor);
  },
  escapeHtml: value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[ch],
    ),
});
vm.runInContext(quelle, context);
const wert = ausdruck => vm.runInContext(ausdruck, context);
/* fitnessProgressRows ist mit let deklariert und haengt damit NICHT am
   Kontext-Objekt — context.fitnessProgressRows = [...] waere wirkungslos und
   der Test still gruen. */
const setzeRows = rows =>
  vm.runInContext(`fitnessProgressRows = ${JSON.stringify(rows)}; fitnessProgressReady = true;`, context);

/* Echte Zeilen aus fitness_progress_v, Stand 30.08.2026. */
const ECHT = [
  { session_date: '2026-08-05', exercise_name: 'Rudern', muscle_group: 'Rücken', sets: 1, total_reps: 12, volume_kg: '264.0', top_weight_kg: '22.0', e1rm_kg: '30.8' },
  { session_date: '2026-08-11', exercise_name: 'Rudern', muscle_group: 'Rücken', sets: 2, total_reps: 24, volume_kg: '480.0', top_weight_kg: '20.0', e1rm_kg: '28.0' },
  { session_date: '2026-08-22', exercise_name: 'Rudern', muscle_group: 'Rücken', sets: 3, total_reps: 36, volume_kg: '780.0', top_weight_kg: '25.0', e1rm_kg: '35.0' },
  { session_date: '2026-08-30', exercise_name: 'Rudern', muscle_group: 'Rücken', sets: 3, total_reps: 36, volume_kg: '900.0', top_weight_kg: '25.0', e1rm_kg: '35.0' },
  { session_date: '2026-08-11', exercise_name: 'Latzug', muscle_group: 'Rücken', sets: 3, total_reps: 36, volume_kg: '1380.0', top_weight_kg: '40.0', e1rm_kg: '56.0' },
  { session_date: '2026-08-22', exercise_name: 'Latzug', muscle_group: 'Rücken', sets: 3, total_reps: 36, volume_kg: '1440.0', top_weight_kg: '40.0', e1rm_kg: '56.0' },
  { session_date: '2026-08-30', exercise_name: 'Latzug', muscle_group: 'Rücken', sets: 3, total_reps: 36, volume_kg: '1440.0', top_weight_kg: '40.0', e1rm_kg: '56.0' },
  { session_date: '2026-08-22', exercise_name: 'Wadeln', muscle_group: 'Beine', sets: 2, total_reps: 40, volume_kg: '800.0', top_weight_kg: '20.0', e1rm_kg: null },
  { session_date: '2026-08-30', exercise_name: 'Wadeln', muscle_group: 'Beine', sets: 2, total_reps: 40, volume_kg: '1000.0', top_weight_kg: '25.0', e1rm_kg: null },
  { session_date: '2026-08-22', exercise_name: 'Bitzep', muscle_group: 'Arme', sets: 3, total_reps: 26, volume_kg: '520.0', top_weight_kg: '20.0', e1rm_kg: '28.0' },
  { session_date: '2026-08-30', exercise_name: 'Bitzep', muscle_group: 'Arme', sets: 3, total_reps: 37, volume_kg: '555.0', top_weight_kg: '15.0', e1rm_kg: '21.0' },
];
setzeRows(ECHT);
const HEUTE = 'new Date(2026, 7, 30)';

// ---------------------------------------------------------------------------
// Übungsliste
// ---------------------------------------------------------------------------
const liste = [...wert('fitnessProgressExerciseList()')];
assert.strictEqual(liste.length, 4);
assert.strictEqual(liste[0].name, 'Rudern', 'die Übung mit den meisten Tagen steht vorn');
assert.strictEqual(liste[0].tage, 4);
assert.strictEqual(liste[1].name, 'Latzug');
/* Arrays aus dem vm-Kontext sind nicht deepStrictEqual zu Arrays hier — andere
   Realm, anderer Array-Prototyp. Deshalb ueberall ins Testrealm spreizen. */
const alsListe = ausdruck => [...wert(ausdruck)];
assert.strictEqual(
  alsListe('fitnessProgressExerciseList([])').length,
  0,
  'ohne Daten eine leere Liste, kein Absturz',
);

// ---------------------------------------------------------------------------
// Zeitraum: Textvergleich, keine Zeitzone
// ---------------------------------------------------------------------------
assert.strictEqual(wert(`fitnessProgressGrenze('all', ${HEUTE})`), '', 'Alles filtert nicht');
assert.strictEqual(wert(`fitnessProgressGrenze('30', ${HEUTE})`), '2026-08-01');
assert.strictEqual(wert(`fitnessProgressGrenze('90', ${HEUTE})`), '2026-06-02');

const rudern90 = [...wert(`fitnessProgressSeries('Rudern', '90', fitnessProgressRows, ${HEUTE})`)];
assert.strictEqual(rudern90.length, 4, 'im 90-Tage-Fenster sind alle vier Trainings drin');
assert.strictEqual(rudern90[0].session_date, '2026-08-05', 'aufsteigend sortiert');

/* Der 5.8. liegt genau 26 Tage zurueck und muss im 30-Tage-Fenster bleiben.
   Mit Date-Objekten statt Textvergleich waere er in Wien herausgefallen. */
const rudern30 = [...wert(`fitnessProgressSeries('Rudern', '30', fitnessProgressRows, ${HEUTE})`)];
assert.strictEqual(rudern30.length, 4, 'die Grenze schliesst den Randtag ein');
const rudernKurz = [...wert(`fitnessProgressSeries('Rudern', '30', fitnessProgressRows, new Date(2026, 8, 5))`)];
assert.strictEqual(rudernKurz.length, 3, 'am 5.9. faellt der 5.8. heraus');

assert.strictEqual(
  alsListe(`fitnessProgressSeries('Gibtsnicht', 'all', fitnessProgressRows, ${HEUTE})`).length,
  0,
  'unbekannte Übung gibt leer',
);

// ---------------------------------------------------------------------------
// Kennzahl: e1RM, wo vorhanden — sonst Volumen
// ---------------------------------------------------------------------------
assert.strictEqual(wert("fitnessProgressMetric(fitnessProgressSeries('Rudern', 'all'))"), 'e1rm');
assert.strictEqual(
  wert("fitnessProgressMetric(fitnessProgressSeries('Wadeln', 'all'))"),
  'volumen',
  'Wadeln hat nirgends ein e1RM und faellt auf Volumen zurueck',
);
assert.strictEqual(wert('fitnessProgressMetric([])'), 'volumen');
/* Ein leeres Diagramm bei Wadeln waere die eigentliche Gefahr: es saehe aus wie
   "kein Fortschritt", obwohl das Volumen von 800 auf 1000 gestiegen ist. */
assert.strictEqual(
  alsListe("fitnessProgressValues(fitnessProgressSeries('Wadeln','all'), 'e1rm')").length,
  0,
);
assert.deepStrictEqual(
  alsListe("fitnessProgressValues(fitnessProgressSeries('Wadeln','all'), 'volumen')"),
  [800, 1000],
);

// ---------------------------------------------------------------------------
// Kennzahlen
// ---------------------------------------------------------------------------
const rudernStats = wert("fitnessProgressStats(fitnessProgressSeries('Rudern','all'), 'e1rm')");
assert.strictEqual(rudernStats.erster, 30.8);
assert.strictEqual(rudernStats.letzter, 35);
assert.strictEqual(rudernStats.bestwert, 35);
assert.ok(Math.abs(rudernStats.veraenderung - 4.2) < 1e-9);

/* Bitzep ist rueckläufig: 28,0 auf 21,0. Das steht so auch in der Datenbank —
   mehr Wiederholungen bei weniger Gewicht. Die Karte muss das als Minus zeigen
   und darf es nicht als Fortschritt verkaufen. */
const bitzep = wert("fitnessProgressStats(fitnessProgressSeries('Bitzep','all'), 'e1rm')");
assert.strictEqual(bitzep.veraenderung, -7);
assert.strictEqual(Math.round(bitzep.prozent), -25);
assert.strictEqual(bitzep.bestwert, 28, 'der Bestwert bleibt der alte');

/* Latzug steht still. Veraenderung null ist etwas anderes als "unbekannt". */
const latzug = wert("fitnessProgressStats(fitnessProgressSeries('Latzug','all'), 'e1rm')");
assert.strictEqual(latzug.veraenderung, 0);
assert.strictEqual(latzug.punkte, 3);

const einPunkt = wert("fitnessProgressStats([{session_date:'2026-08-30', e1rm_kg:'40'}], 'e1rm')");
assert.strictEqual(einPunkt.veraenderung, null, 'ein Punkt hat keine Veraenderung, auch nicht null');
assert.strictEqual(einPunkt.prozent, null);
assert.strictEqual(wert("fitnessProgressStats([], 'e1rm')"), null);

// ---------------------------------------------------------------------------
// Trend
// ---------------------------------------------------------------------------
assert.strictEqual(wert('fitnessProgressTrend([1, 2])'), null, 'zwei Punkte ergeben keinen Trend');
const steigend = wert('fitnessProgressTrend([10, 20, 30])');
assert.strictEqual(steigend.steigung, 10);
assert.strictEqual(steigend.von, 10);
assert.strictEqual(steigend.bis, 30);
const flachTrend = wert('fitnessProgressTrend([56, 56, 56])');
assert.strictEqual(flachTrend.steigung, 0, 'eine flache Reihe hat Steigung null');
assert.ok(wert('fitnessProgressTrend([10, 30, 20, 40]).steigung') > 0);

// ---------------------------------------------------------------------------
// Bestwerte
// ---------------------------------------------------------------------------
assert.deepStrictEqual(alsListe('fitnessProgressPRs([30.8, 28, 35, 35])'), [2], 'nur der echte neue Bestwert');
assert.strictEqual(alsListe('fitnessProgressPRs([56, 56, 56])').length, 0, 'Gleichstand ist kein Rekord');
assert.strictEqual(alsListe('fitnessProgressPRs([28, 21])').length, 0, 'ein Rueckgang erst recht nicht');
assert.deepStrictEqual(alsListe('fitnessProgressPRs([10, 20, 30])'), [1, 2]);
assert.strictEqual(alsListe('fitnessProgressPRs([40])').length, 0, 'der erste Punkt ist kein Rekord');

// ---------------------------------------------------------------------------
// Achse — der Fall, der am ehesten kracht
// ---------------------------------------------------------------------------
/* Fuenf von Christians Uebungen stehen still. Spanne null heisst ohne eigenen
   Zweig Division durch null und damit NaN in jedem Koordinatenwert. */
const flachePunkte = alsListe('fitnessProgressPoints([56, 56, 56])');
assert.strictEqual(flachePunkte.length, 3);
flachePunkte.forEach(punkt => {
  assert.ok(Number.isFinite(punkt.x) && Number.isFinite(punkt.y), 'kein NaN bei flacher Reihe');
});
assert.strictEqual(flachePunkte[0].y, 85, 'flache Reihe liegt in der Mitte (Hoehe 170)');
assert.strictEqual(flachePunkte[0].y, flachePunkte[2].y);

const punkte = alsListe('fitnessProgressPoints([30.8, 28, 35, 35])');
assert.ok(punkte[1].y > punkte[2].y, 'der kleinere Wert liegt tiefer (y waechst nach unten)');
assert.strictEqual(punkte[0].x, 14, 'der erste Punkt sitzt auf dem Rand');
assert.strictEqual(punkte[3].x, 626, 'der letzte auch (640 minus Rand)');
punkte.forEach(punkt => {
  assert.ok(punkt.y >= 14 && punkt.y <= 156, `y bleibt in der Zeichenflaeche: ${punkt.y}`);
});

/* Die Achse verankert NICHT bei null — sonst waere der Unterschied zwischen
   28 und 35 kg ein kaum sichtbarer Knick. */
const spanne = punkte.map(p => p.y);
assert.ok(Math.max(...spanne) - Math.min(...spanne) > 100, 'die Kurve nutzt die Hoehe aus');

/* Die Trendenden koennen ausserhalb der Daten liegen und muessen geklemmt
   werden, sonst zeichnet die Linie aus dem Bild heraus. */
const domain = wert('fitnessProgressDomain([0, 0, 10])');
const trendAus = wert('fitnessProgressTrend([0, 0, 10])');
assert.ok(trendAus.von < 0, 'die Ausgleichsgerade startet hier unter dem Minimum');
const geklemmt = wert(`fitnessProgressY(${trendAus.von}, ${JSON.stringify(domain)})`);
assert.ok(geklemmt <= 156 && geklemmt >= 14, `geklemmt statt aus dem Bild: ${geklemmt}`);

// ---------------------------------------------------------------------------
// Zahlen lesbar
// ---------------------------------------------------------------------------
assert.strictEqual(wert('formatFitnessProgressNumber(35)'), '35 kg');
assert.strictEqual(wert('formatFitnessProgressNumber(30.8)'), '30,8 kg');
assert.strictEqual(wert('formatFitnessProgressNumber(-7)'), '-7 kg');
assert.strictEqual(wert('formatFitnessProgressNumber(1440)'), '1,4 t', 'Volumen als Tonnen');
assert.strictEqual(wert('formatFitnessProgressNumber(null)'), '–');
assert.strictEqual(wert('formatFitnessProgressNumber(NaN)'), '–');

// ---------------------------------------------------------------------------
// Ausgabe
// ---------------------------------------------------------------------------
const zeige = () => knoten.get('#fitnessProgressBody').innerHTML;
const auswahl = () => knoten.get('#fitnessProgressPicker').innerHTML;

wert("fitnessProgressExercise = 'Rudern'; fitnessProgressRange = 'all'; renderFitnessProgress();");
assert.match(zeige(), /Geschätztes Maximalgewicht/);
assert.match(zeige(), /35 kg/, 'der aktuelle Wert steht da');
assert.match(zeige(), /\+4,2 kg/, 'die Veraenderung mit Vorzeichen');
/* Der Prozentwert steht in einer eigenen Zeile — hinter dem Kilo-Wert wurde er
   auf dem Handy abgeschnitten. */
assert.match(zeige(), /<em class="pos">\+14 %<\/em>/, 'der Prozentwert in zweiter Zeile');
assert.match(zeige(), /<svg class="fp-chart"/, 'die Kurve wird gezeichnet');
assert.match(zeige(), /class="fp-trend"/, 'ab drei Punkten auch die Trendgerade');
assert.match(auswahl(), /fp-pick active[^>]*>Rudern/s);
assert.doesNotMatch(zeige(), /NaN|undefined|Infinity/, 'keine Rechenreste in der Ausgabe');

wert("fitnessProgressExercise = 'Wadeln'; renderFitnessProgress();");
assert.match(zeige(), /Volumen pro Training/, 'Wadeln laeuft ueber das Volumen');
assert.match(zeige(), /1,0 t/);
assert.match(zeige(), /zwölf Wiederholungen/, 'und sagt, warum');
assert.doesNotMatch(zeige(), /NaN/);

wert("fitnessProgressExercise = 'Latzug'; renderFitnessProgress();");
assert.match(zeige(), /Zeit, das Gewicht zu erhöhen/, 'Stillstand wird benannt, nicht verschwiegen');
assert.match(zeige(), /<svg class="fp-chart"/, 'auch die flache Reihe wird gezeichnet');
assert.doesNotMatch(zeige(), /NaN/, 'die flache Reihe erzeugt keine NaN-Koordinaten');

wert("fitnessProgressExercise = 'Bitzep'; renderFitnessProgress();");
assert.match(zeige(), /-7 kg/, 'ein Rueckgang steht als Minus da');
assert.match(zeige(), /class="neg"/, 'und wird als Rueckgang eingefaerbt');
assert.doesNotMatch(zeige(), /class="pos"/, 'nicht als Fortschritt');

/* Zeitraum ohne Training: kein leeres Diagramm, sondern der Grund. */
wert("fitnessProgressExercise = 'Rudern'; fitnessProgressRange = '30'; renderFitnessProgress();");
const alt = [...wert(`fitnessProgressSeries('Rudern', '30', fitnessProgressRows, new Date(2027, 0, 1))`)];
assert.strictEqual(alt.length, 0);
setzeRows([]);
wert("renderFitnessProgress();");
assert.match(zeige(), /Noch kein abgeschlossener Satz/, 'ohne Daten ein Satz, kein leeres Bild');
assert.doesNotMatch(zeige(), /<svg/);

// Fehlende Sicht wird benannt, nicht als "kein Fortschritt" gezeigt.
setzeRows(ECHT);
wert('fitnessProgressReady = false; renderFitnessProgress();');
assert.ok(knoten.get('#fitnessProgressNotice').klassen.has('hide') === false, 'der Hinweis erscheint');
assert.strictEqual(zeige(), '');
wert('fitnessProgressReady = true; renderFitnessProgress();');
assert.ok(knoten.get('#fitnessProgressNotice').klassen.has('hide'), 'und verschwindet wieder');

// ---------------------------------------------------------------------------
// Maskierung
// ---------------------------------------------------------------------------
/* Übungsnamen tippt Christian selbst ein. Sie landen in HTML und frueher auch
   in einem onclick-Text — deshalb geht die Auswahl ueber den Index. */
setzeRows([
  { session_date: '2026-08-30', exercise_name: '<img src=x onerror=alert(1)>', volume_kg: '100', e1rm_kg: '40' },
  { session_date: '2026-08-29', exercise_name: "Kurz'hantel", volume_kg: '100', e1rm_kg: '40' },
]);
wert("fitnessProgressExercise = ''; renderFitnessProgress();");
assert.doesNotMatch(auswahl(), /<img src=x/, 'der Name wird maskiert');
assert.match(auswahl(), /&lt;img/);
assert.doesNotMatch(auswahl(), /onclick="pickFitnessProgressExercise\([^)]*'/, 'kein Name im onclick');
assert.match(auswahl(), /onclick="pickFitnessProgressExercise\(\d+\)"/, 'nur der Index steht drin');

// ---------------------------------------------------------------------------
// Verdrahtung
// ---------------------------------------------------------------------------
const seite = index.slice(index.indexOf('<section id="fitness"'), index.indexOf('<section id="notes"'));
for (const id of [
  'id="fitnessProgressCard"',
  'id="fitnessProgressPicker"',
  'id="fitnessProgressBody"',
  'id="fitnessProgressNotice"',
]) {
  assert.ok(seite.includes(id), `${id} fehlt auf der Fitness-Seite`);
}
/* Der Fortschritt gehoert vor den Arbeitsbereich mit den Planlisten: er ist die
   Antwort auf "wird es besser", und danach kommt das Eintragen. */
assert.ok(
  seite.indexOf('id="fitnessProgressCard"') < seite.indexOf('id="fitnessWorkspace"'),
  'die Karte steht über dem Arbeitsbereich',
);

assert.match(app, /loadFitnessProgress\(\)/, 'wird beim Start geladen');
assert.match(app, /renderFitnessProgress\(\)/, 'und gerendert');
assert.match(styles, /\.fp-card\b/);
assert.match(styles, /\.fp-line\b/);
assert.match(styles, /\.fp-trend\b/);
assert.match(styles, /prefers-reduced-motion[\s\S]*fp-line/, 'ohne Bewegung keine Zeichenanimation');

/* Keine Diagramm-Bibliothek: die App soll offline laufen. */
assert.doesNotMatch(index, /chart\.js|chartjs/i, 'kein Chart.js im Dokument');
assert.doesNotMatch(quelle, /new Chart\(/, 'und keins im Modul');

assert.strictEqual(
  (serviceWorker.match(/\.\/modules\/fitness-progress\.js\?v=(\d+)/) || [])[1],
  (index.match(/modules\/fitness-progress\.js\?v=(\d+)/) || [])[1],
  'fitness-progress.js: Version laeuft auseinander',
);
assert.strictEqual(
  (serviceWorker.match(/styles\.css\?v=(\d+)/) || [])[1],
  (index.match(/styles\.css\?v=(\d+)/) || [])[1],
  'styles.css: Version laeuft auseinander',
);

console.log(
  'Fitness-Fortschritt: Zeitraum, e1RM-Rückfall, Stillstand, Rückgang, Achse, Maskierung, Platz: OK',
);
