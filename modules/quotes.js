/* Ein Satz zum Tag.

   Die Liste steht fest im Code — kein Netz, keine Tabelle, keine Edge Function.
   Damit ist die Karte offline da, kostet nichts und kann nicht ausfallen. Der
   Preis: sie wiederholt sich alle QUOTES.length Tage. Bei rund vierzig Zitaten
   sind das gut sechs Wochen, und dann kennt man sie auch schon.

   Regel fuer diese Liste: nur Saetze, die einer Person wirklich zuzuordnen sind,
   mit Werk oder Anlass daneben. Ein erfundenes oder falsch zugeschriebenes Zitat
   waere hier besonders schaedlich — es steht jeden Morgen gross auf der
   Startseite und wird geglaubt. Zwei Faelle sind deshalb bewusst
   richtiggestellt:
   - "Exzellenz ist eine Gewohnheit" ist Will Durant, der Aristoteles
     zusammenfasst, nicht Aristoteles selbst. Der echte Aristoteles-Satz zur
     selben Sache steht separat in der Liste.
   - Die Livermore-Saetze stammen aus Edwin Lefevres Roman, in dem Livermore
     unter dem Namen Larry Livingston auftritt. Deshalb steht das Buch dabei.

   Antike Texte sind Uebersetzungen; die Formulierungen unterscheiden sich je
   nach Ausgabe. Deshalb ist immer die Stelle genannt, nicht nur der Name.

   Drei Zitate sind bei der Pruefung wieder rausgeflogen, damit sie niemand
   spaeter gutglaeubig zurueckholt:
   - Bruce Lee, "zehntausend Tritte einmal geuebt": keine Fundstelle. Selbst die
     Bruce Lee Foundation kann keine nennen, aeltester Beleg ist ein Tweet.
   - Charlie Munger, "das grosse Geld liegt im Warten": keine Fundstelle, und
     inhaltlich dieselbe Aussage wie das belegte Livermore-Zitat.
   - Howard Marks, "Du kannst dich nicht vorhersagen, du kannst dich
     vorbereiten": ist der Titel eines Oaktree-Memos, aber Marks schreibt dort
     selbst, dass er ihn aus einer Versicherungswerbung entlehnt hat. */

