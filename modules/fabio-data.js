/* Fabio-Kurs — Inhalt fuer modules/fabio.js.

   Zusammengefasst aus Christians Ordner "Fabio Trading": PropModel.pdf,
   Ordertrack Model.pdf + Backtest, Prop Firm Risk Protocol.pdf,
   prop_firm_methodologies.pdf, Lektionen 1–9 und den zwei Extra-Videos.
   Gleiche Auszeichnung wie orderflow-data.js: **fett** und `code`.

   Wichtig: Lektions-IDs ("f2.1") und Quiz-IDs ("f2-1") sind Schluessel im
   gespeicherten Fortschritt (dieselbe Zeile wie das Orderflow-Bootcamp, darum
   das "f" davor). Nur anhaengen, nie umnummerieren. */

const FABIO_PARTS = [
  {
    id: 1,
    title: 'Fabios Ansatz',
    intro: [],
    lessons: [
      {
        id: 'f1.1',
        title: 'Was in deinem Ordner steckt',
        blocks: [
          {
            p: 'Dieser Kurs fasst deinen Ordner **Fabio Trading** auf Deutsch zusammen: vier PDFs, ein Backtest, 9 kurze Lektionen und zwei lange Extra-Videos. Die rund 32 Live-Sessions (ca. 55 Stunden) sind noch nicht drin.',
          },
          {
            table: [
              ['Unterlage', 'Worum es geht'],
              [
                '**PropModel.pdf**',
                'Fabios Scalping-System für Prop-Konten: Limit-Order am Wertbereich der 40-Range-Kerze, 1:1',
              ],
              [
                '**Ordertrack Model.pdf** + Backtest',
                'Ein Community-Mitglied hat den Ordertrack-Ansatz in Regeln gefasst und 200 Trades getestet',
              ],
              [
                '**Prop Firm Risk Protocol.pdf**',
                'Wie du ein Prop-Konto am Leben hältst: eigene Grenzen, Stufen, Not-Aus',
              ],
              ['**Prop-Firm-Methoden.pdf**', 'Zwei Wege: festes Tagesziel oder auf Leistung gehen'],
              ['**Lektionen 1–9**', 'Live-Mitschnitte: Gamma + Ordertrack, wie er Trades führt'],
              ['**Extra-Videos**', 'Prop-Scalping-Modell im Test und eine Wochen-Analyse'],
            ],
          },
          {
            p: 'Alle Zeiten sind Wiener Zeit. Die New-Yorker Hauptsitzung beginnt um 15:30.',
          },
          {
            p: 'Lernstoff, keine Anlageberatung. Jeder Trade braucht einen Stop.',
          },
          { merk: 'Lies Teil für Teil, und such das Gelernte am nächsten Tag am MNQ-Chart.' },
        ],
      },
      {
        id: 'f1.2',
        title: 'Seine Denkweise in 3 Schritten',
        blocks: [
          {
            p: 'Egal ob Scalping-Modell oder großer Gamma-Trade: Fabio geht immer gleich vor.',
          },
          {
            ol: [
              '**Kontext – in welche Richtung?** Profil der Vortage, Null-Gamma-Linie (Zero Gamma), Netto-Gamma (Net GEX), Bruch der IVB (Initial Value Balance, Wertbereich der ersten Handelsphase).',
              '**Ort – wo?** Dort, wo die Auktion gekippt ist: Absorption, Wertbereich-Rand (VAH/VAL), dünne Zonen (LVN).',
              '**Auslöser – wann?** Orderflow bestätigt: Delta dreht, Käufer bzw. Verkäufer übernehmen die Kontrolle, die neue Kerze hat ihren Wertbereich höher bzw. tiefer.',
            ],
          },
          {
            p: 'Dazu kommt sein Risiko-Stil: **früh absichern, Gewinner laufen lassen, nach Regeln aufhören.**',
          },
          { merk: 'Richtung vom Kontext, Einstieg vom Orderflow, Ausstieg nach Plan.' },
        ],
      },
    ],
  },
  {
    id: 2,
    title: 'Das Prop-Modell (40R-Scalping)',
    intro: [
      {
        p: 'Quelle: *PropModel.pdf*. Ein Scalping-System mit hoher Trefferquote für Prop-Konten, gebaut auf Auktionstheorie und Orderflow.',
      },
    ],
    lessons: [
      {
        id: 'f2.1',
        title: 'Die Idee',
        blocks: [
          {
            p: '**Was ist das?** Auf **40-Range-Kerzen** (jede Kerze ist genau 40 Ticks groß, egal wie lange das dauert) legst du eine **Limit-Order an den Wertbereich-Rand der gerade geschlossenen Kerze**. Schnell rein, schnell raus, immer 1:1.',
          },
          {
            table: [
              ['', 'Long', 'Short'],
              ['**Einstieg**', 'Limit am **VAH** der geschlossenen Kerze', 'Limit am **VAL**'],
              ['**Stop**', '**VAL** derselben Kerze (oder Kerzentief)', 'VAH (oder Kerzenhoch)'],
              ['**Ziel**', '1:1, automatisch per OCO', '1:1'],
            ],
          },
          {
            p: '**Wo funktioniert es?** In klaren **Trendmärkten** (die Wertbereiche stapeln sich in eine Richtung) und an **Schlüsselmarken für Gegenbewegungen** (das Delta dreht und der Wertbereich wandert gegen den alten Trend).',
          },
          {
            p: 'Wirst du nicht gefüllt, **läufst du dem Preis nicht hinterher.** Das gehört dazu.',
          },
          {
            merk: 'Limit am Wertbereich-Rand, Stop am anderen Rand, 1:1 – und nie hinterherlaufen.',
          },
        ],
      },
      {
        id: 'f2.2',
        title: 'Chart und OCO einstellen',
        blocks: [
          { p: '**Chart in Deepcharts:**' },
          {
            ul: [
              'Vorlage **OrderTrack** laden',
              'Kerzen: **40 Range** (Range-Kerzen, nicht Zeit)',
              'Volumen-POC an, Delta-POC an, Delta-Kerzen an',
              'Order Flow Analyzer → *Value Area*: „Show Line“ und „Highlight“ an, damit VAH und VAL auf jeder Kerze sichtbar sind',
            ],
          },
          {
            p: 'Fabio sagt im Test-Video: Das geht auf **jeder** Orderflow-Plattform. Du brauchst nur Gesamtvolumen, Wertbereich und Delta pro 40R-Kerze.',
          },
          {
            p: '**OCO einstellen** (One-Cancels-Other: Stop und Ziel hängen zusammen, fällt eins, wird das andere gelöscht):',
          },
          {
            ul: [
              'OCO-Strategie **an**, Modus **SL/TP**',
              'Stop und Ziel in **Geld**, z. B. 250 $ und 250 $',
              'Die Stückzahl rechnet die Software selbst aus',
              'Einstieg als **Limit** am VAH (Long) bzw. VAL (Short)',
            ],
          },
          {
            p: '**Größe:** 50k-Prop-Konto · 250 $ pro Trade · Tagesdeckel 6R = **1.500 $**. Wegen der 50-%-Konsistenzregel vieler Prop Firms ist das meist der höchste erlaubte Tagesgewinn.',
          },
          { merk: 'Stop und Ziel stehen in Geld fest, bevor die Order rausgeht.' },
        ],
      },
      {
        id: 'f2.3',
        title: 'Die 3 Bedingungen',
        blocks: [
          {
            p: 'Die Limit-Order kommt **nur**, wenn alle drei auf der schließenden 40R-Kerze passen.',
          },
          {
            ol: [
              '**Die Auktion dreht (Auction Flip):** Das Delta kippt. Käufer übernehmen von den Verkäufern (Long) oder umgekehrt (Short).',
              '**Der Wertbereich verschiebt sich:** Der Wertbereich der neuen Kerze liegt **höher** als der der vorigen (Long) bzw. tiefer (Short). Diese Kerze „setzt den Standard“.',
              '**Wer hat die Kontrolle – live:** Während die Kerze entsteht, müssen die Käufer (Long) bzw. Verkäufer (Short) dranbleiben. **Kippt die Kontrolle mitten in der Kerze, löschst du die Order sofort.**',
            ],
          },
          {
            p: 'Alles erfüllt → Limit am VAH, Stop am VAL, Ziel per OCO. Danach beobachtest du die Position weiter.',
          },
          {
            p: 'Setzt die nächste Kerze einen **neuen** Standard (Wertbereich noch höher), ziehst du die alte Limit-Order weg und legst sie an den neuen VAH.',
          },
          {
            merk: 'Delta dreht + Wertbereich wandert + Kontrolle hält = Order raus. Sonst nichts.',
          },
        ],
      },
      {
        id: 'f2.4',
        title: 'Muster, Uhrzeit und Tagesregeln',
        blocks: [
          { p: '**Die 6 Muster aus dem PDF:**' },
          {
            ol: [
              'Auktion dreht',
              'Ausbruch über ein vorheriges Hoch',
              'Verkäufer verteidigen, Käufer laden nach',
              'Verkäufer werden am Kerzenboden absorbiert',
              'Käufer verteidigen → nächste Kerze rauf',
              'Auktion dreht Short: Bruch und Rücktest',
            ],
          },
          {
            table: [
              ['Wann', 'Handeln?'],
              [
                'Vorbörse und **die ersten 2 Stunden** der Hauptsitzung (15:30–17:30)',
                '**Ja.** Liquide, klare Auktionen',
              ],
              ['Mittagszeit und Abendsitzung', '**Nein.** Dünn und zappelig'],
            ],
          },
          { p: '**Tagesregeln (nicht verhandelbar):**' },
          {
            ul: [
              '**3 Stops am Tag** → Plattform zu. Kein Rache-Trading.',
              '**6R Gewinn** → Feierabend. Gewinn sichern.',
            ],
          },
          { merk: 'Nur im richtigen Zeitfenster – und 3 Stops oder 6R beenden den Tag.' },
        ],
      },
    ],
  },
  {
    id: 3,
    title: 'Das Ordertrack-Modell und sein Backtest',
    intro: [
      {
        p: 'Quelle: *Ordertrack Model.pdf*, *OrderTrack + Linear Regression.pdf* und ein Beitrag von Alexandre aus der Community. Nicht von Fabio selbst, sondern sein Ansatz in feste Regeln gegossen.',
      },
    ],
    lessons: [
      {
        id: 'f3.1',
        title: 'Regeln und die 5 Filter',
        blocks: [
          {
            ul: [
              'Schluss bei **+6R** oder **3 Verlusten in Folge**, was zuerst kommt',
              'Jeder Trade **1:1**',
              'Erst **ab 9:45 New-York-Zeit** (15:45 bei uns)',
              'Nur in Richtung der **linearen Regression** (Trendlinie durch die Kurse)',
            ],
          },
          {
            table: [
              ['Filter', 'Was du prüfst'],
              ['**Marktzustand**', 'Bruch der IVB + lineare Regression geben die Richtung'],
              ['**Ort**', 'Am Hoch oder Tief der IVB'],
              ['**Auslöser**', '**Delta dreht** (negativ → positiv für Long)'],
              ['**Ungültig**', 'Delta dreht zurück → raus'],
              ['**Zeit-Stopp**', 'Delta springt hin und her → Stop auf Einstieg'],
            ],
          },
          {
            p: '**Gefahrenzonen – nicht handeln, auch wenn das Setup da ist:** News und die New-Yorker Eröffnung selbst.',
          },
          { merk: 'IVB-Bruch gibt die Richtung, Delta-Dreher den Einstieg.' },
        ],
      },
      {
        id: 'f3.2',
        title: 'Trend oder Seitwärts?',
        blocks: [
          {
            ul: [
              '**Trend:** IVB bricht, der Preis bleibt draußen und läuft weiter. Einstieg an der linearen Regression, wenn eine Kerze den Wertbereich ablehnt. Ungültig, wenn der Wertbereich gegen dich zurückerobert wird.',
              '**Seitwärts:** IVB bricht, der Preis kommt **sofort zurück** (Fehlausbruch). Einstieg, wenn der POC die Richtung dreht. Ungültig, wenn er nicht dreht.',
              '**Übergang:** Der Preis klebt in einer Konsolidierung, dann bricht eine starke Delta-Kerze raus. Das kann der Start einer neuen Richtung sein.',
            ],
          },
          {
            p: '**Faustregel:** Zwei oder mehr Auktions-Wechsel kurz hintereinander bedeuten eher Seitwärts, nicht Trend.',
          },
          { merk: 'Trend = Bruch + bleibt draußen. Seitwärts = Bruch + sofort zurück.' },
        ],
      },
      {
        id: 'f3.3',
        title: 'Was der Backtest zeigt',
        blocks: [
          {
            p: '200 Trades von Jänner bis Februar 2026, Sim-Konto 50k, ca. 250 $ Risiko pro Trade.',
          },
          {
            table: [
              ['Kennzahl', 'Wert'],
              ['Trefferquote', '**50 %** (100 zu 100)'],
              ['Ø Gewinner / Ø Verlierer', '+242 $ / −241 $'],
              ['Endergebnis', '**+100 $** (Faktor 1,004)'],
              ['Größter Rückgang', '−3.175 $'],
              ['Long / Short', '−1.305 $ / +1.405 $'],
              ['Bester Stand', '+2.965 $, dann weg'],
            ],
          },
          { p: '**Was der Tester selbst daraus lernt:**' },
          {
            ul: [
              'Er hat das große Bild ignoriert: Profil über mehrere Tage, COT-Daten.',
              'Nur an 2 Tagen gab es die vollen +6R. Sonst −3R oder kleine Gewinne. Seitwärtstage sind schwer.',
              'Am besten läuft es, wenn der Markt aus einer Range ausbricht.',
            ],
          },
          {
            merk: 'Mechanisch 1:1 ohne Kontext = Nullsummenspiel. Der Vorteil kommt aus Kontext und Laufenlassen.',
          },
        ],
      },
    ],
  },
  {
    id: 4,
    title: 'Gamma Scalping: die Lektionen 1–9',
    intro: [
      {
        p: 'Die 9 Lektionen sind kurze Mitschnitte aus Fabios Live-Sessions. Er zeigt jedes Mal einen Trade und wie er ihn führt. Seine Zahlen sind von einem großen Konto – was zählt, ist das **R** (Vielfache des Risikos).',
      },
    ],
    lessons: [
      {
        id: 'f4.1',
        title: 'Seine Werkzeuge',
        blocks: [
          {
            table: [
              ['Werkzeug', 'Was es ihm sagt'],
              [
                '**Null-Gamma-Linie (Zero Gamma)**',
                'Die wichtigste Linie. Kreuzt der Preis sie, ändert sich das Verhalten des ganzen Tages',
              ],
              [
                '**Netto-Gamma in Milliarden (Net GEX)**',
                'Wie viel Options-Gewicht in eine Richtung zeigt. Steigt es im Trade weiter, ist das **Treibstoff**',
              ],
              [
                '**Gamma-Marken**',
                'Große Options-Marken sind seine **Kursziele**. Daher Ziele von 1:8 bis 1:20',
              ],
              [
                '**IVB**',
                'Bricht sie in dieselbe Richtung wie das Gamma, ist die Richtung bestätigt',
              ],
              [
                '**Ordertrack auf 40R**',
                'Zeigt, wo die Auktion gekippt ist: Absorption, Kontrollwechsel. Dort liegt der Einstieg',
              ],
            ],
          },
          {
            p: '**Triple A** nennt er die Zone, in der Absorption, Akkumulation und Aggression zusammenkommen. Kommt der Preis dorthin zurück und das Gamma passt, ist das sein bester Einstieg (Lektion 5 und 6).',
          },
          { merk: 'Gamma zeigt die Richtung und das Ziel, Ordertrack den Punkt.' },
        ],
      },
      {
        id: 'f4.2',
        title: 'Einstieg und Stop',
        blocks: [
          {
            ul: [
              '**Einstieg** dort, wo die Auktion kippt: nach einer Akkumulation, nach einer klaren Ablehnung, oder wenn der Wertbereich der neuen Kerze höher liegt.',
              '**Stop** hinter die letzte Aggression oder Absorption der eigenen Seite. Bricht die, ist die Idee falsch.',
              'Gerne als **Limit-Order** am VAL bzw. VAH nach zwei Abprallern (Lektion 8).',
              'Ein guter Trade reagiert **sofort und heftig** (Lektion 9). Zögert der Markt, ist das ein Warnzeichen.',
            ],
          },
          {
            p: 'Er handelt nur in die Richtung, die Null-Gamma, Netto-Gamma und IVB zeigen. Gegen das Gamma nimmt er nichts.',
          },
          { merk: 'Rein, wo die Auktion kippt. Stop hinter die letzte Aggression.' },
        ],
      },
      {
        id: 'f4.3',
        title: 'Stop in den Gewinn und nachziehen',
        blocks: [
          {
            ol: [
              '**„Stop Loss in Profit“ so früh wie möglich:** Bricht der Markt die Marke, wo er hin soll, kommt der Stop ins Plus. Oft nur +150 bis +250 $, damit Kommission und Schlupf gedeckt sind. Ab dann ist der Trade ein **Freilos**.',
              '**In Stufen nachziehen:** immer unter die nächste neue Aggression der Käufer bzw. unter das neue VAL. So sichert er 2R, 4R, 6R … (Lektion 9: 4,6R → 6R → 11,2R → 14R → 16,5R).',
              '**Gewinne nehmen, wenn es kämpft:** Hängt der Preis an einer Gamma-Marke oder sieht er eine gescheiterte Auktion, schließt er von Hand.',
            ],
          },
          {
            p: 'Sein Satz dazu: *Hoffen ist keine Strategie.*',
          },
          {
            p: 'Mehrere kleine Stops im Plus kosten fast nur Kommission. Dafür bleibt das Konto ruhig, und ein einziger Läufer zahlt den Tag.',
          },
          { merk: 'Erst Risiko raus, dann Gewinn in Stufen sichern, dann laufen lassen.' },
        ],
      },
      {
        id: 'f4.4',
        title: 'Die 9 Lektionen im Überblick',
        blocks: [
          {
            table: [
              ['Lektion', 'Was passiert', 'Ergebnis'],
              [
                '1',
                'Long nach Konsolidierung, Wert-Flip, Regression dreht, Preis über Null-Gamma',
                'Läuft bei 1:8',
              ],
              [
                '2',
                'Wiedereinstieg nach Akkumulation, Käufer verteidigen jedes Tief',
                '1:2,6, weil Käufer oben kämpfen',
              ],
              [
                '3',
                'Short am Abend, Abprall an Null-Gamma, IVB bricht nach unten',
                'Raus bei 1:3,2',
              ],
              ['4', 'Gamma kippt von −200 auf +100 Mrd. → Long', '≈ 1:3'],
              ['5', 'Ersten Schub verpasst, Rücktest der Triple-A-Zone abgewartet', 'Tag mit 22R'],
              ['6', 'Zwei Stops, dann Long an der Absorption', '≈ 10R'],
              ['7', 'Ausbruch nach langer Konsolidierung, jeder Nachzieh-Schritt erklärt', '6,1R'],
              ['8', 'Wochenend-Analyse + Limit am VAL nach zwei Abprallern', 'Tag mit 16R'],
              ['9', '4 Stunden Seitwärts, zwei Breakevens, ein Stop, dann der Läufer', '16,5R'],
            ],
          },
          {
            p: '**Was alle 9 gemeinsam haben:** Geduld an Seitwärtstagen. Mehrere kleine Stops oder Breakevens sind normal. Der eine Trade in Richtung Gamma bringt den Tag.',
          },
          { merk: 'Kleine Stops sind der Preis für den großen Läufer.' },
        ],
      },
    ],
  },
  {
    id: 5,
    title: 'Risiko und Prop Firms',
    intro: [
      {
        p: 'Quelle: *Prop Firm Risk Protocol.pdf* und *Prop-Firm-Methoden.pdf*. Grundgedanke: Ein Prop-Konto ist ein Überlebens-System, kein Zockerkapital.',
      },
    ],
    lessons: [
      {
        id: 'f5.1',
        title: 'Eigene, strengere Grenzen',
        blocks: [
          {
            p: 'Konten sterben an vier Dingen: den **Regeln der Firma**, dem **Markt** (Schlupf, News), der **Ausführung** (zu oft, zu spät) und dem **Kopf** (nach Verlust aggressiv, nach Gewinn gierig).',
          },
          {
            table: [
              ['', 'Firma (Beispiel)', 'Deine eigene Grenze'],
              ['Tagesverlust', '5.000 $', '**1.000–1.500 $**'],
              ['Gesamtrückgang', '10.000 $', '**3.000–4.000 $**'],
              ['Risiko pro Trade', '–', '**0,10–0,15 %** vom Konto'],
              ['Wochenverlust', 'meist keine', '**2,0–2,5 %**'],
            ],
          },
          {
            p: 'Hohe Trefferquote ist hier wichtiger als bei eigenem Geld, weil lange Verlustserien Kurve und Kopf kaputt machen. Gute Setups: Rücksetzer im Trend, Fehlausbruch-Umkehr, Erschöpfung an klaren Extremen.',
          },
          { merk: 'Die Grenze der Firma ist die Notbremse, nicht dein Budget.' },
        ],
      },
      {
        id: 'f5.2',
        title: 'Stufenweise aufbauen',
        blocks: [
          {
            table: [
              ['Stufe', 'Risiko', 'Wann'],
              ['1 – Antesten', '0,10–0,15 %', 'Sauberes Setup, klare Ungültig-Marke'],
              ['2 – Bestätigung', 'auf 0,20–0,30 %', 'Hält nach Rücksetzer, starker Orderflow'],
              ['3 – Bezahlter Zukauf', 'bis 0,35–0,50 %', 'Trade läuft schon, Stop verbessert'],
            ],
          },
          { p: '**Niemals in einen Verlierer nachkaufen.** Neues Signal = neuer Trade.' },
          { p: '**Größen-Leiter:** Hochstufen langsam, runterstufen sofort.' },
          {
            table: [
              ['Stufe', 'Bedingung', 'Risiko'],
              ['Start', 'Beginn oder nach Rückschlag', '100 $'],
              ['1', '+1.500 $, kein 5-Tage-Rückgang über 500 $', '125 $'],
              ['2', '+3.000 $, Verhalten sauber', '150 $'],
              ['3', '+5.000 $, Verluste nicht größer geworden', '175 $'],
              [
                'Zurück',
                '3 rote Tage in 5 Sitzungen oder grober Fehler',
                'sofort eine Stufe runter',
              ],
            ],
          },
          { merk: 'Klein anfangen. Größer nur, wenn der Markt es schon bezahlt hat.' },
        ],
      },
      {
        id: 'f5.3',
        title: 'Tagesregeln und Not-Aus',
        blocks: [
          {
            table: [
              ['Regel', 'Standard'],
              ['Trade-Ideen pro Tag', 'max. **3**'],
              ['Verluste in Folge', '**3 = Schluss**'],
              ['Nach 2 Verlusten', 'Größe **25–50 %** runter'],
              ['Nach 2 roten Tagen', 'nächster Tag **halbe Größe**'],
              ['Grüner Tag', 'Ziel erreicht = Stopp'],
            ],
          },
          {
            p: '**Not-Aus für den Tag:** nach 3 Verlusten, nach **einem** Rache-Trade oder am Tages-Stop. **Für die Woche:** Wochen-Grenze, 3 Verhaltensfehler oder deutlich schlechter als normal.',
          },
          {
            p: '**Prüfung vs. finanziert:** In der Prüfung 0,10–0,15 % Basisrisiko. Im finanzierten Konto **0,05–0,10 %** – dort geht es um Auszahlungen, nicht um Punkte.',
          },
          { merk: 'Ein guter Prop-Trader sieht von außen fast langweilig aus.' },
        ],
      },
      {
        id: 'f5.4',
        title: 'Zwei Methoden und dein echtes Tagesziel',
        blocks: [
          {
            table: [
              ['', 'Methode 1: Stabil', 'Methode 2: Leistung'],
              ['Ziel', 'Konto lange halten', 'Maximal verdienen'],
              ['Tagesende', 'Stopp bei Ziel', 'Weiter, solange es läuft'],
              ['Psyche', 'Ruhiger', 'Viel intensiver'],
              ['Für wen', 'Disziplinierte', 'Erfahrene, die Druck aushalten'],
            ],
          },
          { p: '**Tagesziel rechnen (Methode 1, 100k-Konto, Ziel Ø 300 $/Tag):**' },
          {
            ol: [
              '21 Handelstage, davon z. B. 17 grün und 4 rot',
              'Tages-Stop 400 $ → 4 × 400 $ = 1.600 $ zum Aufholen',
              '17 × 300 $ = 5.100 $ + 1.600 $ = 6.700 $',
              '6.700 $ ÷ 17 = **≈ 394 $ pro grünem Tag**',
              'Machbar? 3 MNQ × 2 $ pro Punkt = 6 $ pro Punkt → 300 $ ≈ **50 Punkte**',
            ],
          },
          {
            p: 'Ist das für dich normal machbar, passt das Ziel. Wenn nicht: Ziel runter oder auf mehrere Konten verteilen. Das PDF empfiehlt Methode 1 als Fundament.',
          },
          { merk: 'Rote Tage gehören in die Rechnung, sonst ist das Tagesziel zu klein.' },
        ],
      },
    ],
  },
  {
    id: 6,
    title: 'Die Extra-Videos',
    intro: [],
    lessons: [
      {
        id: 'f6.1',
        title: 'Das Prop-Modell im Test',
        blocks: [
          {
            p: 'Im Video *Prop Scalping Model Test* (34 Minuten) spielt Fabio zwei Handelstage im Sim-Konto nach: 1.000 $ Risiko, 1.000 $ Ziel, Schluss bei 3 Stops in Folge oder +6R.',
          },
          {
            ul: [
              '**Tag 1:** schnell +3R bis +4R, dann 3 Stops hintereinander → Regel greift, Schluss bei **+1R**.',
              '**Tag 2:** Gewinne und einzelne Stops abwechselnd, am Ende das 6R-Ziel → Schluss.',
            ],
          },
          { p: '**Was du mitnimmst:**' },
          {
            ol: [
              '**Die Kerze setzt den Standard:** Schließt eine 40R-Kerze über dem Wertbereich und ihr Wertbereich liegt höher, soll genau dieser Wertbereich als Boden halten. Dort liegt die Limit-Order.',
              '**Erst nach Kerzenschluss** eine Order legen. Neuer Standard → Order nachziehen.',
              'In sehr aggressiven Märkten wirst du oft **nicht gefüllt**, weil die Käufer schon vorher nachladen. Das gehört dazu.',
              '**Mit der großen Richtung:** In einem Short-Tag keine Longs, auch wenn unten Absorption ist.',
              '**Gutes Zeichen im Trade:** Käufer laden passiv immer wieder auf derselben Marke nach.',
              'Nicht verkaufen, solange der Wertbereich, der den Ausbruch gemacht hat, verteidigt wird.',
            ],
          },
          { merk: 'Lass den Markt entscheiden, wie viel er dir heute gibt. Erzwing nichts.' },
        ],
      },
      {
        id: 'f6.2',
        title: 'Der Wochenplan (Weekly Profiling)',
        blocks: [
          {
            p: 'Im Video *Weekly Profiling – 20. April* (29 Minuten) macht Fabio den Wochenplan für den Nasdaq. Sein Ablauf:',
          },
          {
            ol: [
              '**Marktphase:** Ist der Markt aus einer langen Range ausgebrochen, erwartet er Trendtage → weitere Ziele, Positionen länger halten.',
              '**COT-Bericht** (Commitment of Traders, wöchentliche Positionsdaten): Wie stehen die großen Spekulanten und Vermögensverwalter? Stark short → er handelt short. Schließen sie gerade Shorts → erst eine Erholungswoche.',
              '**Zwei Marken aus dem Profil:** eine **konservative** und eine **aggressive** Zone, bis zu der die Erholung laufen darf. Dazwischen seine „Box des Vertrauens“. **In der Mitte handelt er nicht.**',
              '**Auslöser an der Marke:** Kumuliertes Delta steigt stark, aber der Preis kommt nicht weiter → Absorption. Große Einzelaufträge (Big Trades) ohne Wirkung enden meist im Einbruch.',
            ],
          },
          {
            p: '**Wenn eine Nachricht öffentlich ist, ist es zum Handeln zu spät.** Kommt in einem klaren Abwärtstrend eine überraschend positive Schlagzeile, springt der Markt hoch und löst Shorts aus. Genau diese Spitze nutzt er für den Einstieg in Trendrichtung.',
          },
          {
            merk: 'Positionierung der Großen lesen, Marken vorher festlegen, nicht in der Mitte handeln.',
          },
        ],
      },
    ],
  },
  {
    id: 7,
    title: 'Checkliste für deinen Handelstag',
    intro: [],
    lessons: [
      {
        id: 'f7.1',
        title: 'Vorher, dabei, danach',
        blocks: [
          { p: '**Vor der Sitzung**' },
          {
            ul: [
              'Tagestyp einschätzen: Trend, Seitwärts, Übergang, News?',
              'Null-Gamma, Netto-Gamma und große Gamma-Marken notieren',
              'Profil der Vortage: VAH, VAL, POC, dünne Zonen',
              'News-Zeiten markieren',
              '**Aufschreiben, was dich heute draußen hält**',
              'Tages-Stop und 6R-Ziel festlegen, OCO in Geld einstellen',
            ],
          },
          { p: '**Zur Eröffnung (15:30)**' },
          {
            ul: [
              'Erst schauen: Initiative, Annahme, Tempo. Bewegung ist nicht Qualität.',
              'IVB abwarten: Wohin bricht sie, passt das zum Gamma?',
            ],
          },
          { p: '**Vor jedem Trade**' },
          {
            ul: [
              'Richtung passt zu Gamma und IVB?',
              'Delta gedreht, Wertbereich gewandert, Kontrolle hält?',
              'Stop hinter der letzten Aggression, Ziel klar?',
            ],
          },
          { p: '**Im Trade**' },
          {
            ul: [
              'Reagiert der Markt sofort? Wenn nicht: Zeit-Stopp.',
              'Marke gebrochen → Stop ins Plus',
              'Neue Aggression → Stop nachziehen',
              'Kämpft er an einer Marke → Gewinn nehmen',
            ],
          },
          { p: '**Schluss**' },
          {
            ul: [
              '3 Stops, 6R oder ein Rache-Trade → Plattform zu',
              'Jeden Trade bewerten: super, ok, vermeidbar, Kopfsache',
              'Screenshot + Notiz: Tagestyp, wie weit gegen dich, wie weit für dich',
            ],
          },
          { merk: 'Die Checkliste entscheidet, nicht das Gefühl.' },
        ],
      },
    ],
  },
];

