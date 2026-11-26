/* Fabio-Kurs: Inhalt vollständig, Fortschritt teilt sich die Zeile mit dem
   Orderflow-Bootcamp, ohne dessen Zahlen zu verfälschen, Seite ist verdrahtet. */

const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const ofDaten = fs.readFileSync('modules/orderflow-data.js', 'utf8');
const ofQuelle = fs.readFileSync('modules/orderflow.js', 'utf8');
const daten = fs.readFileSync('modules/fabio-data.js', 'utf8');
const quelle = fs.readFileSync('modules/fabio.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const core = fs.readFileSync('modules/core.js', 'utf8');
const serviceWorker = fs.readFileSync('sw.js', 'utf8');

// ---------------------------------------------------------------------------
// Gefakte Umgebung wie in orderflow.test.js
// ---------------------------------------------------------------------------
const elemente = {};
const element = id =>
  (elemente[id] ||= {
    innerHTML: '',
    classList: { add() {}, remove() {} },
    querySelector: () => ({ src: '' }),
  });
let gespeichert = null;
const sb = {
  from(tabelle) {
    assert.strictEqual(tabelle, 'orderflow_progress');
    return {
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: gespeichert, error: null }) }),
      }),
      upsert: async (zeile, optionen) => {
        assert.strictEqual(optionen?.onConflict, 'user_id');
        gespeichert = JSON.parse(JSON.stringify(zeile));
        return { error: null };
      },
    };
  },
};
const speicher = {};
const context = vm.createContext({
  console,
  sb,
  currentUser: { id: 'u1' },
  $: sel => (sel.startsWith('#') ? element(sel.slice(1)) : null),
  escapeHtml: v =>
    String(v ?? '').replace(
      /[&<>"']/g,
      ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[ch],
    ),
  showPage: () => {},
  alert: m => {
    throw new Error('Unerwarteter Alert: ' + m);
  },
  window: { scrollTo() {} },
  localStorage: {
    getItem: k => speicher[k] ?? null,
    setItem: (k, v) => {
      speicher[k] = String(v);
    },
  },
});
vm.runInContext(ofDaten, context);
vm.runInContext(ofQuelle, context);
vm.runInContext(daten, context);
vm.runInContext(quelle, context);
const wert = ausdruck => vm.runInContext(ausdruck, context);

// ---------------------------------------------------------------------------
// Inhalt
// ---------------------------------------------------------------------------
const teile = JSON.parse(JSON.stringify(wert('FABIO_PARTS')));
const quiz = JSON.parse(JSON.stringify(wert('FABIO_QUIZ')));
const lektionen = teile.flatMap(t => t.lessons);
const lektionsIds = lektionen.map(l => l.id);
const fragen = Object.values(quiz).flat();
const bootcampIds = JSON.parse(JSON.stringify(wert('ORDERFLOW_PARTS')))
  .flatMap(t => t.lessons.map(l => l.id))
  .concat(
    Object.values(JSON.parse(JSON.stringify(wert('ORDERFLOW_QUIZ'))))
      .flat()
      .map(q => q.id),
  );

assert.deepStrictEqual(
  teile.map(t => t.id),
  teile.map((_, i) => i + 1),
  'Teile laufen 1, 2, 3 …',
);
assert.strictEqual(new Set(lektionsIds).size, lektionsIds.length, 'Lektions-IDs eindeutig');
teile.forEach(t =>
  t.lessons.forEach(l => {
    assert.match(
      l.id,
      new RegExp(`^f${t.id}\\.\\d+$`),
      `Lektion ${l.id} trägt das f und ihren Teil`,
    );
    assert.ok(l.blocks.length > 0, `Lektion ${l.id} hat Inhalt`);
    assert.ok(
      l.blocks.some(b => b.merk),
      `Lektion ${l.id} endet mit einem Merksatz`,
    );
  }),
);
assert.strictEqual(new Set(fragen.map(q => q.id)).size, fragen.length, 'Quiz-IDs eindeutig');
Object.entries(quiz).forEach(([teil, liste]) =>
  liste.forEach(q => {
    assert.ok(q.id.startsWith(`f${teil}-`), `Frage ${q.id} gehört zu Teil ${teil}`);
    assert.strictEqual(q.o.length, 4, `Frage ${q.id} hat vier Antworten`);
    assert.strictEqual(new Set(q.o).size, 4, `Frage ${q.id} hat keine doppelten Antworten`);
    assert.ok(q.e.length > 20, `Frage ${q.id} hat eine Erklärung`);
  }),
);
lektionsIds
  .concat(fragen.map(q => q.id))
  .forEach(id =>
    assert.ok(!bootcampIds.includes(id), `${id} kollidiert nicht mit dem Orderflow-Bootcamp`),
  );

// ---------------------------------------------------------------------------
// Verhalten
// ---------------------------------------------------------------------------
(async () => {
  await context.loadOrderflow();
  context.renderOrderflow();
  context.renderFabio();
  let s = wert('fabioStats()');
  assert.deepStrictEqual(
    [s.read, s.lessons, s.right, s.questions],
    [0, lektionen.length, 0, fragen.length],
    'leerer Start',
  );
  assert.match(element('fabioRoot').innerHTML, /Los geht’s mit<\/span>1\.1 /, 'Start bei 1.1');
  assert.match(element('fabioTeaser').innerHTML, new RegExp(`0/${lektionen.length} Lektionen`));

  // Lektion öffnen: gelesen, gespeichert in derselben Zeile wie das Bootcamp
  await context.openFabioLesson('f2.1');
  assert.ok(gespeichert.read['f2.1'], 'gelesen gespeichert');
  const lektion = element('fabioRoot').innerHTML;
  assert.match(lektion, /<h2>2\.1 Die Idee<\/h2>/);
  assert.match(lektion, /class="of-intro"/, 'Einleitung des Teils vor der ersten Lektion');
  assert.match(lektion, /class="of-table"/, 'Tabellen werden gezeichnet');
  assert.match(lektion, /Weiter: 2\.2/);
  assert.strictEqual(wert('orderflowStats().read'), 0, 'Bootcamp-Zähler bleibt unberührt');
  assert.match(element('orderflowTeaser').innerHTML, /0\/33 Lektionen/);

  // Letzte Lektion eines Teils führt ins Quiz
  await context.openFabioLesson('f2.4');
  assert.match(element('fabioRoot').innerHTML, /startFabioQuiz\('2'\)/);

  // Quiz: richtig und falsch
  context.startFabioQuiz('2');
  const richtig = () => wert('fabioQuiz.options.findIndex(o => o.ok)');
  await context.answerFabio(richtig());
  assert.strictEqual(gespeichert.answers['f2-1'], true);
  assert.match(element('fabioRoot').innerHTML, /Richtig!/);
  context.nextFabioQuestion();
  await context.answerFabio((richtig() + 1) % 4);
  assert.strictEqual(gespeichert.answers['f2-2'], false);
  assert.deepStrictEqual([...wert('fabioWrongIds()')], ['f2-2']);
  assert.strictEqual(wert('orderflowWrongIds().length'), 0, 'Bootcamp-Fehler bleiben getrennt');
  s = wert('fabioStats()');
  assert.deepStrictEqual([s.right, s.wrong], [1, 1]);

  // Fehler üben, dann richtig → verschwindet
  context.startFabioWrongQuiz();
  assert.deepStrictEqual([...wert('fabioQuiz.ids')], ['f2-2']);
  await context.answerFabio(richtig());
  context.nextFabioQuestion();
  assert.strictEqual(wert('fabioView.mode'), 'result');
  assert.strictEqual(wert('fabioWrongIds().length'), 0);

  // Bootcamp-Fortschritt bleibt erhalten, wenn Fabio speichert
  await context.openOrderflowLesson('1.1');
  await context.openFabioLesson('f3.1');
  assert.ok(gespeichert.read['1.1'] && gespeichert.read['f3.1'], 'beide Kurse in einer Zeile');

  // -------------------------------------------------------------------------
  // Verdrahtung
  // -------------------------------------------------------------------------
  assert.match(
    index,
    /<section\s+id="fabio"\s+class="page orderflow-page[^"]*"/,
    'Stile des Bootcamps greifen',
  );
  assert.match(index, /id="fabioRoot"/);
  assert.match(index, /id="fabioTeaser"/, 'Teaser in der Academy');
  assert.match(index, /class="nav"\s+data-page="fabio"/, 'Seitenleiste');
  assert.match(index, /<button\s+data-page="fabio">/, 'Wissen-Sheet auf dem Handy');
  assert.match(index, /modules\/fabio-data\.js\?v=\d+/);
  assert.match(index, /modules\/fabio\.js\?v=\d+/);
  assert.ok(
    index.indexOf('modules/orderflow.js') < index.indexOf('fabio-data.js') &&
      index.indexOf('fabio-data.js') < index.indexOf('modules/fabio.js'),
    'Reihenfolge: orderflow.js, dann Fabio-Daten, dann Fabio-Modul',
  );
  assert.match(serviceWorker, /'\.\/modules\/fabio-data\.js\?v=\d+'/);
  assert.match(serviceWorker, /'\.\/modules\/fabio\.js\?v=\d+'/);
  assert.match(app, /renderOrderflow\(\);\s*renderFabio\(\)/, 'nach dem Laden des Fortschritts');
  assert.match(core, /mobileWissenPages\s*=\s*new Set\([^)]*'fabio'/);

  console.log('fabio.test.js grün');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
