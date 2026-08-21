const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'modules/motion.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const core = fs.readFileSync(path.join(root, 'modules/core.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

/* Die Datei wird ohne document geladen — die Selbstinitialisierung darf dabei
   nicht zuschlagen, sonst bricht sie in jeder Umgebung ohne DOM. */
const context = vm.createContext({ console, Intl, performance, matchMedia: undefined });
vm.runInContext(source, context);
const run = code => vm.runInContext(code, context);

/* ---- Zahlen aus Text schälen: die Formate, die in der App wirklich vorkommen ---- */

const cases = [
  ['670 $', 670, 0, '', ' $'],
  ['$1,234.00', 1234, 2, '$', ''],
  ['57%', 57, 0, '', '%'],
  ['+0.96R', 0.96, 2, '+', 'R'],
  ['3.48', 3.48, 2, '', ''],
  ['-120 $', -120, 0, '', ' $'],
  ['82,5 kg', 82.5, 1, '', ' kg'],
  ['1.234 $', 1234, 0, '', ' $'],
];

for (const [text, value, decimals, prefix, suffix] of cases) {
  const parsed = run(`parseAnimatableNumber(${JSON.stringify(text)})`);
  assert.ok(parsed, `${text} sollte erkannt werden`);
  assert.equal(parsed.value, value, `Wert aus ${text}`);
  assert.equal(parsed.decimals, decimals, `Nachkommastellen aus ${text}`);
  assert.equal(parsed.prefix, prefix, `Vorspann aus ${text}`);
  assert.equal(parsed.suffix, suffix, `Nachspann aus ${text}`);
}

/* Was keine Zahl ist, bleibt unangetastet — sonst stünde plötzlich NaN im Cockpit. */
for (const text of ['–', '', 'Noch keine Daten', '∞', null, undefined]) {
  assert.equal(
    run(`parseAnimatableNumber(${JSON.stringify(text ?? null)})`),
    null,
    `${text} ist keine Zahl`,
  );
}

/* Der Endzustand muss exakt dem Ausgangstext entsprechen, sonst ändert
   die Animation stillschweigend angezeigte Werte. */
for (const [text] of cases) {
  const parsed = run(`parseAnimatableNumber(${JSON.stringify(text)})`);
  const final = run(
    `formatAnimatedNumber(parseAnimatableNumber(${JSON.stringify(text)}), parseAnimatableNumber(${JSON.stringify(text)}).value)`,
  );
  assert.equal(
    final.replace(/\s/g, ''),
    text.replace(/\s/g, ''),
    `${text} kommt unverändert wieder heraus (geparst als ${parsed.value})`,
  );
}

/* ---- Die Beschleunigungskurve ----
   Der Zeitstempel des ersten Bildes kann vor dem Startzeitpunkt liegen. Ohne
   Klemmen wird die Kurve negativ, und eine positive Zahl blitzt im Minus auf. */

assert.equal(run('motionEase(-40, 780)'), 0, 'vor dem Start bleibt sie bei null');
assert.equal(run('motionEase(0, 780)'), 0, 'am Start null');
assert.equal(run('motionEase(780, 780)'), 1, 'am Ende eins');
assert.equal(run('motionEase(5000, 780)'), 1, 'danach bleibt sie bei eins');
assert.ok(
  run('motionEase(200, 780)') > 0 && run('motionEase(200, 780)') < 1,
  'dazwischen dazwischen',
);
assert.ok(
  run('motionEase(100, 780)') < run('motionEase(300, 780)'),
  'sie steigt monoton — die Zahl läuft nie rückwärts',
);
assert.ok(
  run('motionEase(100, 780) > 0.4'),
  'sie startet schnell — die ersten Frames tragen den meisten Weg',
);

/* ---- Richtung des Seitenwechsels ---- */

assert.equal(run("motionDirection('today','trading')"), 1, 'nach rechts');
assert.equal(run("motionDirection('fitness','today')"), -1, 'nach links');
assert.equal(run("motionDirection('today','today')"), 1, 'gleiche Seite');
assert.equal(run("motionDirection('notes','library')"), 1, 'Seiten außerhalb der Tableiste');

/* ---- Verdrahtung ---- */

assert.match(core, /motionSwapPage/, 'showPage übergibt den Wechsel an die Bewegungsschicht');
assert.match(core, /typeof motionSwapPage === 'function'/, 'ohne motion.js läuft showPage weiter');
assert.match(index, /modules\/motion\.js\?v=\d+/, 'motion.js ist eingebunden');
assert.match(
  fs.readFileSync(path.join(root, 'sw.js'), 'utf8'),
  /modules\/motion\.js\?v=\d+/,
  'motion.js liegt in der App-Shell',
);

/* ---- Bewegung ist abschaltbar ---- */

assert.match(
  css,
  /@media \(prefers-reduced-motion: reduce\)/,
  'Bewegung respektiert die Systemwahl',
);
assert.match(source, /prefers-reduced-motion: reduce/, 'auch im Skript');
assert.match(source, /if \(motionReduced\) return;/, 'Zahlen zählen dann nicht hoch');

/* ---- Zahlen starten erst nach dem Seitenübergang ----
   Während einer View Transition ruht die Animationsschleife. Startete das
   Hochzählen davor, wäre seine Laufzeit beim ersten Frame schon abgelaufen. */
assert.match(
  source,
  /transition\.finished\.then\(motionCountUp\)/,
  'Zahlen warten auf das Ende des Übergangs',
);
assert.match(
  source,
  /\.catch\(\(\) => motionCountUp\(\)\)/,
  'auch ein abgebrochener Übergang zählt hoch',
);
assert.doesNotMatch(
  source,
  /function motionAfterPage\(\) \{[^}]*animateNumbersIn/s,
  'motionAfterPage läuft im Übergang und darf dort nichts animieren',
);

console.log('Bewegung: Zahlenformate, Richtung, Verdrahtung und Abschaltbarkeit: OK');
