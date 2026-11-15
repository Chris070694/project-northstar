/* Orderflow-Bootcamp: Inhalt vollständig, Fortschritt rechnet richtig, Seite
   ist verdrahtet. Der Fortschritt hängt an den Quiz-IDs — fehlen oder doppeln
   die, zählt die App falsch, ohne dass es auffällt. */

const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const daten = fs.readFileSync('modules/orderflow-data.js', 'utf8');
const quelle = fs.readFileSync('modules/orderflow.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const core = fs.readFileSync('modules/core.js', 'utf8');
const backup = fs.readFileSync('modules/backup.js', 'utf8');
const serviceWorker = fs.readFileSync('sw.js', 'utf8');
const styles = fs.readFileSync('styles-orderflow.css', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20261115_orderflow_progress.sql', 'utf8');

// ---------------------------------------------------------------------------
// Gefakte Umgebung: DOM-Elemente nach ID, Supabase mit einer Zeile Speicher
// ---------------------------------------------------------------------------
const elemente = {};
const element = id =>
  (elemente[id] ||= {
    innerHTML: '',
    classList: { add() {}, remove() {} },
    querySelector: () => ({ src: '' }),
  });
let gespeichert = null;
let tabelleFehlt = false;
const sb = {
  from(tabelle) {
    assert.strictEqual(tabelle, 'orderflow_progress');
    const fehler = tabelleFehlt
      ? { code: 'PGRST205', message: "Could not find the table 'public.orderflow_progress'" }
      : null;
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: fehler ? null : gespeichert, error: fehler }),
        }),
      }),
      upsert: async (zeile, optionen) => {
        if (fehler) return { error: fehler };
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
vm.runInContext(daten, context);
vm.runInContext(quelle, context);
const wert = ausdruck => vm.runInContext(ausdruck, context);

// ---------------------------------------------------------------------------
// Inhalt
// ---------------------------------------------------------------------------
const teile = JSON.parse(JSON.stringify(wert('ORDERFLOW_PARTS')));
const quiz = JSON.parse(JSON.stringify(wert('ORDERFLOW_QUIZ')));
assert.deepStrictEqual(
  teile.map(t => t.id),
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  'Vorwort, sieben Teile, Checkliste, Wörterbuch',
);
const kursLektionen = teile.filter(t => t.id >= 1 && t.id <= 7).flatMap(t => t.lessons);
assert.strictEqual(kursLektionen.length, 33, '33 Lektionen in Teil 1 bis 7');
const lektionsIds = teile.flatMap(t => t.lessons.map(l => l.id));
assert.strictEqual(new Set(lektionsIds).size, lektionsIds.length, 'Lektions-IDs eindeutig');
teile.forEach(t =>
  t.lessons.forEach(l => assert.ok(l.blocks.length > 0, `Lektion ${l.id} hat Inhalt`)),
);

const bilder = teile
  .flatMap(t => [...t.intro, ...t.lessons.flatMap(l => l.blocks)])
  .filter(b => b.img)
  .map(b => b.img);
assert.strictEqual(bilder.length, 23, 'alle 23 Bilder des Handbuchs sind eingebunden');
const merksaetze = kursLektionen.flatMap(l => l.blocks).filter(b => b.merk);
assert.ok(merksaetze.length >= 30, 'jede Lektion endet mit einem Merksatz');

const fragen = Object.values(quiz).flat();
assert.deepStrictEqual(Object.keys(quiz), ['1', '2', '3', '4', '5', '6', '7'], 'ein Quiz pro Teil');
assert.strictEqual(fragen.length, 47);
assert.strictEqual(new Set(fragen.map(q => q.id)).size, 47, 'Quiz-IDs eindeutig');
Object.entries(quiz).forEach(([teil, liste]) =>
  liste.forEach(q => {
    assert.ok(q.id.startsWith(`${teil}-`), `Frage ${q.id} gehört zu Teil ${teil}`);
    assert.strictEqual(q.o.length, 4, `Frage ${q.id} hat vier Antworten`);
    assert.strictEqual(new Set(q.o).size, 4, `Frage ${q.id} hat keine doppelten Antworten`);
    assert.ok(q.e.length > 20, `Frage ${q.id} hat eine Erklärung`);
  }),
);
[...bilder, ...fragen.filter(q => q.img).map(q => q.img)].forEach(name =>
  assert.ok(fs.existsSync(`assets/orderflow/${name}.png`), `Bild ${name}.png liegt im Repo`),
);

// ---------------------------------------------------------------------------
// Verhalten: Laden, Lesen, Quiz, Fehler üben
// ---------------------------------------------------------------------------
(async () => {
  await context.loadOrderflow();
  context.renderOrderflow();
  let s = wert('orderflowStats()');
  assert.deepStrictEqual(
    [s.read, s.lessons, s.right, s.questions, s.wrong],
    [0, 33, 0, 47, 0],
    'leerer Start',
  );
  assert.match(
    element('orderflowRoot').innerHTML,
    /Los geht’s mit<\/span>So nutzt du den Kurs/,
    'Start beim Vorwort',
  );
  assert.match(element('orderflowTeaser').innerHTML, /0\/33 Lektionen/);

  // Lektion öffnen markiert sie als gelesen und speichert
  await context.openOrderflowLesson('1.1');
  assert.ok(gespeichert.read['1.1'], 'gelesen gespeichert');
  assert.strictEqual(gespeichert.user_id, 'u1');
  const lektion = element('orderflowRoot').innerHTML;
  assert.match(lektion, /<b>Was ist das\?<\/b>/, '**fett** wird zu <b>');
  assert.match(lektion, /class="of-merk"/, 'Merksatz hervorgehoben');
  assert.match(
    lektion,
    /Der Markt ist eine Auktion/,
    'Einleitung des Teils steht über der ersten Lektion',
  );
  assert.match(lektion, /Weiter: 1\.2/);
  assert.strictEqual(
    wert('orderflowNextLesson().lesson.id'),
    '1.2',
    'nach 1.1 geht es mit 1.2 weiter, nicht zurück zum ungelesenen Vorwort',
  );
  await context.openOrderflowLesson('1.3');
  assert.match(
    element('orderflowRoot').innerHTML,
    /du, <em>wann<\/em> der Preis/,
    '*kursiv* wird zu <em>',
  );
  assert.doesNotMatch(element('orderflowRoot').innerHTML, /\*wann\*/);

  // Bildlektion: Pfad zeigt auf assets/orderflow
  await context.openOrderflowLesson('1.2');
  assert.match(element('orderflowRoot').innerHTML, /src="assets\/orderflow\/bild01\.png"/);

  // Letzte Lektion eines Teils führt ins Quiz
  await context.openOrderflowLesson('2.2');
  assert.match(element('orderflowRoot').innerHTML, /startOrderflowQuiz\('2'\)/);

  // Quiz Teil 2: erste Frage richtig, zweite falsch
  context.startOrderflowQuiz('2');
  const richtigeStelle = () => wert('orderflowQuiz.options.findIndex(o => o.ok)');
  await context.answerOrderflow(richtigeStelle());
  assert.strictEqual(gespeichert.answers['2-1'], true);
  assert.match(element('orderflowRoot').innerHTML, /Richtig!/);
  context.answerOrderflow((richtigeStelle() + 1) % 4); // zweiter Klick auf dieselbe Frage zählt nicht
  assert.strictEqual(wert('orderflowQuiz.right'), 1);
  context.nextOrderflowQuestion();
  await context.answerOrderflow((richtigeStelle() + 1) % 4);
  assert.strictEqual(gespeichert.answers['2-2'], false);
  assert.match(element('orderflowRoot').innerHTML, /Leider falsch\./);
  s = wert('orderflowStats()');
  assert.deepStrictEqual([s.right, s.wrong], [1, 1]);
  assert.deepStrictEqual([...wert('orderflowWrongIds()')], ['2-2']);

  // Bis zum Ende durchklicken -> Ergebnis
  for (let i = 2; i < quiz['2'].length; i++) {
    context.nextOrderflowQuestion();
    await context.answerOrderflow(richtigeStelle());
  }
  context.nextOrderflowQuestion();
  assert.strictEqual(wert('orderflowView.mode'), 'result');
  assert.match(
    element('orderflowRoot').innerHTML,
    new RegExp(`${quiz['2'].length - 1}/${quiz['2'].length}`),
  );

  // Fehler üben enthält nur die falsche Frage; richtig beantwortet verschwindet sie
  context.startOrderflowWrongQuiz();
  assert.deepStrictEqual([...wert('orderflowQuiz.ids')], ['2-2']);
  await context.answerOrderflow(richtigeStelle());
  assert.strictEqual(wert('orderflowWrongIds().length'), 0);

  // Neu laden holt denselben Stand aus Supabase
  vm.runInContext('orderflowProgress = { read: {}, answers: {} }', context);
  await context.loadOrderflow();
  assert.strictEqual(wert('orderflowStats().read'), 4);

  // Ohne Tabelle: Rückfall auf localStorage, kein Fehler
  tabelleFehlt = true;
  await context.loadOrderflow();
  assert.strictEqual(wert('orderflowRemote'), false);
  assert.strictEqual(wert('orderflowStats().read'), 4, 'lokale Kopie trägt den Stand');
  await context.openOrderflowLesson('3.1');
  assert.ok(JSON.parse(speicher['cprb-orderflow-progress']).read['3.1']);
  context.showOrderflowOverview();
  assert.match(element('orderflowRoot').innerHTML, /nur auf diesem Gerät/);

  // -------------------------------------------------------------------------
  // Verdrahtung
  // -------------------------------------------------------------------------
  assert.match(index, /<section\s+id="orderflow"\s+class="page[^"]*"/);
  assert.match(index, /id="orderflowRoot"/);
  assert.match(index, /id="orderflowTeaser"/, 'Teaser in der Academy');
  assert.match(index, /id="orderflowZoom"/);
  assert.match(index, /class="nav"\s+data-page="orderflow"/, 'Seitenleiste');
  assert.match(index, /<button\s+data-page="orderflow">/, 'Wissen-Sheet auf dem Handy');
  assert.match(index, /modules\/orderflow-data\.js\?v=\d+/);
  assert.match(index, /modules\/orderflow\.js\?v=\d+/);
  assert.match(index, /styles-orderflow\.css\?v=\d+/);
  assert.ok(
    index.indexOf('orderflow-data.js') < index.indexOf('modules/orderflow.js'),
    'Daten vor dem Modul laden',
  );
  assert.match(serviceWorker, /'\.\/modules\/orderflow-data\.js\?v=\d+'/);
  assert.match(serviceWorker, /'\.\/modules\/orderflow\.js\?v=\d+'/);
  assert.match(serviceWorker, /'\.\/styles-orderflow\.css\?v=\d+'/);
  assert.match(app, /loadOrderflow\(\)/);
  assert.match(app, /renderOrderflow\(\)/);
  assert.match(core, /mobileWissenPages\s*=\s*new Set\([^)]*'orderflow'/);
  assert.match(backup, /name:\s*'orderflow_progress',\s*conflict:\s*'user_id'/);
  assert.match(backup, /CPRB_RESTORE_ORDER[\s\S]*'orderflow_progress'/);
  assert.match(migration, /enable row level security/i);
  assert.equal((migration.match(/create policy/gi) || []).length, 4);
  assert.match(migration, /notify pgrst,\s*'reload schema'/);
  styles
    .split('\n')
    .filter(zeile => /^[.#a-z]/i.test(zeile))
    .forEach(zeile =>
      assert.match(
        zeile,
        /^(\.orderflow-page|\.of-teaser|#orderflowZoom)/,
        `CSS bleibt gescoped: ${zeile}`,
      ),
    );

  console.log('orderflow.test.js grün');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