const QUOTES = [
  /* Die drei Richtungen — Stoiker, Trading, Disziplin — sind bewusst
     abwechselnd gemischt und nicht blockweise sortiert. Sonst kaeme sechs
     Wochen lang erst nur Antike und dann nur Wall Street. */
  {
    t: 'Am Morgen, wenn du nur ungern aufstehst, halte dir bereit: Ich erhebe mich zum Werk des Menschen.',
    p: 'Marc Aurel',
    w: 'Selbstbetrachtungen 5,1',
  },
  {
    t: 'Es war nie mein Denken, das mir das grosse Geld einbrachte. Es war immer mein Sitzen.',
    p: 'Jesse Livermore',
    w: 'in Edwin Lefevre, Reminiscences of a Stock Operator',
  },
  {
    t: 'Wir leiden haeufiger in der Einbildung als in der Wirklichkeit.',
    p: 'Seneca',
    w: 'Briefe an Lucilius 13,4',
  },
  {
    /* Die gaengige Fassung "Regel Nummer eins: Verliere niemals Geld" hat keine
       belegte Erstquelle. Das hier ist der Wortlaut aus dem Fortune-Portraet. */
    t: 'Die erste Regel ist, nicht zu verlieren. Die zweite Regel ist, die erste Regel nicht zu vergessen.',
    p: 'Warren Buffett',
    w: 'Fortune, 1988',
  },
  {
    t: 'Du steigst nicht auf das Niveau deiner Ziele. Du faellst auf das Niveau deiner Systeme.',
    p: 'James Clear',
    w: 'Atomic Habits',
  },
  {
    t: 'Nicht die Dinge selbst beunruhigen die Menschen, sondern ihre Meinungen ueber die Dinge.',
    p: 'Epiktet',
    w: 'Handbuechlein 5',
  },
  {
    t: 'Ich habe in meiner Laufbahn ueber neuntausend Wuerfe verfehlt, fast dreihundert Spiele verloren, sechsundzwanzig Mal den entscheidenden Wurf danebengesetzt. Ich bin immer und immer wieder gescheitert — und darum habe ich Erfolg.',
    p: 'Michael Jordan',
    w: 'Nike-Spot "Failure", 1997',
  },
  {
    t: 'Die Kunst zu leben gleicht mehr dem Ringen als dem Tanzen.',
    p: 'Marc Aurel',
    w: 'Selbstbetrachtungen 7,61',
  },
  {
    t: 'Es kommt nicht darauf an, ob du richtig oder falsch liegst, sondern wie viel du verdienst, wenn du richtig liegst, und wie viel du verlierst, wenn du falsch liegst.',
    p: 'George Soros',
    w: '',
  },
  {
    /* Der oft zitierte Nachsatz "Motivation kommt und geht" stammt aus
       Vortraegen, nicht aus dem Buch — deshalb hier nur der belegte Satz. */
    t: 'Motivation ist Mist.',
    p: 'David Goggins',
    w: "Can't Hurt Me",
  },
  {
    t: 'Nicht wenig Zeit haben wir, sondern viel vergeuden wir.',
    p: 'Seneca',
    w: 'Von der Kuerze des Lebens 1,3',
  },
  {
    t: 'Du musst nicht wissen, was als Naechstes passiert, um Geld zu verdienen.',
    p: 'Mark Douglas',
    w: 'Trading in the Zone',
  },
  {
    t: 'Wir sind, was wir wiederholt tun. Exzellenz ist deshalb keine Handlung, sondern eine Gewohnheit.',
    p: 'Will Durant',
    w: 'The Story of Philosophy — fasst Aristoteles zusammen, wird oft ihm zugeschrieben',
  },
  {
    t: 'Durch gerechtes Handeln werden wir gerecht, durch masshaltendes masshaltend, durch tapferes tapfer.',
    p: 'Aristoteles',
    w: 'Nikomachische Ethik II,1',
  },
  {
    t: 'Manches steht in unserer Macht, manches nicht.',
    p: 'Epiktet',
    w: 'Handbuechlein 1',
  },
  {
    t: 'Der wichtigste Grundsatz beim Traden ist gute Verteidigung, nicht gute Offensive.',
    p: 'Paul Tudor Jones',
    w: 'in Jack Schwager, Market Wizards',
  },
  {
    t: 'Genie ist ein Prozent Inspiration und neunundneunzig Prozent Transpiration.',
    p: 'Thomas Edison',
    w: '',
  },
  {
    t: 'Streiche das Urteil — und gestrichen ist das "Ich bin geschaedigt".',
    p: 'Marc Aurel',
    w: 'Selbstbetrachtungen 4,7',
  },
  {
    t: 'Jeder bekommt vom Markt, was er will.',
    p: 'Ed Seykota',
    w: 'in Jack Schwager, Market Wizards',
  },
  {
    t: 'Wer nicht weiss, welchen Hafen er ansteuert, dem ist kein Wind guenstig.',
    p: 'Seneca',
    w: 'Briefe an Lucilius 71,3',
  },
  {
    t: 'An der Wall Street gibt es nichts Neues. Was heute geschieht, ist schon einmal geschehen und wird wieder geschehen.',
    p: 'Jesse Livermore',
    w: 'in Edwin Lefevre, Reminiscences of a Stock Operator',
  },
  {
    t: 'Das entscheidende Organ ist hier nicht das Gehirn, sondern der Magen.',
    p: 'Peter Lynch',
    w: '',
  },
  {
    t: 'Sag von keinem Ding: "Ich habe es verloren", sondern: "Ich habe es zurueckgegeben".',
    p: 'Epiktet',
    w: 'Handbuechlein 11',
  },
  {
    /* Genau dieser Wortlaut steht bei Itzler, nicht in Goggins eigenem Buch. */
    t: 'Wenn dein Kopf sagt, du bist fertig, bist du in Wahrheit erst bei vierzig Prozent.',
    p: 'David Goggins',
    w: 'in Jesse Itzler, Living with a SEAL',
  },
  {
    t: 'Nimm eine einfache Idee und nimm sie ernst.',
    p: 'Charlie Munger',
    w: '',
  },
  {
    t: 'Die beste Art, sich zu raechen, ist, dem anderen nicht zu gleichen.',
    p: 'Marc Aurel',
    w: 'Selbstbetrachtungen 6,6',
  },
  {
    t: 'Das Hauptproblem des Anlegers — und vermutlich sein aergster Feind — ist wahrscheinlich er selbst.',
    p: 'Benjamin Graham',
    w: 'The Intelligent Investor',
  },
  {
    t: 'Es ist nicht so, dass wir es nicht wagen, weil es schwer ist. Es ist schwer, weil wir es nicht wagen.',
    p: 'Seneca',
    w: 'Briefe an Lucilius 104,26',
  },
  {
    t: 'Schmerz plus Reflexion ergibt Fortschritt.',
    p: 'Ray Dalio',
    w: 'Principles',
  },
  {
    t: 'Verlange nicht, dass die Dinge geschehen, wie du es wuenschst, sondern wuensche, dass sie geschehen, wie sie geschehen — dann wird dein Leben ruhig fliessen.',
    p: 'Epiktet',
    w: 'Handbuechlein 8',
  },
  {
    t: 'Es gibt eine Million Wege, an den Maerkten Geld zu verdienen. Alle sind schwer zu finden.',
    p: 'Jack Schwager',
    w: '',
  },
  {
    t: 'Talent mal Anstrengung ergibt Koennen. Koennen mal Anstrengung ergibt Leistung.',
    p: 'Angela Duckworth',
    w: 'Grit',
  },
  {
    t: 'Jede Handlung so tun, als waere sie die letzte deines Lebens.',
    p: 'Marc Aurel',
    w: 'Selbstbetrachtungen 2,5',
  },
  {
    t: 'Disziplin ist Freiheit.',
    p: 'Jocko Willink',
    w: 'Discipline Equals Freedom',
  },
  {
    t: 'Sei formlos, gestaltlos — wie Wasser. Sei Wasser, mein Freund.',
    p: 'Bruce Lee',
    w: 'Longstreet, 1971',
  },
  {
    t: 'Alles, mein Lucilius, ist fremd — nur die Zeit ist unser.',
    p: 'Seneca',
    w: 'Briefe an Lucilius 1,3',
  },
  {
    t: 'Wenn dich etwas Aeusseres bedrueckt, so stoert dich nicht die Sache selbst, sondern dein Urteil ueber sie. Und dieses zu tilgen, steht jetzt in deiner Macht.',
    p: 'Marc Aurel',
    w: 'Selbstbetrachtungen 8,47',
  },
];

