/* Zitat des Tages.

   Zwei Dinge können hier schiefgehen, und beide fallen im Alltag nicht auf:
   das Zitat wechselt beim Neuladen (dann ist es kein Tageszitat mehr), oder ein
   Eintrag hat kein Feld und die Karte zeigt eine leere Zeile. Beides wird
   geprüft. Was ein Test nicht kann, ist die Zuschreibung belegen — das ist
   Recherche, kein Code. Geprüft wird deshalb nur, dass jeder Satz überhaupt
   eine Person trägt. */

const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const quelle = fs.readFileSync('modules/quotes.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const styles = fs.readFileSync('styles.css', 'utf8');
const serviceWorker = fs.readFileSync('sw.js', 'utf8');

const knoten = new Map();
const machKnoten = () => ({
  textContent: '',
  klassen: new Set(),
  classList: {
    add(name) {
      this.eltern.klassen.add(name);
    },
    remove(name) {
      this.eltern.klassen.delete(name);
    },
    toggle(name, an) {
      if (an) this.eltern.klassen.add(name);
      else this.eltern.klassen.delete(name);
    },
  },
});
const speicher = new Map();
const context = vm.createContext({
  console: { warn: () => {}, log: () => {}, error: () => {} },
  JSON,
  Number,
  Date,
  Math,
  localStorage: {
    getItem: schluessel => (speicher.has(schluessel) ? speicher.get(schluessel) : null),
    setItem: (schluessel, wert) => speicher.set(schluessel, String(wert)),
    removeItem: schluessel => speicher.delete(schluessel),
  },
  $: selektor => {
    if (!knoten.has(selektor)) {
      const el = machKnoten();
      el.classList.eltern = el;
      knoten.set(selektor, el);
    }
    return knoten.get(selektor);
  },
});
vm.runInContext(quelle, context);
/* QUOTES ist mit const deklariert und haengt damit nicht am Kontext-Objekt.
   context.QUOTES waere undefined und jede Schleife darueber still leer. */
const liste = vm.runInContext('QUOTES', context);

// ---------------------------------------------------------------------------
// Die Liste selbst
// ---------------------------------------------------------------------------
assert.ok(Array.isArray(liste), 'QUOTES ist ein Array');
assert.ok(liste.length >= 20, `genug Zitate für eine Rotation: ${liste.length}`);

liste.forEach((zitat, i) => {
  assert.ok(typeof zitat.t === 'string' && zitat.t.trim().length > 15, `Zitat ${i}: Text fehlt`);
  assert.ok(typeof zitat.p === 'string' && zitat.p.trim(), `Zitat ${i}: Person fehlt`);
  assert.strictEqual(typeof zitat.w, 'string', `Zitat ${i}: Werk ist kein String`);
  /* Ein Zitat ohne Person ist genau das, was diese Karte nicht zeigen soll —
     "schlaue Sprüche von niemandem" war ausdrücklich nicht gewünscht. */
  assert.ok(!/^(unbekannt|anonym|sprichwort)/i.test(zitat.p), `Zitat ${i}: keine echte Person`);
});

// Keine Dubletten — sechs Wochen Rotation mit demselben Satz zweimal fiele auf.
const texte = liste.map(z => z.t);
assert.strictEqual(new Set(texte).size, texte.length, 'kein Zitat steht doppelt in der Liste');

/* Die drei Richtungen sollen gemischt sein, nicht blockweise. Prüfbar über die
   Personen: dieselbe Person darf nie zweimal hintereinander kommen. */
liste.reduce((vorher, zitat, i) => {
  assert.notStrictEqual(zitat.p, vorher, `Zitat ${i}: ${zitat.p} steht zweimal hintereinander`);
  return zitat.p;
}, null);

/* Die drei bei der Prüfung gestrichenen Zitate dürfen nicht zurückkommen.
   Sie sind alle drei plausibel und stehen überall im Netz — genau deshalb. */
for (const gestrichen of ['zehntausend Tritte', 'sondern im Warten', 'Du kannst dich vorbereiten']) {
  assert.ok(!quelle.includes(`t: '${gestrichen}`), `gestrichenes Zitat wieder drin: ${gestrichen}`);
  assert.ok(
    !texte.some(t => t.includes(gestrichen)),
    `gestrichenes Zitat wieder in der Liste: ${gestrichen}`,
  );
}

// ---------------------------------------------------------------------------
// Ein Tag, ein Zitat: beim Neuladen darf es nicht wechseln
// ---------------------------------------------------------------------------
const tagesnummer = ausdruck => vm.runInContext(ausdruck, context);

const heute = tagesnummer('quoteTagesnummer(new Date(2026, 7, 24, 9, 0))');
const heuteSpaet = tagesnummer('quoteTagesnummer(new Date(2026, 7, 24, 23, 59))');
assert.strictEqual(heute, heuteSpaet, 'derselbe Tag ergibt dieselbe Nummer');
assert.strictEqual(
  tagesnummer('quoteTagesnummer(new Date(2026, 7, 25, 0, 1))'),
  heute + 1,
  'der nächste Tag zählt genau um eins weiter',
);

/* Die Zeitumstellung ist die Stelle, an der eine Tagesnummer kippen kann — aber
   nur in manchen Zeitzonen, und der Testlauf hier laeuft in UTC. Eine Pruefung
   im eigenen Prozess waere deshalb immer gruen, egal wie gerechnet wird.
   Gegengeprueft: mit der naheliegenden Rechnung new Date(j,m,t).getTime()/86400000
   lief dieser Test gruen durch, obwohl der 29. und 30. Maerz in London
   dieselbe Nummer bekommen. Deshalb ein eigener Prozess je Zeitzone. */
const { execFileSync } = require('child_process');
const zonen = [
  'Europe/Vienna', // Christians Zeitzone
  'Europe/London', // Versatz wechselt ueber null — hier bricht die naive Rechnung
  'Atlantic/Reykjavik',
  'America/New_York',
  'Australia/Lord_Howe', // Umstellung um nur eine halbe Stunde
  'Pacific/Chatham',
];
const pruefSkript = `
  const fs = require('fs');
  ${quelle.includes('function quoteTagesnummer') ? '' : 'throw new Error("Funktion fehlt");'}
  eval(fs.readFileSync(process.argv[1], 'utf8').split('const QUOTE_VERSATZ_KEY')[0]);
  let vorher = null;
  const tag = new Date(2026, 0, 1);
  for (let i = 0; i < 400; i++) {
    const nummer = quoteTagesnummer(tag);
    if (vorher !== null && nummer !== vorher + 1) {
      console.log('SPRUNG ' + tag.toDateString() + ' ' + vorher + ' -> ' + nummer);
      process.exit(1);
    }
    vorher = nummer;
    tag.setDate(tag.getDate() + 1);
  }
  console.log('OK');
`;
for (const zone of zonen) {
  /* Der Kindprozess endet bei einem Sprung mit Code 1 und execFileSync wirft
     dann. Ohne dieses catch bekaeme man einen Stapel statt der Fundstelle. */
  let ausgabe;
  try {
    ausgabe = execFileSync('node', ['-e', pruefSkript, 'modules/quotes.js'], {
      env: { ...process.env, TZ: zone },
      encoding: 'utf8',
    }).trim();
  } catch (fehler) {
    ausgabe = String(fehler.stdout || '').trim() || fehler.message;
  }
  assert.strictEqual(ausgabe, 'OK', `${zone}: Tagesnummer laeuft nicht sauber weiter — ${ausgabe}`);
}

// Über ein ganzes Jahr kommt jedes Zitat gleich oft und keines gar nicht.
const gesehen = new Map();
for (let i = 0; i < liste.length * 3; i++) {
  const zitat = vm.runInContext(`quoteDesTages(${heute + i}, 0)`, context);
  gesehen.set(zitat.t, (gesehen.get(zitat.t) || 0) + 1);
}
assert.strictEqual(gesehen.size, liste.length, 'jedes Zitat kommt in drei Runden vor');
assert.ok([...gesehen.values()].every(n => n === 3), 'und jedes genau gleich oft');

// Kein Absturz bei Datumsangaben vor 1970 (negative Tagesnummer).
assert.ok(vm.runInContext('quoteDesTages(-19000, 0)', context), 'negative Tagesnummer geht');
assert.ok(vm.runInContext('quoteDesTages(0, -5)', context), 'negativer Versatz geht');

// ---------------------------------------------------------------------------
// Weitertippen gilt nur für heute
// ---------------------------------------------------------------------------
speicher.clear();
vm.runInContext('renderQuote();', context);
const ersteAnzeige = knoten.get('#quoteText').textContent;
assert.ok(ersteAnzeige.length > 15, 'die Karte zeigt einen Satz');
assert.ok(knoten.get('#quotePerson').textContent.trim(), 'mit Person');

vm.runInContext('naechstesQuote();', context);
const zweiteAnzeige = knoten.get('#quoteText').textContent;
assert.notStrictEqual(zweiteAnzeige, ersteAnzeige, 'Tippen holt ein anderes Zitat');

vm.runInContext('renderQuote();', context);
assert.strictEqual(
  knoten.get('#quoteText').textContent,
  zweiteAnzeige,
  'ein zweites Rendern am selben Tag bleibt beim gewählten Zitat',
);

/* Der gemerkte Versatz gehört zu einem Tag. Steht dort ein anderer Tag, faellt
   die App auf das Zitat des Tages zurueck — sonst wuerde ein einmaliges
   Weitertippen die Reihenfolge dauerhaft verschieben. */
speicher.set('northstar-quote-versatz', JSON.stringify({ tag: heute - 30, versatz: 7 }));
assert.strictEqual(vm.runInContext('quoteVersatzLesen()', context), 0, 'alter Versatz zählt nicht');

// Kaputter oder blockierter Speicher darf die Karte nicht reißen.
speicher.set('northstar-quote-versatz', '{kein json');
assert.strictEqual(vm.runInContext('quoteVersatzLesen()', context), 0, 'Schrott im Speicher: 0');
vm.runInContext(
  `localStorage.getItem = () => { throw new Error('blockiert'); };
   localStorage.setItem = () => { throw new Error('blockiert'); };`,
  context,
);
assert.doesNotThrow(() => vm.runInContext('renderQuote();', context), 'ohne Speicher rendert es');
assert.doesNotThrow(() => vm.runInContext('naechstesQuote();', context), 'und tippt es sich');

// ---------------------------------------------------------------------------
// Ohne Werkangabe bleibt keine leere Zeile stehen
// ---------------------------------------------------------------------------
const werk = knoten.get('#quoteWork');
const ohneWerk = liste.findIndex(z => !z.w);
if (ohneWerk >= 0) {
  vm.runInContext(`$('#quoteWork').klassen.clear();`, context);
  const nummer = vm.runInContext('quoteTagesnummer()', context);
  /* Den Versatz so waehlen, dass genau ein Zitat ohne Werkangabe drankommt —
     sonst prueft dieser Abschnitt je nach Kalendertag gar nichts. */
  const versatz = (ohneWerk - (nummer % liste.length) + liste.length) % liste.length;
  const zitat = vm.runInContext(`quoteDesTages(quoteTagesnummer(), ${versatz})`, context);
  assert.strictEqual(zitat.w, '', 'der Versatz trifft wirklich ein Zitat ohne Werk');
}

// ---------------------------------------------------------------------------
// Verdrahtung
// ---------------------------------------------------------------------------
const seite = index.slice(
  index.indexOf('<section id="today"'),
  index.indexOf('<section id="trading"'),
);
for (const id of ['id="quoteCard"', 'id="quoteText"', 'id="quotePerson"', 'id="quoteWork"']) {
  assert.ok(seite.includes(id), `${id} fehlt in der Karte`);
}
assert.match(seite, /onclick="naechstesQuote\(\)"/, 'Tippen ist verdrahtet');
/* Mit der Tastatur muss es auch gehen — die Karte ist ein div, kein button. */
assert.match(seite, /role="button"/);
assert.match(seite, /tabindex="0"/);
assert.match(seite, /onkeydown="[^"]*naechstesQuote\(\)/, 'Enter und Leertaste lösen auch aus');

assert.match(app, /renderQuote\(\)/, 'renderQuote läuft beim Start');
assert.match(styles, /\.quote-card\b/);
assert.match(styles, /\.quote-work\.hide\b/);

/* textContent statt innerHTML: dann muss nichts maskiert werden und ein spaeter
   eingetragener Satz mit < oder & kann nichts kaputt machen. */
assert.ok(!/quoteText[\s\S]{0,80}innerHTML/.test(quelle), 'der Zitattext geht über textContent');

assert.strictEqual(
  (serviceWorker.match(/\.\/modules\/quotes\.js\?v=(\d+)/) || [])[1],
  (index.match(/modules\/quotes\.js\?v=(\d+)/) || [])[1],
  'quotes.js: Version laeuft auseinander',
);
assert.strictEqual(
  (serviceWorker.match(/styles\.css\?v=(\d+)/) || [])[1],
  (index.match(/styles\.css\?v=(\d+)/) || [])[1],
  'styles.css: Version laeuft auseinander',
);

console.log(
  `Zitat des Tages: ${liste.length} belegte Zitate, ein Tag ein Satz, Zeitumstellung, Speicherausfall, Platz: OK`,
);
