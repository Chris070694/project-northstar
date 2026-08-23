const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const elements = new Map();
function element(selector) {
  if (!elements.has(selector)) {
    const node = { textContent: '', innerHTML: '', className: '' };
    /* Kleines classList, das className wirklich mitfuehrt — damit laesst sich
       pruefen, ob ein Abschnitt aus- oder eingeblendet wird. */
    node.classList = {
      toggle(name, force) {
        const classes = new Set(String(node.className).split(/\s+/).filter(Boolean));
        const on = force === undefined ? !classes.has(name) : Boolean(force);
        if (on) classes.add(name);
        else classes.delete(name);
        node.className = [...classes].join(' ');
        return on;
      },
      contains(name) {
        return String(node.className).split(/\s+/).includes(name);
      },
    };
    elements.set(selector, node);
  }
  return elements.get(selector);
}

function todayKey(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() - offsetDays);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

const context = vm.createContext({
  console,
  Intl,
  $: element,
  escapeHtml(value) {
    return String(value ?? '').replace(
      /[&<>"']/g,
      ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[ch],
    );
  },
  dailyTasks: [],
  calendarEvents: [],
  fitnessSessions: [],
  fitnessSetLogs: [],
  fitnessPlans: [],
  trades: [],
  activeFitnessSession: null,
  getTodayTradingState() {
    return { maxTrades: 2, lossLimit: 2, tradeLimitReached: false, lossLimitReached: false };
  },
});
vm.runInContext(fs.readFileSync(path.join(root, 'modules/today.js'), 'utf8'), context);

const run = code => vm.runInContext(code, context);

// --- Begrüßung nach Tageszeit
assert.equal(run('todayGreeting(7)'), 'Guten Morgen');
assert.equal(run('todayGreeting(14)'), 'Guten Tag');
assert.equal(run('todayGreeting(21)'), 'Guten Abend');

// --- Der Anker ist die Prioritätsaufgabe, und er taucht nicht doppelt in der Liste auf
run(`dailyTasks=[
  {id:'a',title:'Journal schreiben',category:'Trading',is_completed:false,is_priority:false},
  {id:'b',title:'Setup-Disziplin',category:'Trading',is_completed:false,is_priority:true}
];`);
assert.equal(run('todayAnchorTask().id'), 'b', 'Anker ist die Prioritätsaufgabe');
assert.equal(
  run("todayOpenTasks().map(task => task.id).join(',')"),
  'a',
  'Anker erscheint nicht zusätzlich unter "Heute noch"',
);

run('renderTodayAnchor()');
assert.match(element('#todayAnchor').innerHTML, /Setup-Disziplin/);
assert.doesNotMatch(element('#todayAnchor').className, /done/);

run('dailyTasks[1].is_completed=true; renderTodayAnchor();');
assert.match(element('#todayAnchor').className, /done/, 'erledigter Anker wird markiert');

run('dailyTasks=[]; renderTodayAnchor();');
assert.match(element('#todayAnchor').innerHTML, /Anker setzen/, 'ohne Anker gibt es einen Aufruf');

// --- Zustandsreihenfolge der Jetzt-Karte
run("activeFitnessSession={id:'s1',plan_name_snapshot:'Push A'};");
assert.equal(
  run("todayNowState(new Date('2026-08-21T10:00:00')).kind"),
  'workout-running',
  'laufendes Training hat Vorrang vor allem anderen',
);

run('activeFitnessSession=null;');
assert.equal(run("todayNowState(new Date('2026-08-21T20:00:00')).kind"), 'evening');
assert.equal(run("todayNowState(new Date('2026-08-21T10:00:00')).kind"), 'trading');

run("fitnessPlans=[{id:'p1'}];");
assert.equal(
  run("todayNowState(new Date('2026-08-21T06:00:00')).kind"),
  'workout-ready',
  'vor dem Trading-Fenster steht das offene Training an',
);

run('fitnessPlans=[];');
run(
  `dailyTasks=[{id:'c',title:'Steuerberater',category:'Privat',is_completed:false,is_priority:false}];`,
);
assert.equal(run("todayNowState(new Date('2026-08-21T06:00:00')).kind"), 'task');

run('dailyTasks=[];');
assert.equal(run("todayNowState(new Date('2026-08-21T06:00:00')).kind"), 'clear');

// --- Trading-Karte spiegelt die Limits aus dem Cockpit
run(
  `getTodayTradingState=()=>({maxTrades:2,lossLimit:2,tradeLimitReached:false,lossLimitReached:true});`,
);
let card = run("todayNowCard(todayNowState(new Date('2026-08-21T10:00:00')))");
assert.equal(card.accent, 'red');
assert.match(card.title, /Schluss/);

run(
  `getTodayTradingState=()=>({maxTrades:2,lossLimit:2,tradeLimitReached:true,lossLimitReached:false});`,
);
card = run("todayNowCard(todayNowState(new Date('2026-08-21T10:00:00')))");
assert.match(card.eyebrow, /TRADE-LIMIT/);

// --- R-Formatierung
assert.equal(run('formatTodayR(2.4)'), '+2.4R');
assert.equal(run('formatTodayR(-1)'), '-1R');
assert.equal(run('formatTodayR(0)'), '0R');

// --- Momentum: nur Tage mit echten Daten leuchten
run(`trades=[{trade_date:'${todayKey(0)}'},{trade_date:'${todayKey(3)}'}];
     fitnessSessions=[{session_date:'${todayKey(1)}'}];
     renderTodayMomentum();`);
const momentum = element('#todayMomentum').innerHTML;
assert.equal((momentum.match(/<i /g) || []).length, 28, 'zwei Reihen à 14 Tage');
assert.equal((momentum.match(/on cyan/g) || []).length, 2, 'zwei Journal-Tage');
assert.equal((momentum.match(/on green/g) || []).length, 1, 'ein Trainingstag');

// --- Termine des Tages landen in der Liste, fremde Tage nicht
run(`calendarEvents=[
  {event_date:'${todayKey(0)}',title:'Steuerberater',start_time:'14:00:00'},
  {event_date:'${todayKey(5)}',title:'Alter Termin',start_time:'09:00:00'}
];
dailyTasks=[];
renderTodayNext();`);
assert.match(element('#todayNext').innerHTML, /Steuerberater/);
assert.doesNotMatch(element('#todayNext').innerHTML, /Alter Termin/);
assert.ok(
  !element('#todayNextSection').classList.contains('hide'),
  'mit Terminen ist der Abschnitt sichtbar',
);

// --- Aufgaben stehen NICHT mehr in diesem Abschnitt
/* Seit Dashboard und Heute zusammengelegt sind, sitzt die abhakbare
   Aufgabenliste direkt darueber. Der Abschnitt hier zeigt nur noch Termine,
   sonst stuende jede Aufgabe doppelt auf der Startseite. */
run(`fitnessPlans=[]; calendarEvents=[]; activeFitnessSession=null;
     getTodayTradingState=()=>({maxTrades:2,lossLimit:2,tradeLimitReached:false,lossLimitReached:false});
     dailyTasks=[
       {id:'p',title:'Anker-Aufgabe',category:'Trading',is_completed:false,is_priority:true},
       {id:'n1',title:'Erste offene Aufgabe',category:'Privat',is_completed:false,is_priority:false},
       {id:'n2',title:'Zweite offene Aufgabe',category:'Privat',is_completed:false,is_priority:false}
     ];`);
run("motionTestState = todayNowState(new Date('2026-08-21T06:00:00'))");
assert.equal(run('todayNowCard(motionTestState).title'), 'Erste offene Aufgabe');
run('renderTodayNext(motionTestState)');
assert.doesNotMatch(
  element('#todayNext').innerHTML,
  /Erste offene Aufgabe/,
  'Aufgaben gehoeren in die abhakbare Liste, nicht hierhin',
);
assert.doesNotMatch(
  element('#todayNext').innerHTML,
  /Zweite offene Aufgabe/,
  'auch weitere Aufgaben stehen hier nicht mehr',
);
assert.equal(element('#todayNext').innerHTML, '', 'ohne Termine bleibt der Abschnitt leer');
assert.ok(
  element('#todayNextSection').classList.contains('hide'),
  'ohne Termine verschwindet der Abschnitt samt Ueberschrift',
);

// --- Nutzereingaben werden maskiert
run(`dailyTasks=[{id:'x',title:'<img src=x onerror=alert(1)>',category:'',is_completed:false,is_priority:true}];
     renderTodayAnchor();`);
assert.doesNotMatch(element('#todayAnchor').innerHTML, /<img/, 'Titel wird maskiert');
assert.match(element('#todayAnchor').innerHTML, /&lt;img/);

console.log('Heute-Screen: Anker, Zustandsreihenfolge, Momentum, Termine und Maskierung: OK');