/* Erste Antwort ist die richtige; angezeigt wird gemischt. */
const FABIO_QUIZ = {
  2: [
    {
      id: 'f2-1',
      q: 'Prop-Modell, Long: Wo legst du die Limit-Order?',
      o: [
        'Am VAH der gerade geschlossenen 40R-Kerze',
        'Am Hoch der Kerze',
        'Am POC des Vortags',
        'Market-Order sofort nach Kerzenschluss',
      ],
      e: 'Einstieg per Limit am VAH der geschlossenen Kerze, Stop am VAL derselben Kerze, Ziel 1:1 per OCO.',
    },
    {
      id: 'f2-2',
      q: 'Die Käufer verlieren mitten in der Kerze die Kontrolle. Deine Limit-Order liegt noch. Was tust du?',
      o: [
        'Order sofort löschen',
        'Liegen lassen, das Ziel ist ja 1:1',
        'Stop weiter weg legen',
        'Zusätzlich eine Market-Order kaufen',
      ],
      e: 'Bedingung 3: Die eigene Seite muss die Kontrolle behalten, während die Kerze entsteht. Kippt sie, ist das Setup weg.',
    },
    {
      id: 'f2-3',
      q: 'Wann ist das Prop-Modell laut PDF AUS?',
      o: [
        'Mittagszeit und Abendsitzung',
        'Die ersten 2 Stunden der Hauptsitzung',
        'Vorbörse',
        'Wenn das Delta dreht',
      ],
      e: 'Mittags und abends ist es dünn und zappelig. Gehandelt wird in der Vorbörse und in den ersten 2 Stunden ab 15:30.',
    },
    {
      id: 'f2-4',
      q: 'Du bist nicht gefüllt worden und der Preis läuft ohne dich. Was sagt das PDF?',
      o: [
        'Nicht hinterherlaufen, das gehört dazu',
        'Sofort per Market-Order nachkaufen',
        'Die Limit-Order höher setzen',
        'Doppelte Größe beim nächsten Trade',
      ],
      e: 'Das Modell lebt vom genauen Einstieg am Wertbereich-Rand. Hinterherlaufen zerstört das 1:1.',
    },
  ],
  3: [
    {
      id: 'f3-1',
      q: 'Ordertrack-Modell: IVB bricht, aber der Preis kommt sofort zurück. Welcher Tagestyp?',
      o: ['Seitwärts', 'Trend', 'Übergang', 'News-Tag'],
      e: 'Fehlausbruch und Rückkehr in den Wert = Seitwärts. Trend heißt: Bruch, Preis bleibt draußen, läuft weiter.',
    },
    {
      id: 'f3-2',
      q: 'Was ist der Auslöser für den Einstieg im Ordertrack-Modell?',
      o: ['Das Delta dreht', 'Eine grüne Kerze', 'Der Preis berührt den POC', 'Die Uhrzeit 15:30'],
      e: 'Auslöser ist der Delta-Dreher, z. B. von negativ auf positiv für Long. Dreht es zurück, bist du raus.',
    },
    {
      id: 'f3-3',
      q: 'Backtest mit 200 Trades, 1:1, 50 % Treffer. Was kam heraus?',
      o: [
        'Praktisch null: +100 $',
        'Ein bestandener 50k-Prop-Test',
        '+10.000 $',
        'Das Konto ging verloren',
      ],
      e: 'Gewinnfaktor 1,004. Bei 1:1 und 50 % bleibt nichts übrig. Der Tester hatte Kontext und Laufenlassen weggelassen.',
    },
    {
      id: 'f3-4',
      q: 'Zwei oder mehr Auktions-Wechsel kurz hintereinander deuten auf …',
      o: ['Seitwärts', 'Einen starken Trend', 'Einen Ausbruch', 'Ein neues Allzeithoch'],
      e: 'Wechselt die Kontrolle ständig, findet der Markt keine Richtung. Das ist das Zeichen für einen Seitwärtstag.',
    },
  ],
  4: [
    {
      id: 'f4-1',
      q: 'Welche Linie ist in Fabios Gamma-Lektionen die wichtigste?',
      o: [
        'Die Null-Gamma-Linie',
        'Der gleitende Durchschnitt',
        'Das Vortageshoch',
        'Die runde Zahl',
      ],
      e: 'Kreuzt der Preis die Null-Gamma-Linie, ändert sich das Verhalten des Tages. Daran richtet er die Richtung aus.',
    },
    {
      id: 'f4-2',
      q: 'Wohin legt Fabio den Stop?',
      o: [
        'Hinter die letzte Aggression oder Absorption der eigenen Seite',
        'Immer genau 20 Punkte weg',
        'Unter das Tagestief',
        'Er nutzt keinen Stop',
      ],
      e: 'Bricht die letzte Aggression der eigenen Seite, ist die Idee falsch. Darum gehört der Stop genau dahinter.',
    },
    {
      id: 'f4-3',
      q: 'Was macht er, sobald der Markt die Marke bricht, wo er hin soll?',
      o: [
        'Stop ins Plus, der Trade wird zum Freilos',
        'Position verdoppeln',
        'Ziel näher holen',
        'Nichts, bis Ziel oder Stop kommt',
      ],
      e: 'Stop Loss in Profit: oft nur +150 bis +250 $, damit Kommission und Schlupf gedeckt sind. Ab dann kann er nicht mehr verlieren.',
    },
    {
      id: 'f4-4',
      q: 'Der Preis hängt an einer Gamma-Marke fest, die Käufer kommen nicht durch. Was tut er?',
      o: [
        'Gewinn von Hand nehmen',
        'Nachkaufen',
        'Stop zurück auf den Einstieg',
        'Hoffen, dass es weitergeht',
      ],
      e: 'Gescheiterte Auktion an der Marke = Gewinn sichern. Sein Satz: Hoffen ist keine Strategie.',
    },
    {
      id: 'f4-5',
      q: 'Seitwärtstag: drei kleine Stops und Breakevens. Was zeigen Lektion 6 und 9?',
      o: [
        'Geduld: der eine Trade in Gamma-Richtung bringt den Tag',
        'Aufhören, der Tag ist verloren',
        'Größe verdreifachen',
        'Gegen das Gamma handeln',
      ],
      e: 'Kleine Stops sind der Preis für den großen Läufer. In Lektion 9 kamen danach 16,5R.',
    },
  ],
  5: [
    {
      id: 'f5-1',
      q: 'Die Firma erlaubt 5.000 $ Tagesverlust. Was empfiehlt das Risiko-Protokoll als eigene Grenze?',
      o: ['1.000–1.500 $', '5.000 $', '4.900 $', '10.000 $'],
      e: 'Die Firmen-Grenze ist die Notbremse. Die eigene Grenze liegt weit darunter, damit Schlupf und Fehler Platz haben.',
    },
    {
      id: 'f5-2',
      q: 'Ein Trade liegt im Minus. Darfst du nachkaufen?',
      o: [
        'Nein, nie in einen Verlierer nachkaufen',
        'Ja, dann wird der Einstieg besser',
        'Ja, aber nur die halbe Größe',
        'Ja, wenn das Ziel weit weg ist',
      ],
      e: 'Größer wird nur, was schon im Plus ist. Neues Signal = neuer Trade, der alte Fehler wird nicht gerettet.',
    },
    {
      id: 'f5-3',
      q: 'Du hattest 2 Verluste in Folge. Was sagt das Protokoll?',
      o: [
        'Größe um 25–50 % runter',
        'Größe verdoppeln',
        'Sofort Schluss für die Woche',
        'Nichts ändern',
      ],
      e: 'Nach 2 Verlusten wird kleiner gehandelt. Nach dem dritten ist der Tag vorbei.',
    },
    {
      id: 'f5-4',
      q: '17 grüne und 4 rote Tage, Tages-Stop 400 $, Ziel Ø 300 $/Tag. Wie viel brauchst du pro grünem Tag?',
      o: ['≈ 394 $', '300 $', '400 $', '≈ 250 $'],
      e: '17 × 300 $ + 4 × 400 $ = 6.700 $. Geteilt durch 17 grüne Tage ≈ 394 $.',
    },
  ],
  6: [
    {
      id: 'f6-1',
      q: 'Prop-Modell im Test: Wann legt Fabio die Limit-Order?',
      o: [
        'Erst wenn die 40R-Kerze geschlossen ist',
        'Während die Kerze noch läuft',
        'Immer zur vollen Minute',
        'Sobald das Delta einmal grün ist',
      ],
      e: 'Die geschlossene Kerze setzt den Standard. Solange sie läuft, kann sich der Wertbereich noch verschieben.',
    },
    {
      id: 'f6-2',
      q: 'Tag 1 im Test: +3R, dann drei Stops in Folge. Was macht er?',
      o: [
        'Schluss für den Tag, er nimmt +1R mit',
        'Weiter, bis die 6R erreicht sind',
        'Größe verdoppeln',
        'Gegen den Trend handeln',
      ],
      e: 'Die Regel 3 Stops = Schluss gilt auch an einem guten Tag. Sie schützt den Gewinn.',
    },
    {
      id: 'f6-3',
      q: 'Weekly Profiling: Wo handelt er NICHT?',
      o: [
        'In der Mitte zwischen seinen Marken',
        'An der aggressiven Marke',
        'An der konservativen Marke',
        'In Trendrichtung',
      ],
      e: 'Er legt zwei Marken fest und wartet, bis der Preis eine davon erreicht. In der Mitte gibt es keinen Vorteil.',
    },
    {
      id: 'f6-4',
      q: 'Eine wichtige Nachricht ist gerade öffentlich geworden. Was sagt Fabio?',
      o: [
        'Zum Handeln ist es schon zu spät',
        'Sofort in Richtung der Schlagzeile handeln',
        'Doppelte Größe, weil es sicher ist',
        'Erst die Kommentare lesen',
      ],
      e: 'Die Großen bewegen sich nach Geldflüssen, lange bevor die Nachricht kommt. Er liest COT und Big Trades statt Schlagzeilen.',
    },
  ],
};
