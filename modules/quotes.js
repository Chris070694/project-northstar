/* Ein Satz zum Tag.

   Die Liste steht fest im Code — kein Netz, keine Tabelle, keine Edge Function.
   Damit ist die Karte offline da, kostet nichts und kann nicht ausfallen. Der
   Preis: sie wiederholt sich alle QUOTES.length Tage. Bei 190 Zitaten ist das
   gut ein halbes Jahr. Ziel sind 365, damit sich ein Jahr lang nichts
   wiederholt; der Rest kommt in weiteren Etappen dazu.

   Die Quellenangaben zu allen Zitaten liegen im Vault unter
   Zitate/Quellen.md — dort steht zu jedem Satz, wo er nachgeprueft wurde.

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
  /* Die Richtungen — Stoiker, Trading, Trading-Psychologie, Sport, Disziplin —
     sind bewusst reihum gemischt und nicht blockweise sortiert. Sonst kaeme ein
     halbes Jahr lang erst nur Antike und dann nur Wall Street.
     Gemischt und geschrieben von build/zitate/mische.js. */
  {
    t: 'Am Morgen, wenn du nur ungern aufstehst, halte dir bereit: Ich erhebe mich zum Werk des Menschen.',
    p: 'Marc Aurel',
    w: 'Selbstbetrachtungen 5,1',
  },
  {
    t: 'Die harte, kalte Realität des Tradings ist: Jeder Trade hat einen ungewissen Ausgang.',
    p: 'Mark Douglas',
    w: 'Trading in the Zone, Kap. 1',
  },
  {
    t: 'Ich verliere nie die Beherrschung wegen der Börse. Ich streite nie mit dem Ticker.',
    p: 'Jesse Livermore',
    w: 'in Edwin Lefèvre, Reminiscences of a Stock Operator, Kap. 3',
  },
  {
    t: 'Da du in jedem Augenblick aus dem Leben scheiden kannst, richte danach jede Handlung und jeden Gedanken ein.',
    p: 'Marc Aurel',
    w: 'Selbstbetrachtungen 2,11',
  },
  {
    t: '»Mühelos« ist ein Mythos. Die Wahrheit ist: Ich musste sehr hart arbeiten, damit es leicht aussah.',
    p: 'Roger Federer',
    w: 'Abschlussrede Dartmouth College, 2024',
  },
  {
    t: 'Es war nie mein Denken, das mir das große Geld einbrachte. Es war immer mein Sitzen.',
    p: 'Jesse Livermore',
    w: 'in Edwin Lefèvre, Reminiscences of a Stock Operator',
  },
  {
    t: 'Verlieren kann ein Mensch nur die Gegenwart, wenn es wahr ist, dass er nur sie besitzt.',
    p: 'Marc Aurel',
    w: 'Selbstbetrachtungen 2,14',
  },
  {
    t: 'Meine Verluste haben mich gelehrt, dass ich nicht vorrücken darf, bevor ich sicher bin, dass ich nicht zurückweichen muss.',
    p: 'Jesse Livermore',
    w: 'in Edwin Lefèvre, Reminiscences of a Stock Operator, Kap. 3',
  },
  {
    t: 'Ein Edge ist nichts weiter als ein Hinweis darauf, dass das eine wahrscheinlicher ist als das andere.',
    p: 'Mark Douglas',
    w: 'Trading in the Zone, Kap. 7',
  },
  {
    t: 'Meistens geht es nicht darum, eine Gabe zu haben, sondern darum, Biss zu haben.',
    p: 'Roger Federer',
    w: 'Abschlussrede Dartmouth College, 2024',
  },
  {
    t: 'Wir leiden häufiger in der Einbildung als in der Wirklichkeit.',
    p: 'Seneca',
    w: 'Briefe an Lucilius 13,4',
  },
  {
    t: 'Das Leben ist ein Kriegsdienst und ein Aufenthalt in der Fremde, und der Nachruhm ist Vergessen.',
    p: 'Marc Aurel',
    w: 'Selbstbetrachtungen 2,17',
  },
  {
    t: 'Was mich schlug, war zu wenig Verstand, um bei meinem eigenen Spiel zu bleiben: nur dann zu handeln, wenn die Vorzeichen meinen Zug begünstigten.',
    p: 'Jesse Livermore',
    w: 'in Edwin Lefèvre, Reminiscences of a Stock Operator, Kap. 2',
  },
  {
    t: 'Wenn du wirklich glaubst, dass Trading ein Wahrscheinlichkeitsspiel ist, verlieren richtig und falsch, gewinnen und verlieren ihre bisherige Bedeutung.',
    p: 'Mark Douglas',
    w: 'Trading in the Zone, Kap. 7',
  },
  {
    t: 'Selbst die besten Tennisspieler der Welt gewinnen kaum mehr als die Hälfte der Punkte, die sie spielen.',
    p: 'Roger Federer',
    w: 'Abschlussrede Dartmouth College, 2024',
  },
  {
    /* Die gaengige Fassung "Regel Nummer eins: Verliere niemals Geld" hat keine
       belegte Erstquelle. Das hier ist der Wortlaut aus dem Fortune-Portraet. */
    t: 'Die erste Regel ist, nicht zu verlieren. Die zweite Regel ist, die erste Regel nicht zu vergessen.',
    p: 'Warren Buffett',
    w: 'Fortune, 1988',
  },
  {
    t: 'Vergeude den Rest deines Lebens nicht mit Gedanken über andere, wenn du sie nicht auf etwas allgemein Nützliches richtest.',
    p: 'Marc Aurel',
    w: 'Selbstbetrachtungen 3,4',
  },
  {
    t: 'Das Spiel selbst hat mir das Spiel beigebracht. Und es hat beim Lehren nicht mit Prügeln gespart.',
    p: 'Jesse Livermore',
    w: 'in Edwin Lefèvre, Reminiscences of a Stock Operator, Kap. 3',
  },
  {
    t: 'Gewinne und Verluste verteilen sich zufällig über jede Reihe von Variablen, die einen Edge definieren.',
    p: 'Mark Douglas',
    w: 'Trading in the Zone, Kap. 8',
  },
  {
    t: 'Wenn du im Schnitt jeden zweiten Punkt verlierst, lernst du, nicht an jedem einzelnen Schlag hängen zu bleiben.',
    p: 'Roger Federer',
    w: 'Abschlussrede Dartmouth College, 2024',
  },
  {
    t: 'Du steigst nicht auf das Niveau deiner Ziele. Du fällst auf das Niveau deiner Systeme.',
    p: 'James Clear',
    w: 'Atomic Habits',
  },
  {
    t: 'Nirgends zieht sich ein Mensch ruhiger und ungestörter zurück als in seine eigene Seele.',
    p: 'Marc Aurel',
    w: 'Selbstbetrachtungen 4,3',
  },
  {
    t: 'Spiele gewinnen die Spieler, die auf das Spielfeld schauen – nicht die, deren Blick an der Anzeigetafel klebt.',
    p: 'Warren Buffett',
    w: 'Berkshire-Aktionärsbrief 2013',
  },
  {
    t: 'Wenn du Angst hast, falschzuliegen, verzerrt diese Angst deine Wahrnehmung – so sehr, dass du am Ende tatsächlich falschliegst.',
    p: 'Mark Douglas',
    w: 'Trading in the Zone, Kap. 1',
  },
  {
    t: 'Manchmal verlierst du. Einen Punkt, ein Match, eine Saison, einen Job – es ist eine Achterbahn.',
    p: 'Roger Federer',
    w: 'Abschlussrede Dartmouth College, 2024',
  },
  {
    t: 'Nicht die Dinge selbst beunruhigen die Menschen, sondern ihre Meinungen über die Dinge.',
    p: 'Epiktet',
    w: 'Handbüchlein 5',
  },
  {
    t: 'Handle nicht, als hättest du zehntausend Jahre zu leben. Der Tod steht über dir.',
    p: 'Marc Aurel',
    w: 'Selbstbetrachtungen 4,17',
  },
  {
    t: 'Sich Makro-Meinungen zu bilden oder den Markt- und Konjunkturprognosen anderer zu lauschen, ist Zeitverschwendung.',
    p: 'Warren Buffett',
    w: 'Berkshire-Aktionärsbrief 2013',
  },
  {
    t: 'Du handelst nicht die Märkte – das tut niemand. Du handelst deine Überzeugungen über die Märkte.',
    p: 'Van Tharp',
    w: 'Blogbeitrag, 2012',
  },
  {
    t: 'Das Leben ist größer als der Platz.',
    p: 'Roger Federer',
    w: 'Abschlussrede Dartmouth College, 2024',
  },
  {
    t: 'Ich habe in meiner Laufbahn über neuntausend Würfe verfehlt, fast dreihundert Spiele verloren, sechsundzwanzig Mal den entscheidenden Wurf danebengesetzt. Ich bin immer und immer wieder gescheitert — und darum habe ich Erfolg.',
    p: 'Michael Jordan',
    w: 'Nike-Spot "Failure", 1997',
  },
  {
    t: 'Tu wenig, sagt der Philosoph, wenn du gelassen sein willst.',
    p: 'Marc Aurel',
    w: 'Selbstbetrachtungen 4,24',
  },
  {
    t: 'Ein Klima der Angst ist beim Investieren dein Freund; eine euphorische Welt ist dein Feind.',
    p: 'Warren Buffett',
    w: 'Berkshire-Aktionärsbrief 2013',
  },
  {
    t: 'Emotion ist unverzichtbar für gutes Trading – und oft verantwortlich für unser schlechtestes.',
    p: 'Brett Steenbarger',
    w: 'Forbes-Kolumne, 2021',
  },
  {
    t: 'Erfolg ist Seelenfrieden – und den erreichst du nur durch die Gewissheit, dich so angestrengt zu haben, wie es dir überhaupt möglich war.',
    p: 'John Wooden',
    w: 'TED-Talk, 2001',
  },
  {
    t: 'Die Kunst zu leben gleicht mehr dem Ringen als dem Tanzen.',
    p: 'Marc Aurel',
    w: 'Selbstbetrachtungen 7,61',
  },
  {
    t: 'Können heißt: den Zugang zum Bauchgefühl zu behalten, gerade angesichts von Risiko und Ungewissheit.',
    p: 'Brett Steenbarger',
    w: 'Forbes-Kolumne, 2021',
  },
  {
    t: 'Es lässt sich schlicht nicht sagen, wie weit Kurse in kurzer Zeit fallen können.',
    p: 'Warren Buffett',
    w: 'Berkshire-Aktionärsbrief 2017',
  },
  {
    t: 'Sei wie das Kap, an dem sich die Wogen unablässig brechen: Es steht fest und besänftigt das Toben des Wassers um sich her.',
    p: 'Marc Aurel',
    w: 'Selbstbetrachtungen 4,49',
  },
  {
    t: 'Du kannst verlieren, obwohl du mehr Punkte machst. Und du kannst gewinnen, obwohl der andere mehr macht.',
    p: 'John Wooden',
    w: 'TED-Talk, 2001',
  },
  {
    t: 'Es kommt nicht darauf an, ob du richtig oder falsch liegst, sondern wie viel du verdienst, wenn du richtig liegst, und wie viel du verlierst, wenn du falsch liegst.',
    p: 'George Soros',
    w: '',
  },
  {
    t: 'Wie deine gewohnten Gedanken sind, so wird auch dein Sinn sein; denn die Seele nimmt die Farbe der Gedanken an.',
    p: 'Marc Aurel',
    w: 'Selbstbetrachtungen 5,16',
  },
  {
    t: 'Ebenso wichtig ist die Bereitschaft, über längere Zeit einfallslos zu wirken – oder sogar töricht auszusehen.',
    p: 'Warren Buffett',
    w: 'Berkshire-Aktionärsbrief 2017',
  },
  {
    t: 'Du fällst hin, du stehst auf. Du fällst wieder hin, du stehst wieder auf. Erfolg ist eine Frage der Widerstandskraft im Scheitern.',
    p: 'Brett Steenbarger',
    w: 'Forbes-Kolumne, 2019',
  },
  {
    t: 'Versuche nie, besser zu sein als jemand anderes. Lerne immer von anderen. Und höre nie auf, der Beste zu werden, der du sein kannst.',
    p: 'John Wooden',
    w: 'TED-Talk 2001, Wooden zitiert seinen Vater',
  },
  {
    /* Der oft zitierte Nachsatz "Motivation kommt und geht" stammt aus
       Vortraegen, nicht aus dem Buch — deshalb hier nur der belegte Satz. */
    t: 'Motivation ist Mist.',
    p: 'David Goggins',
    w: 'Can\'t Hurt Me',
  },
  {
    t: 'Der Geist verwandelt jedes Hindernis in einen Antrieb; so wird das, was im Weg steht, zur Förderung des Handelns.',
    p: 'Marc Aurel',
    w: 'Selbstbetrachtungen 5,20',
  },
  {
    t: 'Beim Einsatz von Kapital korreliert Aktivität nicht mit Erfolg. Gerade beim Investieren ist hektisches Handeln oft kontraproduktiv.',
    p: 'Warren Buffett',
    w: 'Berkshire-Aktionärsbrief 1998',
  },
  {
    t: 'Unsere tröstliche Überzeugung, dass die Welt Sinn ergibt, ruht auf einem sicheren Fundament: unserer nahezu grenzenlosen Fähigkeit, unsere Unwissenheit zu ignorieren.',
    p: 'Daniel Kahneman',
    w: 'Schnelles Denken, langsames Denken',
  },
  {
    t: 'Nur die Disziplinierten sind im Leben frei. Wer nicht diszipliniert ist, ist ein Sklave seiner Launen.',
    p: 'Eliud Kipchoge',
    w: 'Rede vor der Oxford Union, 2017',
  },
  {
    t: 'Nicht wenig Zeit haben wir, sondern viel vergeuden wir.',
    p: 'Seneca',
    w: 'Von der Kürze des Lebens 1,3',
  },
  {
    t: 'Was dem Schwarm nicht nützt, nützt auch der Biene nicht.',
    p: 'Marc Aurel',
    w: 'Selbstbetrachtungen 6,54',
  },
  {
    t: 'Die Klugen setzen hoch, wenn die Welt ihnen die Gelegenheit bietet. Sie setzen groß, wenn die Wahrscheinlichkeiten für sie sprechen. Die übrige Zeit tun sie es nicht.',
    p: 'Charlie Munger',
    w: 'Rede an der USC, 1994',
  },
  {
    t: 'Selbstüberschätzung hängt vor allem an Qualität und Stimmigkeit der Geschichte, die du dir bauen kannst – nicht an ihrer Gültigkeit.',
    p: 'Daniel Kahneman',
    w: 'McKinsey-Quarterly-Interview, 2010',
  },
  {
    t: 'Selbstdisziplin heißt, das Richtige zu tun statt das, wonach dir gerade ist.',
    p: 'Eliud Kipchoge',
    w: 'Rede vor der Oxford Union, 2017',
  },
  {
    t: 'Du musst nicht wissen, was als Nächstes passiert, um Geld zu verdienen.',
    p: 'Mark Douglas',
    w: 'Trading in the Zone',
  },
  {
    t: 'Es ist des Menschen eigen, sogar die zu lieben, die ihm unrecht tun.',
    p: 'Marc Aurel',
    w: 'Selbstbetrachtungen 7,22',
  },
  {
    t: 'Jeder Mensch hat einen Kompetenzkreis. Und es ist sehr schwer, diesen Kreis zu erweitern.',
    p: 'Charlie Munger',
    w: 'Rede an der USC, 1994',
  },
  {
    t: 'Bei strategischen Entscheidungen würde mir Selbstüberschätzung wirklich Sorgen machen.',
    p: 'Daniel Kahneman',
    w: 'McKinsey-Quarterly-Interview, 2010',
  },
  {
    t: 'Mach Disziplin zu deinem Lebensstil. Disziplin ist keine einmalige Sache.',
    p: 'Eliud Kipchoge',
    w: 'Rede vor der Oxford Union, 2017',
  },
  {
    t: 'Wir sind, was wir wiederholt tun. Exzellenz ist deshalb keine Handlung, sondern eine Gewohnheit.',
    p: 'Will Durant',
    w: 'The Story of Philosophy — fasst Aristoteles zusammen, wird oft ihm zugeschrieben',
  },
  {
    t: 'Schau nach innen. Innen ist die Quelle des Guten, und sie sprudelt immer, wenn du immer gräbst.',
    p: 'Marc Aurel',
    w: 'Selbstbetrachtungen 7,59',
  },
  {
    t: 'Es ist Menschen nicht gegeben, so begabt zu sein, dass sie einfach immer alles über alles wissen.',
    p: 'Charlie Munger',
    w: 'Rede an der USC, 1994',
  },
  {
    t: 'Im Allgemeinen sind diese Faustregeln recht nützlich, aber manchmal führen sie zu schweren und systematischen Fehlern.',
    p: 'Amos Tversky und Daniel Kahneman',
    w: 'Judgment under Uncertainty, Science 1974',
  },
  {
    t: 'Ohne Beständigkeit kommst du nirgendwohin. Beständigkeit lässt dich wachsen.',
    p: 'Eliud Kipchoge',
    w: 'Rede vor der Oxford Union, 2017',
  },
  {
    t: 'Durch gerechtes Handeln werden wir gerecht, durch maßhaltendes maßhaltend, durch tapferes tapfer.',
    p: 'Aristoteles',
    w: 'Nikomachische Ethik II,1',
  },
  {
    t: 'Die Gurke ist bitter? Wirf sie weg. Dornen liegen auf dem Weg? Geh ihnen aus dem Weg. Das genügt.',
    p: 'Marc Aurel',
    w: 'Selbstbetrachtungen 8,50',
  },
  {
    t: 'Der sicherste Weg, das zu bekommen, was du willst, ist zu versuchen, es zu verdienen.',
    p: 'Charlie Munger',
    w: 'Abschlussrede USC Law School, 2007',
  },
  {
    t: 'Die unbegründete Zuversicht, die entsteht, wenn Vorhersage und Ausgangsinformation gut zusammenpassen, kann man Gültigkeitsillusion nennen.',
    p: 'Amos Tversky und Daniel Kahneman',
    w: 'Judgment under Uncertainty, Science 1974',
  },
  {
    t: 'Ich glaube an mein Training. An der Startlinie behandle ich mich als den Besten, weil mein Kopf mir sagt, dass ich der Beste bin.',
    p: 'Eliud Kipchoge',
    w: 'Rede vor der Oxford Union, 2017',
  },
  {
    t: 'Manches steht in unserer Macht, manches nicht.',
    p: 'Epiktet',
    w: 'Handbüchlein 1',
  },
  {
    t: 'Ist es nicht richtig, tu es nicht; ist es nicht wahr, sage es nicht.',
    p: 'Marc Aurel',
    w: 'Selbstbetrachtungen 12,17',
  },
  {
    t: 'Neid, Groll, Rache und Selbstmitleid sind verheerende Denkweisen.',
    p: 'Charlie Munger',
    w: 'Abschlussrede USC Law School, 2007',
  },
  {
    t: 'Die Qualität unseres Lebens ist die Summe aus Entscheidungsqualität plus Glück.',
    p: 'Annie Duke',
    w: 'Thinking in Bets, Kap. 1',
  },
  {
    t: 'Du willst niemals scheitern, weil du nicht hart genug gearbeitet hast.',
    p: 'Arnold Schwarzenegger',
    w: 'Abschlussrede University of Southern California, 2009',
  },
  {
    t: 'Der wichtigste Grundsatz beim Traden ist gute Verteidigung, nicht gute Offensive.',
    p: 'Paul Tudor Jones',
    w: 'in Jack Schwager, Market Wizards',
  },
  {
    t: 'Nirgends ist, wer überall ist.',
    p: 'Seneca',
    w: 'Briefe an Lucilius 2,2',
  },
  {
    t: 'Wenn du unzuverlässig bist, spielen deine übrigen Tugenden keine Rolle – du stürzt sofort ab.',
    p: 'Charlie Munger',
    w: 'Abschlussrede USC Law School, 2007',
  },
  {
    t: 'Sich mit »Ich bin mir nicht sicher« anzufreunden, ist ein entscheidender Schritt zu besseren Entscheidungen.',
    p: 'Annie Duke',
    w: 'Thinking in Bets, Kap. 1',
  },
  {
    t: 'Vertraue dir selbst, ganz gleich, wie und was andere denken.',
    p: 'Arnold Schwarzenegger',
    w: 'Abschlussrede University of Southern California, 2009',
  },
  {
    t: 'Genie ist ein Prozent Inspiration und neunundneunzig Prozent Transpiration.',
    p: 'Thomas Edison',
    w: '',
  },
  {
    t: 'Nach der Freundschaft musst du vertrauen, vor der Freundschaft urteilen.',
    p: 'Seneca',
    w: 'Briefe an Lucilius 3,2',
  },
  {
    t: 'Wissen zu erwerben ist eine moralische Pflicht – nicht bloß etwas, das man tut, um im Leben voranzukommen.',
    p: 'Charlie Munger',
    w: 'Abschlussrede USC Law School, 2007',
  },
  {
    t: 'Im Schach hängen Ergebnisse eng an der Entscheidungsqualität. Im Poker ist es viel leichter, mit Glück zu gewinnen oder mit Pech zu verlieren.',
    p: 'Annie Duke',
    w: 'Thinking in Bets, Kap. 1',
  },
  {
    t: 'Schenke den Leuten keine Beachtung, die sagen, es sei nicht zu schaffen.',
    p: 'Arnold Schwarzenegger',
    w: 'Abschlussrede University of Southern California, 2009',
  },
  {
    t: 'Streiche das Urteil — und gestrichen ist das "Ich bin geschädigt".',
    p: 'Marc Aurel',
    w: 'Selbstbetrachtungen 4,7',
  },
  {
    t: 'Du wirst aufhören zu fürchten, wenn du aufhörst zu hoffen.',
    p: 'Seneca',
    w: 'Briefe an Lucilius 5,7',
  },
  {
    t: 'Der menschliche Verstand ist wie eine menschliche Eizelle: Kommt ein Spermium hinein, schaltet sie ab, damit kein zweites mehr hereinkommt.',
    p: 'Charlie Munger',
    w: 'Rede: Die Psychologie menschlicher Fehlurteile, 1995',
  },
  {
    t: 'Rückschaufehler ist die Neigung, ein Ergebnis, sobald man es kennt, als unvermeidlich anzusehen.',
    p: 'Annie Duke',
    w: 'Thinking in Bets, Kap. 1',
  },
  {
    t: 'Die Welt schien stillzustehen. Die einzige Wirklichkeit waren die nächsten 200 Yards Bahn unter meinen Füßen.',
    p: 'Roger Bannister',
    w: 'First Four Minutes, über den Meilenlauf 1954',
  },
  {
    t: 'Jeder bekommt vom Markt, was er will.',
    p: 'Ed Seykota',
    w: 'in Jack Schwager, Market Wizards',
  },
  {
    t: 'Die Philosophie lehrt zu handeln, nicht zu reden, und verlangt, dass jeder nach ihrem Gesetz lebt.',
    p: 'Seneca',
    w: 'Briefe an Lucilius 20,2',
  },
  {
    t: 'Die Realität ist zu schmerzhaft, um sie auszuhalten – also verzerrt man sie einfach, bis sie erträglich wird.',
    p: 'Charlie Munger',
    w: 'Rede: Die Psychologie menschlicher Fehlurteile, 1995',
  },
  {
    t: 'Die Logik des Schwarzen Schwans macht das, was du nicht weißt, weit bedeutsamer als das, was du weißt.',
    p: 'Nassim Nicholas Taleb',
    w: 'Der Schwarze Schwan, Prolog',
  },
  {
    t: 'In diesem Moment spürte ich, dass dies meine Chance war, eine einzige Sache herausragend gut zu machen.',
    p: 'Roger Bannister',
    w: 'First Four Minutes, über den Meilenlauf 1954',
  },
  {
    t: 'Wer nicht weiß, welchen Hafen er ansteuert, dem ist kein Wind günstig.',
    p: 'Seneca',
    w: 'Briefe an Lucilius 71,3',
  },
  {
    t: 'Überraschend ist nicht das Ausmaß unserer Prognosefehler, sondern dass wir uns ihrer nicht bewusst sind.',
    p: 'Nassim Nicholas Taleb',
    w: 'Der Schwarze Schwan, Prolog',
  },
  {
    t: 'Du kannst nicht dasselbe tun wie alle anderen und dabei erwarten, besser abzuschneiden.',
    p: 'Howard Marks',
    w: 'Oaktree-Memo »Dare to Be Great II«, 2014',
  },
  {
    t: 'Deinen Geist musst du ändern, nicht den Himmel.',
    p: 'Seneca',
    w: 'Briefe an Lucilius 28,1',
  },
  {
    t: 'Ich wusste, dass ich es geschafft hatte, noch bevor ich die Zeit hörte.',
    p: 'Roger Bannister',
    w: 'First Four Minutes, über den Meilenlauf 1954',
  },
  {
    t: 'An der Wall Street gibt es nichts Neues. Was heute geschieht, ist schon einmal geschehen und wird wieder geschehen.',
    p: 'Jesse Livermore',
    w: 'in Edwin Lefèvre, Reminiscences of a Stock Operator',
  },
  {
    t: 'Du fragst, warum dir diese Flucht nicht hilft? Du fliehst mit dir selbst.',
    p: 'Seneca',
    w: 'Briefe an Lucilius 28,2',
  },
  {
    t: 'Nur wenn dein Verhalten unkonventionell ist, wird auch dein Ergebnis wahrscheinlich unkonventionell sein.',
    p: 'Howard Marks',
    w: 'Oaktree-Memo »Dare to Be Great II«, 2014',
  },
  {
    t: 'Die Geschichte wirkt in Geschichtsbüchern klarer und geordneter als in der empirischen Wirklichkeit.',
    p: 'Nassim Nicholas Taleb',
    w: 'Der Schwarze Schwan, Kap. 1',
  },
  {
    t: 'Scheitern ist nichts, wofür man sich schämen muss. Es ist etwas, das dich antreiben soll.',
    p: 'Abby Wambach',
    w: 'Abschlussrede Barnard College, 2018',
  },
  {
    t: 'Das entscheidende Organ ist hier nicht das Gehirn, sondern der Magen.',
    p: 'Peter Lynch',
    w: '',
  },
  {
    t: 'Wir stehen unter keinem König; jeder verfügt über sich selbst.',
    p: 'Seneca',
    w: 'Briefe an Lucilius 33,4',
  },
  {
    t: 'Die meisten großen Investments beginnen im Unbehagen.',
    p: 'Howard Marks',
    w: 'Oaktree-Memo »Dare to Be Great II«, 2014',
  },
  {
    t: 'Unser empirisches Wissen über seltene Ereignisse verhält sich umgekehrt proportional zu ihrer Wirkung.',
    p: 'Nassim Nicholas Taleb',
    w: 'Essay »The Fourth Quadrant«, 2008',
  },
  {
    t: 'Du darfst enttäuscht sein, wenn es sich anfühlt, als hätte das Leben dich auf die Bank gesetzt.',
    p: 'Abby Wambach',
    w: 'Abschlussrede Barnard College, 2018',
  },
  {
    t: 'Sag von keinem Ding: "Ich habe es verloren", sondern: "Ich habe es zurückgegeben".',
    p: 'Epiktet',
    w: 'Handbüchlein 11',
  },
  {
    t: 'Du musst für einen anderen leben, wenn du für dich selbst leben willst.',
    p: 'Seneca',
    w: 'Briefe an Lucilius 48,2',
  },
  {
    t: 'Risiko existiert nur in der Zukunft.',
    p: 'Howard Marks',
    w: 'Oaktree-Memo »Risk Revisited Again«, 2015',
  },
  {
    t: 'Was zerbrechlich ist, sollte früh brechen, solange es noch klein ist.',
    p: 'Nassim Nicholas Taleb',
    w: 'Financial Times, 2009',
  },
  {
    t: 'Gerade das Harte ist es, was das Schwimmen großartig macht.',
    p: 'Katie Ledecky',
    w: 'Just Add Water, 2024',
  },
  {
    /* Genau dieser Wortlaut steht bei Itzler, nicht in Goggins eigenem Buch. */
    t: 'Wenn dein Kopf sagt, du bist fertig, bist du in Wahrheit erst bei vierzig Prozent.',
    p: 'David Goggins',
    w: 'in Jesse Itzler, Living with a SEAL',
  },
  {
    t: 'Ein Punkt ist es, was wir leben, und noch weniger als ein Punkt.',
    p: 'Seneca',
    w: 'Briefe an Lucilius 49,3',
  },
  {
    t: 'Das Riskanteste auf der Welt ist die weit verbreitete Überzeugung, es gebe kein Risiko.',
    p: 'Howard Marks',
    w: 'Oaktree-Memo »Risk Revisited Again«, 2015',
  },
  {
    t: 'Zu begreifen, dass wir die Zukunft nicht kennen – ein so einfacher Satz, und doch so wichtig.',
    p: 'Peter Bernstein',
    w: 'Interview mit Jason Zweig, 2004',
  },
  {
    t: 'Mein Ziel war es, mich durch das Schwimmen selbst zu verbessern. Herauszufinden, wer ich bin und woraus ich gemacht bin.',
    p: 'Katie Ledecky',
    w: 'Just Add Water, 2024',
  },
  {
    t: 'Nimm eine einfache Idee und nimm sie ernst.',
    p: 'Charlie Munger',
    w: '',
  },
  {
    t: 'Vor dem Alter sorgte ich dafür, gut zu leben; im Alter dafür, gut zu sterben.',
    p: 'Seneca',
    w: 'Briefe an Lucilius 61,2',
  },
  {
    t: 'Die Sicherheitsmarge hängt immer vom gezahlten Preis ab. Bei einem Preis ist sie groß, bei einem höheren klein, bei einem noch höheren gar nicht mehr da.',
    p: 'Benjamin Graham',
    w: 'Der intelligente Investor, Kap. 20',
  },
  {
    t: 'Überleben ist der einzige Weg zum Reichtum.',
    p: 'Peter Bernstein',
    w: 'Interview mit Jason Zweig, 2004',
  },
  {
    t: 'Natürlich gibt es Luft nach oben, und ich muss besser werden, wenn ich weiter Chancen haben will, weit zu kommen.',
    p: 'Rafael Nadal',
    w: 'Pressekonferenz French Open, 2022',
  },
  {
    t: 'Die beste Art, sich zu rächen, ist, dem anderen nicht zu gleichen.',
    p: 'Marc Aurel',
    w: 'Selbstbetrachtungen 6,6',
  },
  {
    t: 'So lange muss man lernen, wie man nicht weiß; und wenn wir dem Sprichwort glauben: so lange man lebt.',
    p: 'Seneca',
    w: 'Briefe an Lucilius 76,3',
  },
  {
    t: 'Wer sich von unbegründeten Kursrückgängen aufscheuchen lässt, verwandelt seinen Grundvorteil verkehrterweise in einen Grundnachteil.',
    p: 'Benjamin Graham',
    w: 'Der intelligente Investor, Kap. 8',
  },
  {
    t: 'Konsequenzen sind wichtiger als Wahrscheinlichkeiten.',
    p: 'Peter Bernstein',
    w: 'Interview mit Jason Zweig, 2004',
  },
  {
    t: 'Morgen ist wieder ein Tag, um weiter Lösungen zu finden und das bestmögliche Gefühl zu suchen.',
    p: 'Rafael Nadal',
    w: 'Pressekonferenz French Open, 2022',
  },
  {
    t: 'Das Hauptproblem des Anlegers — und vermutlich sein ärgster Feind — ist wahrscheinlich er selbst.',
    p: 'Benjamin Graham',
    w: 'The Intelligent Investor',
  },
  {
    t: 'Wie mit einem Theaterstück, so mit dem Leben: Es zählt nicht, wie lange es dauert, sondern wie gut es gespielt wurde.',
    p: 'Seneca',
    w: 'Briefe an Lucilius 77,20',
  },
  {
    t: 'Auch ich glaube, dass es das oberste Ziel jedes Anlegers sein sollte, Verluste zu vermeiden.',
    p: 'Seth Klarman',
    w: 'Margin of Safety, 1991',
  },
  {
    t: 'Der riskanteste Moment ist der, in dem du recht hast. Dann steckst du am tiefsten in Schwierigkeiten.',
    p: 'Peter Bernstein',
    w: 'Interview mit Jason Zweig, 2004',
  },
  {
    t: 'Die Arbeit ist noch nicht erledigt.',
    p: 'Kobe Bryant',
    w: 'Pressekonferenz, NBA-Finals 2009',
  },
  {
    t: 'Es ist nicht so, dass wir es nicht wagen, weil es schwer ist. Es ist schwer, weil wir es nicht wagen.',
    p: 'Seneca',
    w: 'Briefe an Lucilius 104,26',
  },
  {
    t: 'Wir sollten die Illusion der Gewissheit verlernen.',
    p: 'Gerd Gigerenzer',
    w: 'Interview, Philosophie Magazin, 2020',
  },
  {
    t: 'Erfolglose Anleger werden von Emotionen beherrscht. Statt kühl und rational auf Schwankungen zu reagieren, reagieren sie mit Gier und Angst.',
    p: 'Seth Klarman',
    w: 'Margin of Safety, 1991',
  },
  {
    t: 'Leicht ist der Schmerz, wenn die Einbildung nichts hinzufügt.',
    p: 'Seneca',
    w: 'Briefe an Lucilius 78,13',
  },
  {
    t: 'Ich muss mich auf meine mentale Gesundheit konzentrieren.',
    p: 'Simone Biles',
    w: 'Olympische Spiele Tokio, 2021',
  },
  {
    t: 'Schmerz plus Reflexion ergibt Fortschritt.',
    p: 'Ray Dalio',
    w: 'Principles',
  },
  {
    t: 'Das Leben ist lang, wenn du es zu nutzen weißt.',
    p: 'Seneca',
    w: 'Von der Kürze des Lebens 2,1',
  },
  {
    t: 'Egal wie viel man recherchiert, manche Information bleibt unerreichbar. Anleger müssen lernen, mit weniger als vollständiger Information zu leben.',
    p: 'Seth Klarman',
    w: 'Margin of Safety, 1991',
  },
  {
    t: 'Wäre alles gewiss, bräuchten wir wenig von dem, was uns zum Menschen macht.',
    p: 'Gerd Gigerenzer',
    w: 'Interview, Philosophie Magazin, 2020',
  },
  {
    t: 'Verlange nicht, dass die Dinge geschehen, wie du es wünschst, sondern wünsche, dass sie geschehen, wie sie geschehen — dann wird dein Leben ruhig fließen.',
    p: 'Epiktet',
    w: 'Handbüchlein 8',
  },
  {
    t: 'Leben muss man das ganze Leben lang lernen, und, was dich vielleicht mehr wundert: das ganze Leben lang muss man sterben lernen.',
    p: 'Seneca',
    w: 'Von der Kürze des Lebens 7,3',
  },
  {
    t: 'Ein Anleger, der alle Antworten hat, hat nicht einmal alle Fragen verstanden.',
    p: 'John Templeton',
    w: '16 Regeln für Anlageerfolg, Regel 14',
  },
  {
    t: 'Nullrisiko ist eine Illusion. Es geht darum, Risiken zu akzeptieren und informiert und entspannt mit ihnen umzugehen.',
    p: 'Gerd Gigerenzer',
    w: 'Interview, Stifterverband, 2020',
  },
  {
    t: 'Es gibt eine Million Wege, an den Märkten Geld zu verdienen. Alle sind schwer zu finden.',
    p: 'Jack Schwager',
    w: '',
  },
  {
    t: 'Niemand schätzt die Zeit; man geht mit ihr großzügig um, als wäre sie umsonst.',
    p: 'Seneca',
    w: 'Von der Kürze des Lebens 8,1',
  },
  {
    t: 'Der große Unterschied zwischen Erfolgreichen und Erfolglosen: Erfolgreiche lernen aus ihren eigenen Fehlern und aus den Fehlern anderer.',
    p: 'John Templeton',
    w: '16 Regeln für Anlageerfolg, Regel 11',
  },
  {
    t: 'Die Auktionen, die du gewinnst, sind keine Zufallsstichprobe der Auktionen, auf die du geboten hast. Es sind die, bei denen du am höchsten geboten hast.',
    p: 'Richard Thaler',
    w: 'Tim Ferriss Show, 2025',
  },
  {
    t: 'Talent mal Anstrengung ergibt Können. Können mal Anstrengung ergibt Leistung.',
    p: 'Angela Duckworth',
    w: 'Grit',
  },
  {
    t: 'Allein die haben Muße, die sich der Weisheit widmen; allein sie leben.',
    p: 'Seneca',
    w: 'Von der Kürze des Lebens 14,1',
  },
  {
    t: 'Lass niemals dein Bedürfnis, recht zu haben, wichtiger werden als dein Bedürfnis herauszufinden, was wahr ist.',
    p: 'Ray Dalio',
    w: 'Principles',
  },
  {
    t: 'Jede Handlung so tun, als wäre sie die letzte deines Lebens.',
    p: 'Marc Aurel',
    w: 'Selbstbetrachtungen 2,5',
  },
  {
    t: 'Das beste Mittel gegen den Zorn ist der Aufschub.',
    p: 'Seneca',
    w: 'Über den Zorn 3,12,4',
  },
  {
    t: 'Ich will einfach nur richtig liegen. Es ist mir egal, ob die richtige Antwort von mir kommt.',
    p: 'Ray Dalio',
    w: 'Principles',
  },
  {
    t: 'Disziplin ist Freiheit.',
    p: 'Jocko Willink',
    w: 'Discipline Equals Freedom',
  },
  {
    t: 'Der Geist darf nicht dauernd gleich angespannt bleiben, sondern muss auch zum Spiel gerufen werden.',
    p: 'Seneca',
    w: 'Über die Ausgeglichenheit der Seele 17,4',
  },
  {
    t: 'Wenn du in die Gegenwart investierst, wirst du überfahren.',
    p: 'Stanley Druckenmiller',
    w: 'Rede vor dem Lost Tree Club, 2015',
  },
  {
    t: 'Sei formlos, gestaltlos — wie Wasser. Sei Wasser, mein Freund.',
    p: 'Bruce Lee',
    w: 'Longstreet, 1971',
  },
  {
    t: 'Krankheit ist ein Hindernis für den Körper, nicht aber für dein Vermögen zu wählen – es sei denn, du willst es so.',
    p: 'Epiktet',
    w: 'Handbüchlein 9',
  },
  {
    t: 'Die Elemente guten Tradings sind: erstens Verluste begrenzen, zweitens Verluste begrenzen und drittens Verluste begrenzen.',
    p: 'Ed Seykota',
    w: 'in Jack Schwager, Market Wizards',
  },
  {
    t: 'Alles, mein Lucilius, ist fremd — nur die Zeit ist unser.',
    p: 'Seneca',
    w: 'Briefe an Lucilius 1,3',
  },
  {
    t: 'Denke daran, dich im Leben zu verhalten wie bei einem Gastmahl.',
    p: 'Epiktet',
    w: 'Handbüchlein 15',
  },
  {
    t: 'Verlustserien begegne ich, indem ich meine Aktivität zurückfahre. Ich sitze sie einfach aus.',
    p: 'Ed Seykota',
    w: 'in Jack Schwager, Market Wizards',
  },
  {
    t: 'Wenn dich etwas Äußeres bedrückt, so stört dich nicht die Sache selbst, sondern dein Urteil über sie. Und dieses zu tilgen, steht jetzt in deiner Macht.',
    p: 'Marc Aurel',
    w: 'Selbstbetrachtungen 8,47',
  },
  {
    t: 'Denke daran, dass du Schauspieler in einem Stück bist, das der Autor so gestaltet, wie es ihm gefällt.',
    p: 'Epiktet',
    w: 'Handbüchlein 17',
  },
  {
    t: 'Setze bei einer einzelnen Idee immer weniger als fünf Prozent deines Geldes ein.',
    p: 'Michael Marcus',
    w: 'in Jack Schwager, Market Wizards',
  },
  {
    t: 'Du kannst unbesiegbar sein, wenn du dich auf keinen Kampf einlässt, dessen Ausgang nicht in deiner Macht steht.',
    p: 'Epiktet',
    w: 'Handbüchlein 19',
  },
  {
    t: 'Wenn sich eine Position schon beim Eröffnen falsch anfühlt, schäme dich nicht, deine Meinung zu ändern und sofort auszusteigen.',
    p: 'Michael Marcus',
    w: 'in Jack Schwager, Market Wizards',
  },
  {
    t: 'Nicht der beleidigt dich, der dich beschimpft oder schlägt, sondern deine Überzeugung, dass dies eine Beleidigung sei.',
    p: 'Epiktet',
    w: 'Handbüchlein 20',
  },
  {
    t: 'Du musst deinem eigenen Licht folgen. Wenn du den Stil eines anderen übernimmst, endest du oft mit dem Schlechtesten aus beiden Stilen.',
    p: 'Michael Marcus',
    w: 'in Jack Schwager, The Little Book of Market Wizards',
  },
  {
    t: 'Halte dir Tod und alles Schreckliche täglich vor Augen: Dann wirst du nie kleinlich denken und nichts allzu heftig begehren.',
    p: 'Epiktet',
    w: 'Handbüchlein 21',
  },
  {
    t: 'Im Zweifel steig aus und schlaf eine Nacht darüber. Wenn du draußen bist, kannst du wieder klar denken.',
    p: 'Michael Marcus',
    w: 'in Jack Schwager, The Little Book of Market Wizards',
  },
  {
    t: 'Jede Sache hat zwei Griffe: den einen, an dem man sie tragen kann, und den anderen, an dem man es nicht kann.',
    p: 'Epiktet',
    w: 'Handbüchlein 43',
  },
  {
    t: 'Wann immer ich eine Position eingehe, habe ich einen vorher festgelegten Stop. Nur so kann ich schlafen.',
    p: 'Bruce Kovner',
    w: 'in Jack Schwager, Market Wizards',
  },
  {
    t: 'Nenne dich niemals Philosoph und rede vor Unkundigen nicht viel über Lehrsätze, sondern handle nach ihnen.',
    p: 'Epiktet',
    w: 'Handbüchlein 46',
  },
  {
    t: 'Zu klein handeln, zu klein handeln, zu klein handeln – das ist mein zweiter Rat.',
    p: 'Bruce Kovner',
    w: 'in Jack Schwager, Market Wizards',
  },
  {
    t: 'Das Kennzeichen des gewöhnlichen Menschen ist: Er erwartet Nutzen und Schaden nie von sich selbst, sondern immer von außen.',
    p: 'Epiktet',
    w: 'Handbüchlein 48',
  },
  {
    t: 'Meine Erfahrung mit Trading-Anfängern ist: Sie handeln drei- bis fünfmal zu groß.',
    p: 'Bruce Kovner',
    w: 'in Jack Schwager, Market Wizards',
  },
  {
    t: 'Philosophie, Führerin des Lebens, Erforscherin der Tugend und Vertreiberin der Laster! Was wäre das Leben der Menschen ohne dich gewesen?',
    p: 'Cicero',
    w: 'Gespräche in Tusculum 5,5',
  },
  {
    t: 'Ich weiß, wo ich aussteige, bevor ich einsteige.',
    p: 'Bruce Kovner',
    w: 'in Jack Schwager, The Little Book of Market Wizards',
  },
  {
    t: 'Ich denke immer daran, Geld zu verlieren, nicht daran, Geld zu verdienen. Ich habe einen mentalen Stop – wird die Marke erreicht, bin ich raus, egal was ist.',
    p: 'Paul Tudor Jones',
    w: 'in Jack Schwager, Market Wizards',
  },
  {
    t: 'Riskiere niemals mehr als ein Prozent deines gesamten Kapitals in einem einzigen Trade.',
    p: 'Larry Hite',
    w: 'in Jack Schwager, The Little Book of Market Wizards',
  },
  {
    t: 'Wenn du gerade zu Brei geschlagen wirst, nimm den Kopf aus dem Mixer.',
    p: 'Richard Dennis',
    w: 'in Jack Schwager, The Little Book of Market Wizards',
  },
  {
    t: 'Konzentriere dich nicht darauf, Geld zu verdienen, sondern darauf, zu schützen, was du hast.',
    p: 'Paul Tudor Jones',
    w: 'in Jack Schwager, The Little Book of Market Wizards',
  },
  {
    t: 'Nach einem verheerenden Verlust spiele ich immer sehr klein und versuche nur, wieder schwarze Zahlen zu schreiben.',
    p: 'Marty Schwartz',
    w: 'in Jack Schwager, The Little Book of Market Wizards',
  },
  {
    t: 'Meine wichtigste Regel ist vielleicht: Versuche nicht, aus einer schlechten Position noch Gewinn zu machen – suche nur die beste Stelle zum Aussteigen.',
    p: 'Linda Bradford Raschke',
    w: 'in Jack Schwager, The New Market Wizards',
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