/* Tagesnummer statt Zufall: das Zitat darf beim Neuladen nicht wechseln.

   Date.UTC auf das oertliche Kalenderdatum angewandt ergibt immer ein glattes
   Vielfaches von 86400000 und damit einen exakten Tageszaehler.

   Der naheliegende Weg — new Date(j,m,t).getTime() / 86400000 — ist ortsabhaengig
   kaputt: er misst die oertliche Mitternacht in UTC. In Wien liegt die immer im
   Vortag und alles geht gut, aber in Zeitzonen, deren Versatz bei der
   Zeitumstellung ueber null wechselt (London, Lissabon, Dublin), rutscht die
   Mitternacht ueber eine UTC-Tagesgrenze: der 29. und der 30. Maerz bekommen
   dieselbe Nummer und es stuende zwei Tage lang derselbe Satz da.
   Christian sitzt in Oesterreich, es wuerde ihn also nicht treffen — aber ein
   Fehler, der nur woanders auftritt, ist trotzdem ein Fehler. */
function quoteTagesnummer(datum = new Date()) {
  return Math.floor(
    Date.UTC(datum.getFullYear(), datum.getMonth(), datum.getDate()) / 86400000,
  );
}

/* Der doppelte Modulo faengt negative Tagesnummern ab (Datum vor 1970).
   Ein einfaches % gaebe dort einen negativen Index und damit undefined. */
function quoteDesTages(nummer = quoteTagesnummer(), versatz = 0) {
  if (!QUOTES.length) return null;
  const index = (((nummer + versatz) % QUOTES.length) + QUOTES.length) % QUOTES.length;
  return QUOTES[index];
}

const QUOTE_VERSATZ_KEY = 'northstar-quote-versatz';

/* Der Versatz gilt nur fuer den heutigen Tag. Morgen steht wieder das Zitat des
   Tages da, sonst wuerde ein einmaliges Weitertippen die Reihenfolge dauerhaft
   verschieben. */
function quoteVersatzLesen(tag = quoteTagesnummer()) {
  try {
    const roh = JSON.parse(localStorage.getItem(QUOTE_VERSATZ_KEY) || 'null');
    return roh && roh.tag === tag ? Number(roh.versatz) || 0 : 0;
  } catch (error) {
    return 0;
  }
}

function quoteVersatzSchreiben(versatz, tag = quoteTagesnummer()) {
  try {
    localStorage.setItem(QUOTE_VERSATZ_KEY, JSON.stringify({ tag, versatz }));
  } catch (error) {
    /* Ohne Speicher faengt der naechste Start wieder beim Tageszitat an. */
  }
}

function naechstesQuote() {
  quoteVersatzSchreiben(quoteVersatzLesen() + 1);
  renderQuote();
}

function renderQuote() {
  const karte = $('#quoteCard');
  if (!karte) {
    console.warn('quotes.js: #quoteCard fehlt — das Tageszitat wird nicht angezeigt.');
    return;
  }
  const zitat = quoteDesTages(quoteTagesnummer(), quoteVersatzLesen());
  if (!zitat) {
    karte.classList.add('hide');
    return;
  }
  karte.classList.remove('hide');
  /* textContent statt innerHTML: die Zitate stehen zwar im eigenen Code, aber
     so kann auch ein spaeter eingetragener Satz mit < oder & nichts kaputt
     machen und muss nicht maskiert werden. */
  $('#quoteText').textContent = zitat.t;
  $('#quotePerson').textContent = zitat.p;
  const werk = $('#quoteWork');
  werk.textContent = zitat.w || '';
  werk.classList.toggle('hide', !zitat.w);
}
