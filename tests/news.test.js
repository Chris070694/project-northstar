/* Wirtschaftskalender.
   Der heikle Teil ist die Zeit: der Feed liefert US-Ostküstenzeit mit Offset,
   angezeigt wird Ortszeit. Und der Ausfall — eine leere Liste darf nicht wie
   "heute ist nichts los" aussehen. */

const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const quelle = fs.readFileSync('modules/news.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const styles = fs.readFileSync('styles.css', 'utf8');
const serviceWorker = fs.readFileSync('sw.js', 'utf8');
const funktion = fs.readFileSync('supabase/functions/forex-news/index.ts', 'utf8');

const knoten = new Map();
const context = vm.createContext({
  console,
  Intl,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  $: selektor => {
    if (!knoten.has(selektor)) knoten.set(selektor, { innerHTML: '', textContent: '' });
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
/* newsEvents ist mit let deklariert und haengt damit NICHT am Kontext-Objekt.
   context.newsEvents = [...] wuerde eine wirkungslose Property setzen und den
   Test still gruen lassen — deshalb ueber runInContext zuweisen. */
const setzeEvents = events =>
  vm.runInContext(`newsEvents = ${JSON.stringify(events)};`, context);

/* Echte Zeilen aus dem Feed, nicht erfundene — damit der Test am Format scheitert,
   wenn sich das Format ändert. */
const ECHTE_EVENTS = [
  {
    title: 'Core PCE Price Index m/m',
    country: 'USD',
    date: '2026-08-26T08:30:00-04:00',
    impact: 'high',
    forecast: '0.2%',
    previous: '0.1%',
  },
  {
    title: 'Fed Chairman Warsh Speaks',
    country: 'USD',
    date: '2026-08-28T10:00:00-04:00',
    impact: 'high',
    forecast: null,
    previous: null,
  },
];

// ---------------------------------------------------------------------------
// Zeit: der Feed kommt in New Yorker Zeit, angezeigt wird Ortszeit
// ---------------------------------------------------------------------------
/* 08:30 New York am 26.08. ist 14:30 in Wien (Sommerzeit, sechs Stunden).
   Der Test läuft in UTC, dort sind es 12:30 — geprüft wird also gegen die
   Zeitzone des Testlaufs, nicht gegen eine feste Zahl. */
const erwartet = new Intl.DateTimeFormat('de-AT', { hour: '2-digit', minute: '2-digit' }).format(
  new Date('2026-08-26T08:30:00-04:00'),
);
assert.strictEqual(context.newsZeit('2026-08-26T08:30:00-04:00'), erwartet);
assert.notStrictEqual(erwartet, '08:30', 'die Rohzeit wird umgerechnet, nicht durchgereicht');
assert.strictEqual(context.newsZeit('kaputt'), '', 'unbrauchbares Datum gibt leer');
/* new Date(null) ist der 1.1.1970, nicht ungueltig — ohne eigene Pruefung waere
   ein fehlendes Datum als "01:00" durchgegangen. */
assert.strictEqual(context.newsZeit(null), '');
assert.strictEqual(context.newsZeit(undefined), '');
assert.strictEqual(context.newsZeit(''), '');
assert.strictEqual(context.newsTagKey(null), '');
assert.strictEqual(
  context.istNewsVorbei({ date: null }, Date.now()),
  false,
  'ohne Datum ist nichts vorbei — sonst waere jeder Eintrag von 1970',
);
assert.strictEqual(context.newsMinutenBis({ date: null }), null);

// Der Tag richtet sich nach der Ortszeit, nicht nach dem Datumsteil im Text.
const tag = context.newsTagKey('2026-08-26T08:30:00-04:00');
assert.match(tag, /^\d{4}-\d{2}-\d{2}$/);
assert.strictEqual(context.newsTagKey('kaputt'), '');

// ---------------------------------------------------------------------------
// Vorbei, nächster Termin, Abstand
// ---------------------------------------------------------------------------
const jetzt = new Date('2026-08-26T13:00:00Z').getTime();
assert.strictEqual(context.istNewsVorbei(ECHTE_EVENTS[0], jetzt), true, '12:30 UTC liegt zurück');
assert.strictEqual(context.istNewsVorbei(ECHTE_EVENTS[1], jetzt), false, 'der 28. kommt noch');

const naechster = context.newsNaechster(ECHTE_EVENTS, jetzt);
assert.strictEqual(naechster.title, 'Fed Chairman Warsh Speaks');
assert.strictEqual(context.newsNaechster([], jetzt), null);
assert.strictEqual(
  context.newsNaechster([ECHTE_EVENTS[0]], jetzt),
  null,
  'sind alle durch, gibt es keinen nächsten',
);

assert.strictEqual(context.newsAbstandText(0), 'in 0 min');
assert.strictEqual(context.newsAbstandText(-5), 'gerade eben');
assert.strictEqual(context.newsAbstandText(45), 'in 45 min');
assert.strictEqual(context.newsAbstandText(60), 'in 1 h');
assert.strictEqual(context.newsAbstandText(95), 'in 1 h 35 min');
assert.strictEqual(context.newsAbstandText(1500), 'morgen');
assert.strictEqual(context.newsAbstandText(4320), 'in 3 Tagen');
assert.strictEqual(context.newsAbstandText(null), '');

// ---------------------------------------------------------------------------
// Ausgabe: ein Ausfall darf nicht wie ein ruhiger Tag aussehen
// ---------------------------------------------------------------------------
const zeige = () => knoten.get('#newsList').innerHTML;

wert("newsStatus = 'laden'; renderNews();");
assert.match(zeige(), /geladen/, 'im Ladezustand steht das auch da');

wert("newsStatus = 'fehler'; newsGrund = 'Kalender antwortet mit 502'; renderNews();");
assert.match(zeige(), /nicht erreichbar/, 'der Ausfall wird benannt');
assert.match(zeige(), /502/, 'mit Grund');
assert.match(zeige(), /Nochmal versuchen/, 'und einem Weg zurück');
assert.doesNotMatch(zeige(), /keine wichtigen/, 'Ausfall wird nicht als "nichts los" verkauft');

// Ruhiger Tag: keine heutigen Termine, aber die nächsten stehen trotzdem da.
setzeEvents([{ ...ECHTE_EVENTS[1], date: new Date(Date.now() + 86400000 * 3).toISOString() }]);
wert("newsStatus = 'ok'; renderNews();");
const ruhig = zeige();
assert.match(ruhig, /keine wichtigen US-Termine/, 'sagt, dass heute nichts ansteht');
assert.match(ruhig, /Als Nächstes/, 'zeigt trotzdem, was kommt');
assert.match(ruhig, /Fed Chairman/, 'mit dem Termin');

// Termine heute: Kopfzeile mit dem nächsten, dann die Liste.
const gleich = new Date(Date.now() + 5400000).toISOString();
setzeEvents([
  { title: 'Core PCE Price Index m/m', country: 'USD', date: gleich, impact: 'high',
    forecast: '0.2%', previous: '0.1%' },
]);
wert("newsStatus = 'ok'; renderNews();");
const mitTermin = zeige();
assert.match(mitTermin, /Nächster:/, 'der Kopf nennt den nächsten Termin');
assert.match(mitTermin, /Core PCE/);
assert.match(mitTermin, /in 1 h 30 min/, 'mit dem Abstand');
assert.match(mitTermin, /Prognose 0\.2%/, 'Prognose und Vorwert stehen dran');
assert.match(mitTermin, /zuvor 0\.1%/);
assert.strictEqual(knoten.get('#newsStatus').textContent, '1 offen');

// ---------------------------------------------------------------------------
// Maskierung
// ---------------------------------------------------------------------------
setzeEvents([
  {
    title: '<img src=x onerror=alert(1)>',
    country: 'USD',
    date: new Date(Date.now() + 3600000).toISOString(),
    impact: 'high',
    forecast: '<script>',
    previous: null,
  },
]);
wert("newsStatus = 'ok'; renderNews();");
assert.doesNotMatch(zeige(), /<img src=x/, 'Titel wird maskiert');
assert.doesNotMatch(zeige(), /<script>/, 'Werte werden maskiert');
assert.match(zeige(), /&lt;img/);

// ---------------------------------------------------------------------------
// Die Edge Function
// ---------------------------------------------------------------------------
assert.match(funktion, /nfs\.faireconomy\.media\/ff_calendar_thisweek\.json/);
assert.match(funktion, /currencies.*\|\|\s*'USD'/, 'Vorgabe USD');
assert.match(funktion, /impact.*\|\|\s*'high'/, 'Vorgabe nur High');
assert.match(funktion, /AbortSignal\.timeout/, 'ein hängender Feed blockiert nicht ewig');
assert.match(funktion, /ok: false/, 'Fehler werden als solche gemeldet');
assert.match(funktion, /Access-Control-Allow-Origin/);
// Die Zeitzonen-Umrechnung gehört zum Client, nicht in die Funktion.
assert.doesNotMatch(funktion, /Europe\/Vienna/, 'die Funktion kennt keine Zeitzone');

// ---------------------------------------------------------------------------
// Verdrahtung: die Karte steht ganz oben, Anker und Jetzt darunter
// ---------------------------------------------------------------------------
const seite = index.slice(
  index.indexOf('<section id="today"'),
  index.indexOf('<section id="trading"'),
);
const wo = suche => {
  const stelle = seite.indexOf(suche);
  assert.notStrictEqual(stelle, -1, `nicht gefunden: ${suche}`);
  return stelle;
};
assert.ok(wo('id="todayGreeting"') < wo('id="newsCard"'), 'die Begrüßung bleibt der Seitenkopf');
assert.ok(wo('id="newsCard"') < wo('id="todayAnchor"'), 'News stehen über dem Anker');
assert.ok(wo('id="todayAnchor"') < wo('id="todayNow"'), 'Anker über der Jetzt-Karte');
assert.ok(wo('id="todayNow"') < wo('>Heute</div>'), 'beide bleiben in der Jetzt-Zone');

assert.match(app, /loadNews\(\)/);
assert.match(app, /renderNews\(\)/);
assert.match(styles, /\.news-card\b/);
assert.match(styles, /\.news-row\.vorbei\b/);

assert.strictEqual(
  (serviceWorker.match(/\.\/modules\/news\.js\?v=(\d+)/) || [])[1],
  (index.match(/modules\/news\.js\?v=(\d+)/) || [])[1],
  'news.js: Version laeuft auseinander',
);
assert.strictEqual(
  (serviceWorker.match(/styles\.css\?v=(\d+)/) || [])[1],
  (index.match(/styles\.css\?v=(\d+)/) || [])[1],
  'styles.css: Version laeuft auseinander',
);

console.log('Wirtschaftskalender: Zeitumrechnung, Abstände, Ausfall, Maskierung, Platz: OK');
