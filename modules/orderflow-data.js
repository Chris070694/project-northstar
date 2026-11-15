/* Orderflow-Bootcamp — Inhalt fuer modules/orderflow.js.

   Generiert aus dem Orderflow-Handbuch (Claude Docs) und den Fragen des
   Orderflow-Trainers. Inline-Auszeichnung: **fett** und `code`. Alles hier ist
   fester Inhalt, keine Nutzereingabe — gerendert wird trotzdem ueber escapeHtml.

   Wichtig: Die Quiz-IDs ("1-3") sind die Schluessel des gespeicherten
   Fortschritts. Fragen nur anhaengen, nie umnummerieren. */

const ORDERFLOW_PARTS = [
  {
    id: 0,
    title: 'Vorwort',
    intro: [],
    lessons: [
      {
        id: '0.1',
        title: 'So nutzt du den Kurs',
        blocks: [
          {
            p: 'Dieser Kurs fasst alle 35 Lektionen des Orderflow-Bootcamps auf Deutsch zusammen, sortiert in 7 Teile. Du brauchst pro Lektion 3 bis 5 Minuten.',
          },
          {
            p: '**So ist jede Lektion aufgebaut:**',
          },
          {
            ul: [
              '**Was ist das?** Die Idee in 2 bis 3 Sätzen',
              '**Woran erkennst du es?** Was du am Chart siehst',
              '**Wie nutzt du es?** Was das für deinen Trade heißt',
              '**Merksatz:** Der eine Satz, den du dir merken sollst',
            ],
          },
          {
            p: '**So liest du es am besten:**',
          },
          {
            ol: [
              'Lies die Teile der Reihe nach. Jeder Teil baut auf dem vorherigen auf.',
              'Pro Abend reichen 2 bis 3 Lektionen.',
              'Am nächsten Handelstag suchst du genau das am MNQ-Chart. Erst wenn du es selbst gefunden hast, sitzt es.',
              'Am Ende jedes Teils wartet ein Quiz. Falsche Antworten sammelt „Fehler üben“.',
            ],
          },
          {
            p: '**Wichtig vorab:** Die Plattformen zeigen die Begriffe auf Englisch an. Darum steht hinter jedem deutschen Begriff die englische Abkürzung in Klammern, damit du sie am Chart wiederfindest. Ganz hinten gibt es ein Wörterbuch.',
          },
          {
            p: 'Alle Zeiten in diesem Kurs sind Wiener Zeit. Die Nasdaq-Hauptsitzung läuft von 15:30 bis 22:00 Uhr.',
          },
          {
            p: 'Der Kurs ist Lernstoff und keine Anlageberatung. Jedes Setup kann scheitern, darum gehört zu jedem Trade ein Stop.',
          },
        ],
      },
    ],
  },
  {
    id: 1,
    title: 'Grundlagen: Wie der Markt funktioniert',
    intro: [
      {
        p: 'Der Markt ist eine Auktion. Er sucht ständig den Preis, bei dem Käufer und Verkäufer am meisten handeln. Alles in diesem Kurs baut auf dieser einen Idee auf.',
      },
    ],
    lessons: [
      {
        id: '1.1',
        title: 'Auktionsmarkt-Theorie (Auction Market Theory, AMT)',
        blocks: [
          {
            p: '**Was ist das?** Der Preis pendelt um einen fairen Wert. Ist er zu teuer, fehlen Käufer und er fällt zurück. Ist er zu billig, kommen Käufer und drücken ihn hoch.',
          },
          {
            p: '**Woran erkennst du es?**',
          },
          {
            ul: [
              'Wo viel gehandelt wird, liegt der faire Wert. Beide Seiten sind sich dort einig.',
              'Wo kaum gehandelt wird, war der Preis nur kurz. Eine Seite hat ihn schnell abgelehnt.',
              'Im Trend wandert der faire Wert immer weiter zu neuen Preisen.',
            ],
          },
          {
            p: '**Wie nutzt du es?** Du fragst dich bei jedem Chart: Ist der Preis gerade teuer, fair oder billig? Teuer heißt eher verkaufen, billig eher kaufen, fair heißt abwarten.',
          },
          {
            merk: 'Der Preis sucht Handel. Wo kein Handel stattfindet, bleibt er nicht lange.',
          },
        ],
      },
      {
        id: '1.2',
        title: 'Volumenprofil (Volume Profile)',
        blocks: [
          {
            p: '**Was ist das?** Das Volumenprofil liegt seitlich am Chart. Es zeigt als Balken, wie viele Kontrakte auf jedem Preis gehandelt wurden.',
          },
          {
            p: '**Die drei wichtigsten Linien:**',
          },
          {
            ul: [
              '**Kontrollpunkt (POC, Point of Control):** der Preis mit dem meisten Volumen. Das ist der fairste Preis.',
              '**Wertbereich (Value Area, VA):** der Bereich, in dem ungefähr 70 % des Volumens gehandelt wurden.',
              '**Oberkante und Unterkante des Wertbereichs (VAH und VAL, Value Area High und Low):** die Grenzen dieses Bereichs.',
            ],
          },
          {
            img: 'bild01',
            cap: 'Ein ausgeglichenes Volumenprofil sieht aus wie eine Glocke. In der Mitte liegt der POC, außen die Grenzen des Wertbereichs.',
          },
          {
            p: '**Wie nutzt du es?** Innerhalb des Wertbereichs ist der Preis fair, dort passiert wenig. Interessant wird es an den Rändern VAH und VAL und außerhalb davon.',
          },
          {
            merk: 'Der POC ist der Magnet, VAH und VAL sind die Wände.',
          },
        ],
      },
      {
        id: '1.3',
        title: 'Marktprofil mit Zeit-Blöcken (TPO, Time Price Opportunity)',
        blocks: [
          {
            p: '**Was ist das?** Das TPO-Profil misst nicht Volumen, sondern **Zeit**. Für jede halbe Stunde, die der Preis auf einem Niveau war, kommt ein Kästchen dazu.',
          },
          {
            p: '**Die Bausteine:**',
          },
          {
            ul: [
              '**Buchstaben:** Jede halbe Stunde hat einen Buchstaben. A ist 15:30 bis 16:00 Uhr, B ist 16:00 bis 16:30 Uhr, und so weiter. So siehst du, *wann* der Preis wo war.',
              '**Anfangsbereich (IB, Initial Balance):** die Spanne der ersten Stunde, also A und B. Sie zeigt, wie der Tag startet.',
              '**Ausweitung (Range Extension):** wenn der Preis später über oder unter den Anfangsbereich läuft.',
              '**Zeit-Kontrollpunkt (TPOC):** der Preis, an dem der Markt am längsten war.',
              '**Wertbereich:** auch hier etwa 70 % der Zeit, mit VAH und VAL.',
              '**Einzelkästchen (Single Prints):** Stellen mit nur einem Kästchen. Dort ist der Preis schnell durchgelaufen, weil eine Seite stark eingestiegen ist.',
              '**Ausläufer (Tail):** mindestens 2 Einzelkästchen am oberen oder unteren Ende. Ein Tail zeigt eine klare Ablehnung des Preises.',
            ],
          },
          {
            img: 'bild02',
            cap: 'Ein TPO-Profil mit Buchstaben, Anfangsbereich, Tail und Einzelkästchen.',
          },
          {
            p: '**Zwei Arten von Aktivität:**',
          },
          {
            ul: [
              '**Antwortend (responsive):** Jemand kauft unter dem fairen Wert oder verkauft darüber. Das ist normales Hin und Her in der Seitwärtsphase.',
              '**Treibend (initiative):** Jemand kauft, obwohl der Preis schon über dem fairen Wert ist, oder verkauft, obwohl er schon drunter ist. Das ist Druck, der einen Trend startet.',
            ],
          },
          {
            p: '**Kennzahlen, die manche Plattformen anzeigen:**',
          },
          {
            ul: [
              '**ASPR:** wie viele Punkte eine halbe Stunde im Schnitt gelaufen ist',
              '**VolVAR und TPOVAR:** wie breit der Wertbereich nach Volumen und nach Zeit ist',
              '**Rotationsfaktor (RF):** hoher positiver Wert heißt, der Markt wollte hoch; hoher negativer Wert heißt, er wollte runter',
            ],
          },
          {
            merk: 'TPO zeigt, wo der Markt Zeit verbracht hat. Zeit bedeutet Annahme.',
          },
        ],
      },
      {
        id: '1.4',
        title: 'Warum Profile besser sind als Kerzen',
        blocks: [
          {
            p: '**Was ist das?** Eine Kerze zeigt nur Eröffnung, Hoch, Tief und Schluss. Du siehst nicht, wo innerhalb der Kerze gehandelt wurde.',
          },
          {
            img: 'bild03',
            cap: 'Dieselbe Kerze kann zwei völlig verschiedene Geschichten haben. Links wurde fast alles oben gehandelt, rechts fast alles unten.',
          },
          {
            p: '**Wie nutzt du es?** Ein Profil ordnet die Daten so, dass du auf einen Blick siehst: Welches Umfeld haben wir? Wo sind die wichtigen Zonen? Wie entwickelt sich der Tag?',
          },
          {
            merk: 'Die Kerze zeigt das Ergebnis, das Profil zeigt den Weg dahin.',
          },
        ],
      },
      {
        id: '1.5',
        title: 'Volumenprofil oder TPO?',
        blocks: [
          {
            p: 'Nimm beide. Sie sollen sich gegenseitig bestätigen.',
          },
          {
            ul: [
              'Das **Volumenprofil** zeigt, wo das meiste Geld geflossen ist.',
              'Das **TPO-Profil** zeigt, wo der Markt die meiste Zeit war. Es ist ruhiger, weil Volumenspitzen zur Eröffnung und zum Schluss es nicht verzerren.',
              'Liegen POC und TPOC nah beieinander, ist der faire Wert klar.',
              'Achte darauf, wo das Volumen an einem Niveau plötzlich zunimmt. Dort ändert sich gerade etwas.',
              'Achte auf Lücken, wo kaum Handel stattfand. Dort fehlt das Hin und Her.',
            ],
          },
          {
            merk: 'Volumen bestätigt den Preis. Ohne Volumen ist eine Bewegung schwach.',
          },
        ],
      },
      {
        id: '1.6',
        title: 'Annahme und Ablehnung (Acceptance und Rejection)',
        blocks: [
          {
            p: '**Was ist das?** Ein Preis ist **angenommen**, wenn beide Seiten dort handeln wollen. Dann baut sich dort Volumen und Zeit auf. Ein Preis ist **abgelehnt**, wenn der Markt sofort wieder wegläuft.',
          },
          {
            p: '**Woran erkennst du es?**',
          },
          {
            ul: [
              '**Annahme:** Der Preis bleibt mehrere Halbstunden außerhalb des alten Bereichs, und dort entsteht ein neues Profil.',
              '**Ablehnung:** lange Dochte, Tails und Einzelkästchen. Der Preis war kurz da und ist sofort zurück.',
            ],
          },
          {
            img: 'bild04',
            cap: 'Links Annahme: Der Preis bleibt oben und baut neuen Wert auf. Rechts Ablehnung: kurzer Ausflug nach oben, dann zurück in den alten Bereich.',
          },
          {
            p: '**Wie nutzt du es?** Bricht der Preis aus einem Bereich aus, wartest du ab. Wird der neue Preis angenommen, folgst du dem Ausbruch. Wird er abgelehnt, handelst du zurück in den alten Bereich.',
          },
          {
            merk: 'Ein Ausbruch zählt erst, wenn der neue Preis angenommen wird.',
          },
        ],
      },
    ],
  },
  {
    id: 2,
    title: 'Wichtige Kurszonen (Key Contextual Levels)',
    intro: [
      {
        p: 'Wichtige Kurszonen sind Preise, an denen sich etwas ändert, wenn der Markt sie gewinnt oder verliert. Dort steigt die Aktivität, und dort suchst du deine Trades.',
      },
    ],
    lessons: [
      {
        id: '2.1',
        title: 'Die Zonen im Überblick',
        blocks: [
          {
            ul: [
              '**Extreme der Marktstruktur:** Hochs und Tiefs der Range. Dort steigen die großen Teilnehmer ein. In der Mitte der Range handeln vor allem Kleinanleger.',
              '**Zone mit viel Volumen (HVN, High Volume Node):** dicker Bauch im Profil. Der Preis war dort lange. Kommt er zurück, wird er dort langsamer und pendelt.',
              '**Zone mit wenig Volumen (LVN, Low Volume Node):** dünne Stelle im Profil. Der Preis läuft dort schnell durch. LVNs wirken oft als Unterstützung oder Widerstand.',
              '**Kontrollpunkt (POC):** der fairste Preis der Struktur.',
              '**Offener Kontrollpunkt (Naked POC):** ein POC eines früheren Tages, den der Preis seitdem nicht mehr berührt hat. Er zieht den Preis oft an. Er ist aber schwächer als große Strukturen im höheren Zeitrahmen.',
              '**Einzelkästchen (Single Prints):** schnelle Durchläufe im TPO. Der Preis prallt dort eher ab, als dass er sie annimmt.',
            ],
          },
          {
            img: 'bild05',
            cap: 'Ein Profil mit allen Zonen: HVN, LVN, POC, offener POC vom Vortag und Einzelkästchen.',
          },
          {
            merk: 'Zwischen den HVNs ist der Markt schnell, an den HVNs ist er langsam.',
          },
        ],
      },
      {
        id: '2.2',
        title: 'Der Kontrollpunkt als Einstieg',
        blocks: [
          {
            p: '**Am POC selbst steigst du nicht ein.** Dort sind sich beide Seiten am meisten einig. Die Chance, dass der Preis von dort weit läuft, ist am kleinsten.',
          },
          {
            p: '**Besser so:**',
          },
          {
            ul: [
              'Der Preis ist deutlich über dem fairen Wert und du verkaufst, mit Ziel POC.',
              'Der Preis ist deutlich unter dem fairen Wert und du kaufst, mit Ziel POC.',
            ],
          },
          {
            p: '**Einstieg an Kurszonen:**',
          },
          {
            ul: [
              'Nur mit Limit-Order, also einer Order, die im Orderbuch auf deinen Preis wartet.',
              'Reagiert der Preis nicht sofort, steigst du aus.',
              'Ohne weitere Bestätigung sind das kurze Trades (Scalps).',
            ],
          },
          {
            merk: 'Der POC ist dein Ziel, nicht dein Einstieg.',
          },
        ],
      },
    ],
  },
  {
    id: 3,
    title: 'Das Marktumfeld bestimmen',
    intro: [
      {
        p: 'Bevor du einen Trade suchst, klärst du das Umfeld: Seitwärts oder Trend? Dasselbe Signal bedeutet in beiden Umfeldern etwas anderes.',
      },
    ],
    lessons: [
      {
        id: '3.1',
        title: 'Die Grundfrage',
        blocks: [
          {
            p: 'Stell dir bei jedem Chart drei Fragen:',
          },
          {
            ol: [
              'Sind wir in einer Seitwärtsphase oder in einem Trend?',
              'Hat eine Seite, Käufer oder Verkäufer, mehr Kontrolle?',
              'Was sagt der höhere Zeitrahmen dazu?',
            ],
          },
        ],
      },
      {
        id: '3.2',
        title: 'Seitwärtsphase (Balance, Range)',
        blocks: [
          {
            p: '**Woran erkennst du sie?**',
          },
          {
            ul: [
              'Das Profil ist gleichmäßig, fast symmetrisch.',
              'Die Wertbereiche der Tage überlappen sich.',
              'Der Preis kehrt immer wieder zum fairen Wert zurück.',
              'Käufer und Verkäufer sind ungefähr gleich stark.',
              'An den Hochs und Tiefs taucht eine Seite verstärkt auf und drückt den Preis zurück.',
            ],
          },
          {
            p: '**Wie nutzt du es?** Du handelst von den Rändern zur Mitte. Kaufen an der Unterkante, verkaufen an der Oberkante, Ziel POC.',
          },
          {
            merk: 'In der Seitwärtsphase verlierst du Geld, wenn du Ausbrüchen hinterherläufst.',
          },
        ],
      },
      {
        id: '3.3',
        title: 'Trend',
        blocks: [
          {
            p: '**Woran erkennst du ihn?**',
          },
          {
            ul: [
              'Das Profil ist länglich und unregelmäßig.',
              'Der Wertbereich wandert jeden Tag weiter in eine Richtung.',
              'Das Volumen steigt in Trendrichtung und sinkt bei Rücksetzern.',
              'Eine Seite ist klar stärker.',
            ],
          },
          {
            img: 'bild06',
            cap: 'Links Seitwärts: Die Wertbereiche der Tage überlappen sich. Rechts Trend: Jeder Tag baut seinen Wert höher als der Vortag.',
          },
          {
            p: '**Wechsel erkennen:** Ob Seitwärtsphase oder Trend weitergeht oder kippt, siehst du an drei Zeichen: Absorption (Teil 6), Schwung lässt nach, Volumen ändert sich.',
          },
        ],
      },
      {
        id: '3.4',
        title: 'Trends handeln',
        blocks: [
          {
            ul: [
              '**Umkehr-Trades** nur an den Extremen, nicht in der Mitte des Trends. In der Mitte wirst du leicht ausgestoppt.',
              '**Mitlaufen im Trend:** Einstieg an der Mitte des letzten Schubs oder an einem LVN. Der Stop liegt hinter dem letzten Tief (im Aufwärtstrend) oder Hoch (im Abwärtstrend).',
              'Beobachte den POC. Steigt er Tag für Tag, ist der Aufwärtstrend gesund.',
              '**Warnzeichen:** Der Tag schließt deutlich unter dem Wertbereich.',
            ],
          },
          {
            img: 'bild07',
            cap: 'Im Aufwärtstrend kaufst du den Rücksetzer an der dünnen Stelle (LVN). Der Stop liegt unter dem letzten Tief.',
          },
          {
            merk: 'Im Trend kaufst du Rücksetzer, nicht Hochs.',
          },
        ],
      },
      {
        id: '3.5',
        title: 'Wie sich Wert entwickelt (Developing Value)',
        blocks: [
          {
            ul: [
              'Ist das TPO-Profil eine Glocke, sind sich Käufer und Verkäufer einig.',
              'Im Trend wird der Wert ständig zu neuen Preisen verschoben, weil eine Seite die alten Preise nicht mehr akzeptiert.',
              '**Eröffnung prüfen:** Öffnet der Markt innerhalb des Wertbereichs vom Vortag oder außerhalb? Innerhalb erwartest du eher Seitwärts, außerhalb eher Bewegung. An VAH und VAL vom Vortag wartest du auf eine Reaktion.',
            ],
          },
          {
            merk: 'Wo beide Seiten sich am meisten einig sind, startest du deine Planung.',
          },
        ],
      },
      {
        id: '3.6',
        title: 'Tagestypen (Day Types)',
        blocks: [
          {
            p: 'Die Größe des Anfangsbereichs (IB) verrät viel über den Tag. **Kleiner IB heißt:** Es kommt wahrscheinlich eine starke Bewegung.',
          },
          {
            table: [
              ['Tagestyp', 'Anfangsbereich (IB)', 'Was passiert', 'Umfeld'],
              [
                'Kein-Trend-Tag (Non-Trend Day)',
                'sehr klein',
                'kaum Bewegung, oft vor Nachrichten',
                'seitwärts',
              ],
              [
                'Normaler Tag (Normal Day)',
                'sehr breit',
                'der Tag bleibt fast ganz im IB',
                'seitwärts',
              ],
              [
                'Normale Variation (Normal Variation)',
                'mittel',
                'Ausweitung auf eine Seite, bis etwa doppelte IB-Breite',
                'seitwärts',
              ],
              [
                'Neutraler Tag (Neutral Day)',
                'mittel',
                'Ausweitung auf beiden Seiten, Schluss oft in der Mitte',
                'seitwärts',
              ],
              [
                'Trendtag (Trend Day)',
                'klein',
                'läuft den ganzen Tag in eine Richtung, Schluss am Extrem',
                'Trend',
              ],
              [
                'Doppelverteilung (Double Distribution)',
                'klein',
                'erst ruhig, dann Sprung in einen neuen Bereich',
                'Trend',
              ],
            ],
          },
          {
            img: 'bild08',
            cap: 'Die sechs Tagestypen als Profil. Die ersten vier sind Seitwärtstage, die letzten zwei Trendtage.',
          },
          {
            merk: 'Nach der ersten Stunde weißt du schon viel über den ganzen Tag.',
          },
        ],
      },
      {
        id: '3.7',
        title: 'Zusammengesetzte Profile (Composites)',
        blocks: [
          {
            p: '**Was ist das?** Du fasst mehrere Tage zu einem Profil zusammen.',
          },
          {
            p: '**Wann?** Wenn der Markt nach einem Trend mehrere Tage im selben Bereich pendelt. Dann ist die ganze Phase eine große Seitwärtsphase mit einem gemeinsamen POC, VAH und VAL.',
          },
          {
            img: 'bild09',
            cap: 'Vier Tagesprofile in derselben Range ergeben zusammen ein großes, klares Profil.',
          },
          {
            merk: 'Mehrere Tage zusammen zeigen dir die große Balance, die einzelne Tage verstecken.',
          },
        ],
      },
      {
        id: '3.8',
        title: 'Die Karte zeichnen: von oben nach unten (Top-Down)',
        blocks: [
          {
            p: 'Vor jedem Handelstag zeichnest du die Karte. Du gehst vom großen zum kleinen Zeitrahmen: Woche, Tag, dann der Handelschart.',
          },
          {
            p: '**Was du einzeichnest:**',
          },
          {
            ul: [
              'Hochs und Tiefs der Marktstruktur',
              'HVNs und LVNs',
              'Auffälligkeiten wie Poor Highs, Ledges und Einzelkästchen (Teil 4)',
              'frühere Zonen mit starker Reaktion',
              'Wochenschluss und Tagesschluss',
            ],
          },
          {
            p: '**Was du dich fragst:**',
          },
          {
            ol: [
              'Wo entwickelt sich Wert?',
              'Wo wird der Preis angenommen, wo abgelehnt?',
              'Seitwärts oder Trend?',
              'Welche Trades bieten sich an?',
              'Wo treffen mehrere Gründe zusammen (Konfluenz)?',
            ],
          },
          {
            p: '**Beispiel aus dem Kurs:** Im Wochenchart lagen Einzelkästchen genau auf Höhe des Wochenschlusses. Zwei Gründe auf einem Preis machen daraus einen starken Widerstand.',
          },
          {
            merk: 'Je mehr Gründe auf einem Preis zusammenkommen, desto stärker ist die Zone.',
          },
        ],
      },
    ],
  },
  {
    id: 4,
    title: 'Auffälligkeiten im Profil (Anomalies)',
    intro: [
      {
        p: 'Ein gesundes Profil ist gleichmäßig wie eine Glocke. Auffälligkeiten sind Stellen, die nicht dazu passen. Der Markt kommt oft zurück, um sie zu „reparieren“. Genau das macht sie zu guten Zielen.',
      },
    ],
    lessons: [
      {
        id: '4.1',
        title: 'Was ein gesundes Profil hat',
        blocks: [
          {
            ul: [
              'einen gleichmäßig verteilten Wertbereich',
              'Preis und Volumen bestätigen sich gegenseitig',
              '**ein gutes Käufer-Tail unten:** Käufer haben die tiefen Preise klar abgelehnt',
              '**ein gutes Verkäufer-Tail oben:** Verkäufer haben die hohen Preise klar abgelehnt',
            ],
          },
          {
            p: 'Je länger das Tail, desto stärker war die Ablehnung.',
          },
        ],
      },
      {
        id: '4.2',
        title: 'Schwache Hochs und Tiefs (Poor High, Poor Low)',
        blocks: [
          {
            p: '**Was ist das?** Ein Hoch oder Tief ohne richtiges Tail. Das Profil hört dort flach auf, wie abgeschnitten.',
          },
          {
            p: '**Woran erkennst du es?**',
          },
          {
            ul: [
              'Am Ende stehen 2 oder mehr Kästchen breit nebeneinander, statt sich zu einer Spitze zu verjüngen.',
              'Oder zwei Tage hintereinander haben fast das gleiche Hoch oder Tief.',
            ],
          },
          {
            img: 'bild10',
            cap: 'Links ein gutes Tief mit langem Tail: Käufer haben klar abgelehnt. Rechts ein schwaches Tief: flach abgeschnitten, die Auktion ist nicht fertig.',
          },
          {
            p: '**Was bedeutet es?** Der Markt hat dort nicht gedreht, weil eine Seite stark abgelehnt hat. Ihm ist nur die Puste ausgegangen. Die Auktion ist unvollständig. Oft kommt der Preis später zurück, um sie abzuschließen.',
          },
          {
            p: '**Wie nutzt du es?**',
          },
          {
            ul: [
              'Schwache Hochs und Tiefs sind gute **Ziele** für deine Trades.',
              'Dahinter liegen viele Stops. Darum werden sie gern abgefischt (Stop Run).',
              'Im Trend heißt ein schwaches Extrem: Der Markt hat noch keine starke Gegenseite gefunden. Der Trend sucht weiter.',
              'Gibt es oben und unten eines, frag dich: Welches wird zuerst repariert? Meist das in Trendrichtung.',
            ],
          },
          {
            merk: 'Ein schwaches Hoch ist eine offene Rechnung. Der Markt kommt sie meistens bezahlen.',
          },
        ],
      },
      {
        id: '4.3',
        title: 'Kanten im Profil (Ledges)',
        blocks: [
          {
            p: '**Was ist das?** Eine Stelle, an der der Handel mehrmals abrupt abgebrochen ist. Das Profil hat dort eine gerade Kante statt einer runden Form.',
          },
          {
            p: '**Woran erkennst du es?** Der Preis testet denselben Preis mehrmals, kommt aber nicht durch. Das Profil sieht an dieser Seite wie abgeschnitten aus.',
          },
          {
            img: 'bild11',
            cap: 'Eine Ledge: Das Profil endet oben mehrmals an derselben Linie. Darüber warten Stops.',
          },
          {
            p: '**Wie nutzt du es?**',
          },
          {
            ul: [
              'Hinter der Kante sammeln sich Stops.',
              'Bricht der Preis durch, lösen die Stops aus und geben dem Ausbruch Extra-Schub.',
            ],
          },
          {
            merk: 'Eine Kante, die oft getestet wurde, bricht irgendwann, und dann schnell.',
          },
        ],
      },
    ],
  },
  {
    id: 5,
    title: 'Footprint und Delta: In die Kerze hineinschauen',
    intro: [
      {
        p: 'In diesem Teil geht es um den eigentlichen Orderflow. Du siehst, wer gerade aggressiv kauft oder verkauft, und wer dagegenhält.',
      },
    ],
    lessons: [
      {
        id: '5.1',
        title: 'Passive und aktive Orders',
        blocks: [
          {
            p: 'Jeder Trade braucht zwei Seiten: eine, die wartet, und eine, die zugreift.',
          },
          {
            table: [
              ['', 'Passiv (wartet)', 'Aktiv (greift zu)'],
              ['Ordertyp', 'Limit-Order im Orderbuch', 'Market-Order'],
              ['Rolle', 'stellt Liquidität bereit (Maker)', 'nimmt Liquidität weg (Taker)'],
              ['Wer meistens?', 'große Teilnehmer', 'kleinere Teilnehmer, mit Ausnahmen'],
              [
                'Wirkung',
                'bremst, viele Limits = wenig Schwankung',
                'bewegt den Preis, viele Market-Orders = mehr Schwankung',
              ],
              ['Stärke', 'oft die „schwerere Hand“', 'oft die „schwächere Hand“'],
              ['Geduld', 'geduldig', 'ungeduldig'],
            ],
          },
          {
            img: 'bild12',
            cap: 'Das Orderbuch (DOM, Depth of Market): Links warten die Kauf-Limits, rechts die Verkaufs-Limits. Eine Market-Order frisst sich durch diese Limits.',
          },
          {
            p: '**Vorsicht, Täuschung (Spoofing):** Manche stellen große sichtbare Limits ins Buch, ohne sie ausführen zu wollen. Kurz bevor der Preis sie erreicht, löschen sie sie wieder. Das ist in regulierten Märkten verboten, kommt aber vor. Vertrau darum nicht blind auf große Zahlen im Orderbuch.',
          },
          {
            merk: 'Aktive Orders bewegen den Preis, passive Orders bestimmen, wo er stoppt.',
          },
        ],
      },
      {
        id: '5.2',
        title: 'Footprint-Chart Grundlagen',
        blocks: [
          {
            p: '**Was ist das?** Ein Footprint zeigt dir das Innenleben jeder Kerze. Auf jedem Preis steht, wie viel dort aggressiv verkauft und gekauft wurde. Das geht bis auf einen einzigen Tick genau.',
          },
          {
            p: '**So liest du eine Zeile:** `Verkäufe x Käufe`, auf Englisch `Bid x Ask`.',
          },
          {
            ul: [
              '**Linke Zahl (Bid):** Market-Sell-Orders. Aggressive Verkäufer haben in die wartenden Kauf-Limits verkauft.',
              '**Rechte Zahl (Ask):** Market-Buy-Orders. Aggressive Käufer haben die wartenden Verkaufs-Limits gekauft.',
            ],
          },
          {
            img: 'bild13',
            cap: 'Eine Footprint-Kerze: Links stehen die aggressiven Verkäufe, rechts die aggressiven Käufe. Der dicke Rahmen markiert den Preis mit dem meisten Volumen.',
          },
          {
            p: '**Was dir der Footprint verrät:**',
          },
          {
            ul: [
              'wo Käufer und wo Verkäufer interessiert waren',
              'wo Absorption stattfand',
              'wo das meiste Volumen lag',
              'wo Ungleichgewichte entstanden sind',
            ],
          },
          {
            p: '**Ein Irrtum, den der Footprint aufklärt:** Ein langer Docht oben gilt als schwach. Liegt aber das meiste Volumen genau oben im Docht, haben dort viele gehandelt. Dieser Preis wird beim nächsten Besuch oft zum Widerstand. Viele, die dort gekauft haben, steigen bei der Rückkehr aus.',
          },
          {
            merk: 'Handle nach Fakten im Footprint, nicht nach dem Gefühl, das eine Kerze dir macht.',
          },
        ],
      },
      {
        id: '5.3',
        title: 'Ungleichgewichte (Imbalances)',
        blocks: [
          {
            p: '**Was ist das?** Eine Seite war auf einem Preis viel aggressiver als die andere, meist 3- bis 4-mal so stark. Die Einstellung findest du auf deiner Plattform, oft 300 %.',
          },
          {
            p: '**Wichtig: Du vergleichst schräg (diagonal), nicht waagrecht.**',
          },
          {
            ul: [
              '**Kauf-Ungleichgewicht:** Käufe (Ask) auf einem Preis gegen Verkäufe (Bid) einen Tick **darunter**. Ist die rechte Zahl mindestens 3-mal so groß, wird sie meist grün markiert.',
              '**Verkaufs-Ungleichgewicht:** Verkäufe (Bid) auf einem Preis gegen Käufe (Ask) einen Tick **darüber**. Ist die linke Zahl mindestens 3-mal so groß, wird sie meist rot markiert.',
            ],
          },
          {
            img: 'bild14',
            cap: 'So vergleichst du schräg: 180 Käufe oben rechts gegen 45 Verkäufe einen Tick tiefer links. Das ist 4-mal so viel, also ein Kauf-Ungleichgewicht.',
          },
          {
            p: '**Gestapelte Ungleichgewichte (Stacked Imbalances):** 3 oder mehr Ungleichgewichte direkt übereinander. Sie bilden oft eine starke Unterstützung oder einen starken Widerstand, wenn der Preis zurückkommt.',
          },
          {
            merk: 'Ein Ungleichgewicht ist ein Ausrufezeichen. Drei übereinander sind eine Zone.',
          },
        ],
      },
      {
        id: '5.4',
        title: 'Delta',
        blocks: [
          {
            p: '**Was ist das?** Delta = aggressive Käufe minus aggressive Verkäufe in einer Kerze. Also nur die Market-Orders.',
          },
          {
            ul: [
              '**Positives Delta:** Käufer greifen aggressiv zu.',
              '**Negatives Delta:** Verkäufer drücken aggressiv.',
            ],
          },
          {
            p: '**Wichtig:** Eine Kerze kann trotz negativem Delta grün schließen. Dann haben passive Kauf-Limits alle aggressiven Verkäufe aufgefangen. Das ist ein Hinweis auf Absorption (Teil 6).',
          },
          {
            p: '**Wie nutzt du es?** Trends und wichtige Zonen sollten vom Delta bestätigt werden. Steigt der Preis mit positivem Delta, passt alles. Steigt er mit negativem Delta, stimmt etwas nicht.',
          },
          {
            merk: 'Delta zeigt den Druck. Der Preis zeigt, ob der Druck etwas bringt.',
          },
        ],
      },
      {
        id: '5.5',
        title: 'Kumuliertes Delta (CVD, Cumulative Volume Delta)',
        blocks: [
          {
            p: '**Was ist das?** Das CVD zählt alle Deltas fortlaufend zusammen. Es zeigt dir die Anstrengung und Absicht über längere Zeit.',
          },
          {
            p: '**Die wichtigste Frage:** Passt das CVD zum Preis?',
          },
          {
            ul: [
              'Preis steigt, CVD steigt: Käufer arbeiten und kommen voran. Gesund.',
              '**Preis macht ein höheres Hoch, CVD macht ein tieferes Hoch:** Divergenz. Die Käufer werden schwächer.',
              '**CVD steigt stark, Preis kommt nicht voran:** viel Anstrengung, kein Ergebnis. Jemand hält passiv dagegen.',
            ],
          },
          {
            img: 'bild15',
            cap: 'Eine Divergenz: Der Preis macht ein neues Hoch, das CVD aber nicht. Die aggressiven Käufer gehen aus.',
          },
          {
            p: '**Das CVD beantwortet dir vier Fragen:**',
          },
          {
            ol: [
              'Wohin will der Markt?',
              'Kommt er dort gut hin?',
              'Wo gibt es Reibung?',
              'Wo ist viel Anstrengung ohne Ergebnis?',
            ],
          },
          {
            merk: 'Anstrengung ohne Ergebnis ist das stärkste Warnsignal im Orderflow.',
          },
        ],
      },
    ],
  },
  {
    id: 6,
    title: 'Das Verhalten der Trader lesen',
    intro: [
      {
        p: 'Jetzt setzt du Teil 1 bis 5 zusammen. Du liest nicht mehr nur Zahlen, sondern erkennst, welche Seite gerade gewinnt, aufgibt oder in der Falle sitzt.',
      },
    ],
    lessons: [
      {
        id: '6.1',
        title: 'Absorption, Auktion und Erschöpfung',
        blocks: [
          {
            p: 'Diese drei Begriffe beschreiben, wie eine Bewegung lebt und stirbt.',
          },
          {
            p: '**Absorption: Eine Seite hält dagegen.** Eine Seite versucht den Preis weiterzudrücken, die andere fängt alles mit passiven Limits auf. Der Preis kommt nicht weiter, obwohl viel Druck da ist.',
          },
          {
            p: 'Woran erkennst du Absorption?',
          },
          {
            ul: [
              'viel Volumen und starkes Delta auf einem Preis, aber der Preis bewegt sich nicht weiter',
              'Delta-Divergenz: Delta stark negativ, aber kein neues Tief',
              'zuerst antwortende Aktivität, danach treibende Aktivität in die Gegenrichtung',
            ],
          },
          {
            img: 'bild16',
            cap: 'Absorption am Tief: Verkäufer werfen über 3.000 Kontrakte auf denselben Preis, aber der Preis fällt nicht weiter. Passive Käufer haben alles aufgefangen.',
          },
          {
            p: '**Auktion: das normale Hin und Her.** Käufer und Verkäufer handeln zwischen den Zonen.',
          },
          {
            p: '**Erschöpfung: Eine Seite gibt auf.** Nach einem starken Schub kommt niemand mehr nach.',
          },
          {
            p: 'Woran erkennst du Erschöpfung?',
          },
          {
            ul: [
              'ein übertriebener Ausschlag nach oben oder unten (Blow-off)',
              'am Ende der Bewegung kaum noch Zahlen im Footprint, also dünne Prints',
              'viele Ungleichgewichte auf der aggressiven Seite, aber kein Hin und Her mehr',
            ],
          },
          {
            img: 'bild17',
            cap: 'Erschöpfung am Hoch: Die Zahlen werden nach oben immer kleiner, bis ganz oben nur noch 2 und 0 stehen. Die Käufer sind leer.',
          },
          {
            p: '**Wie nutzt du es?** Wenn du gegen die letzte Bewegung handeln willst, suchst du zuerst Absorption oder Erschöpfung. Ohne eins davon ist ein Gegen-Trade ein Ratespiel.',
          },
          {
            merk: 'Absorption heißt „da hält jemand dagegen“, Erschöpfung heißt „da kommt keiner mehr“.',
          },
        ],
      },
      {
        id: '6.2',
        title: 'Gefangene Trader (Trapped Traders)',
        blocks: [
          {
            p: '**Was ist das?** Trader, die auf der falschen Seite einer Bewegung sitzen. Meist sind es die, die einen Ausbruch erzwingen wollten und zu spät eingestiegen sind.',
          },
          {
            p: '**So erkennst du die Falle, Schritt für Schritt:**',
          },
          {
            ol: [
              'Der Preis kommt in eine Zone, die schon früher abgewiesen hat.',
              'Der Preis bricht durch.',
              'Beim Durchbruch springt das Volumen stark an, deutlich mehr als in den Kerzen davor.',
              'Dieses Volumen liegt am äußersten Ende der Bewegung.',
              'Der Ausbruch scheitert, und das Delta dreht auf die andere Seite.',
              'Der Preis erobert die gebrochene Zone zurück.',
            ],
          },
          {
            img: 'bild18',
            cap: 'Gefangene Verkäufer: Sie verkaufen den Bruch unter die Zone mit viel Volumen. Der Preis kommt sofort zurück, und sie müssen teuer zurückkaufen.',
          },
          {
            p: '**Kerzenformen im Footprint:**',
          },
          {
            ul: [
              '**b-Form:** Das Volumen sitzt unten in der Kerze, wie der Bauch beim Buchstaben b. Zeigt Verkäufer.',
              '**P-Form:** Das Volumen sitzt oben in der Kerze, wie beim Buchstaben P. Zeigt Käufer.',
              'Werden die b-Kerzen weniger und die P-Kerzen mehr, wechselt die Kontrolle zu den Käufern.',
            ],
          },
          {
            p: '**Wie nutzt du es?** Gefangene Trader an einer wichtigen Zone, dazu ein Wechsel im Delta: Das ist ein gutes Signal für einen Gegen-Trade. Ihre Stops geben dir zusätzlichen Schub.',
          },
          {
            merk: 'Wer zu spät kommt, wird zum Treibstoff für die Gegenbewegung.',
          },
        ],
      },
      {
        id: '6.3',
        title: 'Schwung (Momentum)',
        blocks: [
          {
            p: '**Die Falle:** Viele Trader verkaufen jeden Anstieg und kaufen jeden Fall. Das ist gefährlich, weil sie den Schwung im Markt übersehen und ihn sogar verstärken.',
          },
          {
            p: '**Typischer Ablauf:**',
          },
          {
            ol: [
              'Der Markt steigt mit viel Volumen und starker Beteiligung.',
              'Eine Range bildet sich, das sieht nach einem Top aus. Das letzte Tief der Struktur hält aber.',
              'Die alte Zone mit viel Volumen hält als Unterstützung.',
              'Im Footprint siehst du stark negatives Delta, Leute verkaufen aggressiv.',
              'Leerverkäufer bauen Positionen auf. Der Preis steigt trotzdem weiter. Die gefangenen Verkäufer werden zum Treibstoff.',
            ],
          },
          {
            p: '**Frag dich nach dem Ausbruch:**',
          },
          {
            ul: [
              'Will ein Verkäufer wirklich nochmal an dem Preis verkaufen, an dem er gerade ausgestoppt wurde?',
              'Will ein Market Maker sich dem Schwung in den Weg stellen? Er würde nur Geld verlieren.',
            ],
          },
          {
            merk: 'Gegen einen Markt mit Schwung handelst du erst, wenn das letzte Tief der Struktur bricht.',
          },
        ],
      },
      {
        id: '6.4',
        title: 'Positionierung (Positioning)',
        blocks: [
          {
            p: '**Was ist das?** Die Frage, auf welcher Seite der Markt überladen ist. Zu viele Trader in einer Richtung, mit zu viel Hebel.',
          },
          {
            ul: [
              'Im Future gibt es immer genau so viele Long- wie Short-Positionen, 1 zu 1. Entscheidend ist, welche Seite **aggressiver** ist.',
              '**Auf dem falschen Fuß erwischt (Offside):** Eine Seite drückt aggressiv durch eine Zone und verliert die Zone dann wieder. Jetzt muss sie raus.',
            ],
          },
          {
            p: '**Wo du die Positionierung siehst:**',
          },
          {
            table: [
              ['Zeitrahmen', 'Werkzeuge'],
              [
                'Höher (Tage, Wochen)',
                'COT-Bericht (Commitment of Traders), Optionsdaten wie Skew und GEX, bei Krypto auch Funding und Basis',
              ],
              ['Tiefer (intraday)', 'Delta, CVD, Volumenprofil, VWAP'],
            ],
          },
          {
            merk: 'Je voller eine Seite ist, desto heftiger wird es, wenn sie raus muss.',
          },
        ],
      },
      {
        id: '6.5',
        title: 'Liquiditätszonen (Liquidity Pools)',
        blocks: [
          {
            p: '**Was ist das?** Zonen, an denen viele Orders warten, Stops und Einstiegs-Orders. Sobald der Preis hinkommt, werden viele Teilnehmer gleichzeitig aktiv.',
          },
          {
            p: '**Wo liegen sie?**',
          },
          {
            ul: [
              'Swing-Hochs und Swing-Tiefs',
              'gleiche Hochs oder gleiche Tiefs (Equal Highs, Equal Lows)',
              'Tages- und Wochenhochs und -tiefs',
              'wichtige Strukturpunkte, hinter denen Trendfolger ihre Stops haben',
            ],
          },
          {
            img: 'bild19',
            cap: 'Über zwei gleichen Hochs sammeln sich Stops der Leerverkäufer und Kauf-Orders der Ausbruchskäufer. Ein idealer Ort für große Teilnehmer, um zu verkaufen.',
          },
          {
            p: '**Warum sind sie wichtig?** Große Teilnehmer brauchen viel Liquidität, um ihre Positionen zu füllen. Sie finden sie genau dort, wo die anderen ihre Stops haben. Darum laufen Kurse so oft kurz über ein Hoch und drehen dann.',
          },
          {
            p: '**Für dich heißt das:**',
          },
          {
            ul: [
              'Leg deinen Einstieg dorthin, wo andere ihre Stops haben.',
              'Leg deinen eigenen Stop **nicht** genau auf das offensichtliche Hoch oder Tief, sondern mit Abstand dahinter.',
            ],
          },
          {
            merk: 'Ein offensichtliches Hoch ist kein Widerstand, sondern ein Ziel.',
          },
        ],
      },
    ],
  },
  {
    id: 7,
    title: 'Die Setups',
    intro: [
      {
        p: 'Hier wird alles zu konkreten Trades. Jedes Setup braucht das passende Umfeld aus Teil 3 und eine Bestätigung aus dem Orderflow (Teil 5 und 6). Ohne beides kein Trade.',
      },
    ],
    lessons: [
      {
        id: '7.1',
        title: 'Ausbruch aus der Seitwärtsphase (Break from Balance)',
        blocks: [
          {
            p: '**Die Idee:** Nach mehreren ruhigen Tagen in derselben Range staut sich Energie. Bricht die Range, kommt oft eine starke Bewegung.',
          },
          {
            p: '**Die besten Bedingungen:**',
          },
          {
            ul: [
              'mehrere Innentage hintereinander (Inside Days): Die Spanne des Tages liegt komplett in der Spanne des Vortags',
              'Wertbereiche, die sich überlappen',
              'ein zusammengesetztes Profil (Composite) über die ganze Range',
            ],
          },
          {
            p: '**Was du vor dem Bruch prüfst, Beispiel Ausbruch nach unten:**',
          },
          {
            ul: [
              'Ist die Absorption auf einer Seite deutlicher?',
              'Was macht das CVD?',
              'Bieten Verkäufer immer tiefer an und drücken aktiv?',
              'Antworten Käufer zwar am Tief, kaufen aber danach nicht nach? Dann fehlt treibendes Kaufen.',
            ],
          },
          {
            p: '**Bestätigung beim Bruch:**',
          },
          {
            ul: [
              'Das Volumen steigt beim Durchbruch deutlich. Das siehst du im Footprint oder schon im 1-Minuten-Chart.',
              'Die Gegenseite reagiert nicht sofort.',
            ],
          },
          {
            img: 'bild20',
            cap: 'Ausbruch nach unten: Die Range bricht mit viel Volumen. Der Preis kommt bis etwa zur Hälfte zurück, dort wartet deine Limit-Order. Der Stop liegt über dem POC der Range.',
          },
          {
            p: '**Einstieg, Stop und Ziel:**',
          },
          {
            ul: [
              '**Einstieg:** Bei gutem Chance-Risiko-Verhältnis direkt mit Market-Order. Sonst wartest du: Meist kommt der Preis mindestens bis zur Hälfte zur Bruchstelle zurück, dort füllt eine Limit-Order.',
              '**Stop:** über dem POC oder der VAH der Range (beim Short). Beim Long spiegelverkehrt.',
              '**Ausstieg:** Ungleichgewichte im Footprint helfen dir, die Ausstiegspunkte festzulegen.',
            ],
          },
          {
            p: '**Gegenbeispiel, der neutrale Tag:** Treibende Aktivität an beiden Enden, sehr ausgeglichenes Profil, IB normal breit und mittig. Hier ist ein Ausbruch unwahrscheinlich. Handle lieber zurück in die Mitte.',
          },
          {
            merk: 'Je länger die Balance, desto stärker der Ausbruch. Aber nur mit Volumen.',
          },
        ],
      },
      {
        id: '7.2',
        title: 'Umkehr nach Doppelverteilung (Double Distribution Reversal)',
        blocks: [
          {
            p: '**Die Ausgangslage:** Ein Doppelverteilungs-Tag. Erst ist der Markt ruhig mit sehr kleinem IB. Dann springt er plötzlich in einen neuen Bereich, oft wegen Nachrichten. Zwischen den beiden Profilen liegen Einzelkästchen.',
          },
          {
            p: '**Die Idee:** Die meisten nehmen an, dass es nach so einem Sprung einfach weitergeht. Doch der Tag hatte wenig Überzeugung. Die kleine Basis ist leicht zu überrennen, auch in die Gegenrichtung.',
          },
          {
            p: '**Worauf du achtest, Beispiel nach starkem Fall:**',
          },
          {
            ol: [
              'Es wird aggressiv verkauft, aber passive Käufer fangen es auf (Absorption).',
              'Die Beteiligung wechselt: weniger aggressive Verkäufer, mehr aggressive Käufer.',
              'Im Volumen- oder Delta-Profil der Kerzen sitzt der Druck oben in der Kerze, also bei den Käufern.',
            ],
          },
          {
            img: 'bild21',
            cap: 'Doppelverteilung nach unten: oben das alte Profil, unten das neue, dazwischen Einzelkästchen. Dreht das Delta unten ins Plus, ist das Ziel die Lücke oben.',
          },
          {
            p: '**Einstieg, Stop und Ziel:**',
          },
          {
            ul: [
              '**Einstieg:** nach dem Wechsel im Delta',
              '**Stop:** unter dem Tief der unteren Verteilung',
              '**Ziel:** die Einzelkästchen und die obere Verteilung',
            ],
          },
          {
            merk: 'Was schnell und ohne Überzeugung gekommen ist, kann genauso schnell zurückgehen.',
          },
        ],
      },
      {
        id: '7.3',
        title: 'Die 80%-Regel (80% Rule)',
        blocks: [
          {
            p: '**Die Regel:** Der Markt öffnet außerhalb des Wertbereichs vom Vortag. Dann läuft er zurück hinein und bleibt **2 Halbstunden hintereinander** drin. Dann läuft er häufig durch den ganzen Wertbereich bis zur anderen Seite.',
          },
          {
            ul: [
              'Öffnung über dem Wertbereich, Rückkehr hinein: Ziel ist die VAL vom Vortag.',
              'Öffnung unter dem Wertbereich, Rückkehr hinein: Ziel ist die VAH vom Vortag.',
            ],
          },
          {
            p: 'Der Name kommt daher, dass das in früheren Auswertungen in etwa 80 % der Fälle geklappt hat. Verlass dich nicht blind auf die Zahl.',
          },
          {
            p: '**Warum funktioniert das?** Der Markt hat versucht, außerhalb Wert aufzubauen, und ist gescheitert. Das ist eine gescheiterte Auktion, und der Preis geht zurück auf die andere Seite.',
          },
          {
            img: 'bild22',
            cap: 'Die 80%-Regel: Öffnung über der VAH. Die Halbstunden C und D schließen im Wertbereich, danach läuft der Preis zur VAL.',
          },
          {
            p: '**Bei MNQ:** Du nimmst die Eröffnung der Hauptsitzung um 15:30 Uhr. Bei Krypto gibt es keine Eröffnungslücke, dort zählt ein Tagesschluss außerhalb des Wertbereichs als Öffnung außerhalb.',
          },
          {
            p: '**Prüf das Umfeld:**',
          },
          {
            ul: [
              'Sind wir in einer Seitwärtsphase mit Hin und Her? Dann passt das Setup.',
              'Was sagt das Delta über dem alten Wertbereich?',
              'Lässt der Schwung nach?',
              'Gibt es Absorption?',
            ],
          },
          {
            p: '**Stop:** außerhalb des Wertbereichs, über dem Hoch der Eröffnung (beim Short).',
          },
          {
            merk: 'Gescheitert außerhalb heißt zurück auf die andere Seite.',
          },
        ],
      },
      {
        id: '7.4',
        title: 'Gescheiterter Ausbruch (SFP, Swing Failure Pattern)',
        blocks: [
          {
            p: '**Was ist das?** Der Markt bricht über ein wichtiges Hoch oder unter ein wichtiges Tief. Dann dreht er und schließt wieder auf der anderen Seite des Niveaus.',
          },
          {
            p: '**Warum passiert das?** Wichtige Hochs und Tiefs sind Liquiditätszonen (6.5). Dort liegen Stops und Ausbruchs-Orders. Große Teilnehmer nutzen diese Liquidität, um selbst in die Gegenrichtung einzusteigen. Die Ausbrecher sitzen danach in der Falle.',
          },
          {
            p: '**Was das Delta zeigen soll:**',
          },
          {
            ul: [
              '**SFP am Hoch:** positives Delta, aggressives Kaufen durch das Hoch. Die Käufer werden danach gefangen.',
              '**SFP am Tief:** negatives Delta, aggressives Verkaufen durch das Tief. Die Verkäufer werden danach gefangen.',
            ],
          },
          {
            img: 'bild23',
            cap: 'SFP am Hoch: Der Preis sticht über das alte Hoch, schließt aber darunter. Dort entsteht dein Short.',
          },
          {
            p: '**Einstieg, Stop und Ziel:**',
          },
          {
            ul: [
              '**Einstieg:** wenn die Kerze wieder unter dem alten Hoch schließt',
              '**Stop:** über der Spitze des Ausbruchs',
              '**Ziel:** POC der Range oder die andere Seite der Range',
            ],
          },
          {
            p: '**Wichtig:**',
          },
          {
            ul: [
              'Das Hoch oder Tief muss in der aktuellen Struktur wirklich wichtig sein.',
              'Ein SFP im kleinen Zeitrahmen zählt weniger.',
              'Prüf, ob der große Trend für oder gegen deinen Trade läuft.',
            ],
          },
          {
            merk: 'Ein Ausbruch, der sofort scheitert, ist oft das stärkste Signal in die Gegenrichtung.',
          },
        ],
      },
    ],
  },
  {
    id: 8,
    title: 'Checkliste',
    intro: [],
    lessons: [
      {
        id: '8.1',
        title: 'Checkliste vor jedem Trade',
        blocks: [
          {
            p: 'Geh diese Liste vor jedem Trade durch. Kannst du einen Punkt nicht beantworten, lässt du den Trade aus.',
          },
          {
            p: '**Vor der Eröffnung (bis 15:30 Uhr):**',
          },
          {
            ol: [
              'Karte gezeichnet? Wochen- und Tageszonen, POC, VAH, VAL vom Vortag, offene POCs, schwache Hochs und Tiefs, Einzelkästchen.',
              'Umfeld bestimmt? Seitwärts oder Trend, im Tages- und im Wochenchart.',
              'Wo liegen die Liquiditätszonen? Gleiche Hochs und Tiefs, Swing-Punkte.',
            ],
          },
          {
            p: '**Nach der ersten Stunde (ab 16:30 Uhr):**',
          },
          {
            ol: [
              'Eröffnung innerhalb oder außerhalb des Wertbereichs vom Vortag?',
              'Wie breit ist der Anfangsbereich (IB)? Klein heißt Bewegung, breit heißt Seitwärts.',
              'Welcher Tagestyp zeichnet sich ab?',
            ],
            start: 4,
          },
          {
            p: '**Vor dem Einstieg:**',
          },
          {
            ol: [
              'Welches Setup ist es? Ausbruch, Doppelverteilung, 80%-Regel oder SFP.',
              'Ist der Preis an einer wichtigen Zone und nicht mitten im Nirgendwo?',
              'Was sagt der Orderflow? Absorption, Erschöpfung, gefangene Trader, Wechsel im Delta.',
              'Passt das CVD zum Preis, oder gibt es eine Divergenz?',
              'Treffen mindestens 2 Gründe zusammen?',
            ],
            start: 7,
          },
          {
            p: '**Der Trade:**',
          },
          {
            ol: [
              'Wo ist der Stop? Hinter der Zone, nicht genau auf dem offensichtlichen Hoch oder Tief.',
              'Wo ist das Ziel? POC, andere Seite des Wertbereichs, schwaches Hoch oder Tief, offener POC.',
              'Ist das Ziel mindestens doppelt so weit weg wie der Stop?',
            ],
            start: 12,
          },
          {
            merk: 'Kein Umfeld, keine Zone, keine Bestätigung, kein Trade.',
          },
        ],
      },
    ],
  },
  {
    id: 9,
    title: 'Wörterbuch',
    intro: [],
    lessons: [
      {
        id: '9.1',
        title: 'Englisch – Deutsch',
        blocks: [
          {
            p: 'So heißen die Begriffe auf deiner Plattform, und das bedeuten sie.',
          },
          {
            table: [
              ['Englisch', 'Deutsch', 'Kurz erklärt'],
              ['Absorption', 'Auffangen', 'passive Orders halten aggressiven Druck auf'],
              ['Acceptance', 'Annahme', 'Preis bleibt, Volumen und Zeit bauen sich auf'],
              ['Aggressive / Active Order', 'aktive Order', 'Market-Order, nimmt Liquidität weg'],
              [
                'AMT (Auction Market Theory)',
                'Auktionsmarkt-Theorie',
                'Markt pendelt um einen fairen Wert',
              ],
              ['Ask / Offer', 'Verkaufsseite', 'wo aggressive Käufer kaufen'],
              ['Balance', 'Seitwärtsphase', 'Käufer und Verkäufer sind sich einig'],
              ['Bid', 'Kaufseite', 'wo aggressive Verkäufer verkaufen'],
              ['Blow-off', 'Übertreibung', 'letzter wilder Schub vor dem Ende'],
              ['Composite', 'zusammengesetztes Profil', 'mehrere Tage in einem Profil'],
              [
                'CVD (Cumulative Volume Delta)',
                'kumuliertes Delta',
                'alle Deltas fortlaufend addiert',
              ],
              ['Day Type', 'Tagestyp', 'Form des Tagesprofils'],
              ['Delta', 'Delta', 'aggressive Käufe minus aggressive Verkäufe'],
              ['Divergence', 'Abweichung', 'Preis und Delta laufen auseinander'],
              ['DOM (Depth of Market)', 'Orderbuch', 'wartende Limit-Orders'],
              [
                'Double Distribution',
                'Doppelverteilung',
                'zwei Profile an einem Tag, getrennt von Lücke',
              ],
              ['Equal Highs / Lows', 'gleiche Hochs / Tiefs', 'Liquiditätszone mit vielen Stops'],
              ['Excess', 'Überschuss', 'starke Ablehnung, z. B. ein langes Tail'],
              ['Exhaustion', 'Erschöpfung', 'eine Seite gibt auf'],
              ['Footprint', 'Footprint', 'Innenleben einer Kerze mit Bid x Ask'],
              ['HVN (High Volume Node)', 'Zone mit viel Volumen', 'dicker Bauch im Profil'],
              ['IB (Initial Balance)', 'Anfangsbereich', 'Spanne der ersten Stunde'],
              ['Imbalance', 'Ungleichgewicht', 'eine Seite 3-mal stärker, schräg verglichen'],
              ['Initiative', 'treibend', 'kaufen über oder verkaufen unter dem fairen Wert'],
              ['Inside Day', 'Innentag', 'Spanne liegt komplett im Vortag'],
              ['Ledge', 'Kante', 'Profil bricht mehrmals am selben Preis ab'],
              ['Limit Order', 'Limit-Order', 'wartet im Orderbuch auf deinen Preis'],
              ['Liquidity Pool', 'Liquiditätszone', 'viele wartende Orders und Stops'],
              [
                'LVN (Low Volume Node)',
                'Zone mit wenig Volumen',
                'dünne Stelle, Preis läuft schnell durch',
              ],
              ['Market Order', 'Market-Order', 'wird sofort zum aktuellen Preis ausgeführt'],
              ['Momentum', 'Schwung', 'Kraft einer Bewegung'],
              ['Naked POC', 'offener Kontrollpunkt', 'alter POC, noch nicht wieder berührt'],
              ['Offside', 'auf dem falschen Fuß', 'Position auf der falschen Seite'],
              ['Passive Order', 'passive Order', 'Limit-Order, stellt Liquidität bereit'],
              ['POC (Point of Control)', 'Kontrollpunkt', 'Preis mit dem meisten Volumen'],
              ['Poor High / Low', 'schwaches Hoch / Tief', 'Ende ohne Tail, Auktion nicht fertig'],
              ['Positioning', 'Positionierung', 'auf welcher Seite der Markt überladen ist'],
              ['Range Extension', 'Ausweitung', 'Preis läuft über oder unter den IB'],
              ['Rejection', 'Ablehnung', 'Preis läuft sofort wieder weg'],
              ['Responsive', 'antwortend', 'kaufen unter oder verkaufen über dem fairen Wert'],
              [
                'SFP (Swing Failure Pattern)',
                'gescheiterter Ausbruch',
                'Bruch eines Hochs oder Tiefs, dann Umkehr',
              ],
              [
                'Single Prints',
                'Einzelkästchen',
                'nur ein TPO-Kästchen breit, schneller Durchlauf',
              ],
              ['Spoofing', 'Täuschung', 'große Schein-Orders, die gelöscht werden'],
              ['Stacked Imbalances', 'gestapelte Ungleichgewichte', '3 oder mehr übereinander'],
              ['Stop Run', 'Stop-Jagd', 'Preis läuft kurz durch eine Zone, um Stops auszulösen'],
              ['Tail', 'Ausläufer', 'mindestens 2 Einzelkästchen am Ende des Profils'],
              [
                'TPO (Time Price Opportunity)',
                'Zeit-Block',
                'ein Kästchen pro halbe Stunde auf einem Preis',
              ],
              ['Trapped Traders', 'gefangene Trader', 'sitzen auf der falschen Seite'],
              ['Trend', 'Trend', 'Wert wandert in eine Richtung'],
              ['VA (Value Area)', 'Wertbereich', 'etwa 70 % von Volumen oder Zeit'],
              ['VAH / VAL', 'Ober- / Unterkante Wertbereich', 'Grenzen des Wertbereichs'],
              [
                'VWAP',
                'volumengewichteter Durchschnittspreis',
                'Durchschnittspreis des Tages nach Volumen',
              ],
            ],
          },
        ],
      },
    ],
  },
];

const ORDERFLOW_QUIZ = {
  1: [
    {
      id: '1-1',
      q: 'Was ist der POC (Point of Control)?',
      o: [
        'Der Preis mit dem meisten Volumen',
        'Der höchste Preis des Tages',
        'Der Eröffnungspreis um 15:30',
        'Der Durchschnittspreis aller Kerzen',
      ],
      e: 'Der POC ist der fairste Preis: Dort wurde am meisten gehandelt, beide Seiten waren sich am meisten einig.',
    },
    {
      id: '1-2',
      q: 'Wie viel vom Volumen liegt ungefähr im Wertbereich (Value Area)?',
      o: ['Etwa 70 %', 'Etwa 50 %', 'Etwa 90 %', 'Genau 100 %'],
      e: 'Der Wertbereich umfasst etwa 70 % des Volumens (oder der Zeit beim TPO). VAH und VAL sind seine Grenzen.',
    },
    {
      id: '1-3',
      q: 'Was bedeuten die vier einzelnen „A“-Kästchen ganz unten?',
      o: [
        'Ein Käufer-Tail: Tiefe Preise wurden klar abgelehnt',
        'Der POC des Tages',
        'Der Anfangsbereich (IB)',
        'Ein schwaches Tief, das repariert werden muss',
      ],
      e: 'Nur A war dort, danach nie wieder. Mindestens 2 Einzelkästchen am Ende = Tail = starke Ablehnung durch die Käufer.',
      img: 'bild02',
    },
    {
      id: '1-4',
      q: 'Welche Zeit ist der Anfangsbereich (IB) bei MNQ, Wiener Zeit?',
      o: [
        '15:30 bis 16:30 Uhr',
        '15:30 bis 16:00 Uhr',
        '9:00 bis 10:00 Uhr',
        '21:00 bis 22:00 Uhr',
      ],
      e: 'Der IB ist die erste Stunde der Hauptsitzung, also die Halbstunden A und B: 15:30 bis 16:30 Uhr.',
    },
    {
      id: '1-5',
      q: 'Der Preis bricht aus der Range nach oben aus und bleibt mehrere Halbstunden oben. Dort baut sich Volumen auf. Was heißt das?',
      o: [
        'Annahme: Der Ausbruch ist echt, du handelst mit ihm',
        'Ablehnung: Du verkaufst zurück in die Range',
        'Nichts, Volumen ist hier egal',
        'Erschöpfung der Käufer',
      ],
      e: 'Zeit und Volumen auf dem neuen Preis bedeuten Annahme. Ein Ausbruch zählt erst, wenn der neue Preis angenommen wird.',
    },
    {
      id: '1-6',
      q: 'Was ist „treibende“ (initiative) Aktivität?',
      o: [
        'Kaufen, obwohl der Preis schon über dem fairen Wert ist',
        'Kaufen unter dem fairen Wert',
        'Verkaufen über dem fairen Wert',
        'Nur passive Limit-Orders',
      ],
      e: 'Treibend = Kaufen über oder Verkaufen unter dem fairen Wert. Das ist Druck, der einen Trend startet. Das Gegenteil ist antwortend (responsive).',
    },
    {
      id: '1-7',
      q: 'Linke Kerze: Wo wird der Preis beim nächsten Besuch wahrscheinlich Widerstand finden?',
      o: [
        'Oben im Docht, wo das meiste Volumen lag',
        'Am Kerzenkörper unten',
        'Gar nicht, Dochte sind immer schwach',
        'Am Eröffnungspreis',
      ],
      e: 'Viele haben oben im Docht gehandelt. Kommt der Preis zurück, steigen diese Käufer oft aus. Darum wird die Stelle zum Widerstand.',
      img: 'bild03',
    },
  ],
  2: [
    {
      id: '2-1',
      q: 'Was macht der Preis typischerweise an einer HVN (Zone mit viel Volumen)?',
      o: [
        'Er wird langsamer und pendelt',
        'Er läuft schnell durch',
        'Er springt sofort zurück',
        'Er macht immer ein neues Hoch',
      ],
      e: 'An einer HVN war der Preis lange. Kommt er zurück, verlangsamt er sich und pendelt dort.',
    },
    {
      id: '2-2',
      q: 'Wo läuft der Preis in diesem Profil am schnellsten durch?',
      o: ['In der LVN zwischen den beiden HVNs', 'Am POC', 'In der unteren HVN', 'Am offenen POC'],
      e: 'Die LVN ist die dünne Stelle. Dort gab es kaum Handel, also läuft der Preis schnell durch. Oft wirkt sie als Unterstützung oder Widerstand.',
      img: 'bild05',
    },
    {
      id: '2-3',
      q: 'Was ist ein offener Kontrollpunkt (Naked POC)?',
      o: [
        'Der POC eines früheren Tages, den der Preis seitdem nicht berührt hat',
        'Der POC von heute',
        'Ein POC ohne Volumen',
        'Der höchste Preis der Woche',
      ],
      e: 'Ein offener POC zieht den Preis oft an. Er ist aber schwächer als große Strukturen im höheren Zeitrahmen.',
    },
    {
      id: '2-4',
      q: 'Solltest du direkt am POC einsteigen?',
      o: [
        'Nein, der POC ist eher das Ziel als der Einstieg',
        'Ja, das ist der beste Einstieg',
        'Ja, aber nur mit Market-Order',
        'Nur am Freitag',
      ],
      e: 'Am POC sind sich beide Seiten am meisten einig. Die Chance auf eine weite Bewegung ist dort am kleinsten. Besser: weit weg vom fairen Wert einsteigen, mit Ziel POC.',
    },
    {
      id: '2-5',
      q: 'Du kaufst mit Limit-Order an einer Kurszone, aber es kommt keine sofortige Reaktion. Was tust du?',
      o: ['Aussteigen', 'Nachkaufen', 'Den Stop weiter weg legen', 'Abwarten bis Handelsschluss'],
      e: 'Kurszonen-Trades leben von der schnellen Reaktion. Bleibt sie aus, stimmt die Zone heute nicht. Raus.',
    },
    {
      id: '2-6',
      q: 'Was passiert an Einzelkästchen (Single Prints) meistens?',
      o: [
        'Der Preis prallt eher ab, als dass er sie annimmt',
        'Der Preis bleibt dort lange',
        'Dort liegt immer der POC',
        'Nichts Besonderes',
      ],
      e: 'Einzelkästchen sind schnelle Durchläufe. Der Markt hat sie damals abgelehnt, darum reagiert er dort oft wieder.',
    },
  ],
  3: [
    {
      id: '3-1',
      q: 'Die Wertbereiche von 5 Tagen überlappen sich stark. Welches Umfeld ist das?',
      o: ['Seitwärtsphase (Balance)', 'Trend', 'Doppelverteilung', 'Trendtag'],
      e: 'Überlappender Wert = beide Seiten sind sich einig = Seitwärtsphase. Im Trend wandert der Wert jeden Tag weiter.',
      img: 'bild06',
    },
    {
      id: '3-2',
      q: 'Wo kaufst du am besten in einem Aufwärtstrend?',
      o: [
        'Beim Rücksetzer an einer LVN oder der Mitte des letzten Schubs',
        'Am Tageshoch',
        'Mitten im starken Schub mit Market-Order',
        'Gar nicht, Trends handelt man nicht',
      ],
      e: 'Im Trend kaufst du Rücksetzer, nicht Hochs. Der Stop liegt unter dem letzten Tief.',
    },
    {
      id: '3-3',
      q: 'Der Anfangsbereich (IB) ist heute sehr klein. Was erwartest du?',
      o: [
        'Wahrscheinlich eine starke Bewegung später',
        'Einen ruhigen Tag ohne Bewegung',
        'Dass der Tag im IB bleibt',
        'Nichts, der IB sagt nichts',
      ],
      e: 'Kleiner IB = wenig Einigung am Anfang = leicht zu überrennen. Oft folgt eine impulsive Bewegung.',
    },
    {
      id: '3-4',
      q: 'Welcher Tagestyp hat zwei Profile, getrennt durch Einzelkästchen?',
      o: ['Doppelverteilung', 'Normaler Tag', 'Neutraler Tag', 'Kein-Trend-Tag'],
      e: 'Bei der Doppelverteilung ist der Markt erst ruhig und springt dann in einen neuen Bereich. Dazwischen bleiben Einzelkästchen.',
      img: 'bild08',
    },
    {
      id: '3-5',
      q: 'Was ist typisch für einen „Normalen Tag“ (Normal Day)?',
      o: [
        'Sehr breiter IB, der Tag bleibt fast ganz darin',
        'Kleiner IB, Bewegung in eine Richtung',
        'Ausweitung auf beiden Seiten',
        'Zwei getrennte Profile',
      ],
      e: 'Am Normalen Tag setzen große Teilnehmer gleich zu Beginn eine breite Spanne. Danach passiert kaum noch etwas außerhalb.',
    },
    {
      id: '3-6',
      q: 'Wann fasst du mehrere Tage zu einem Profil zusammen (Composite)?',
      o: [
        'Wenn der Markt mehrere Tage in derselben Range pendelt',
        'Immer am Montag',
        'Nur in einem starken Trend',
        'Wenn der IB klein ist',
      ],
      e: 'Pendelt der Markt nach einem Trend mehrere Tage im selben Bereich, ist das eine große Balance. Das Composite zeigt dir ihren POC, VAH und VAL.',
    },
    {
      id: '3-7',
      q: 'Welches ist ein Warnzeichen in einem Aufwärtstrend?',
      o: [
        'Der Tag schließt deutlich unter dem Wertbereich',
        'Der POC steigt jeden Tag',
        'Rücksetzer mit wenig Volumen',
        'Ein neues Hoch mit positivem Delta',
      ],
      e: 'Ein Schluss deutlich unter Wert zeigt, dass die Käufer die höheren Preise nicht mehr halten wollen.',
    },
  ],
  4: [
    {
      id: '4-1',
      q: 'Welches Tief ist das stärkere?',
      o: [
        'Das linke mit Tail',
        'Das rechte, flach abgeschnittene',
        'Beide gleich stark',
        'Man kann es nicht sagen',
      ],
      e: 'Das Tail links zeigt klare Ablehnung durch Käufer. Rechts ist der Markt nur ausgelaufen: Die Auktion ist nicht fertig.',
      img: 'bild10',
    },
    {
      id: '4-2',
      q: 'Was passiert mit einem schwachen Hoch (Poor High) häufig?',
      o: [
        'Der Preis kommt später zurück und „repariert“ es',
        'Es wird nie wieder erreicht',
        'Es wird zum neuen POC',
        'Es löst einen Trendtag aus',
      ],
      e: 'Ein schwaches Hoch ist eine offene Rechnung. Dahinter liegen Stops, darum ist es ein gutes Ziel.',
    },
    {
      id: '4-3',
      q: 'Was bedeutet ein langes Tail?',
      o: [
        'Eine starke Ablehnung des Preises',
        'Viel Handel auf diesem Preis',
        'Eine schwache Auktion',
        'Dass der POC dort liegt',
      ],
      e: 'Je länger das Tail, desto aggressiver hat die Gegenseite reagiert.',
    },
    {
      id: '4-4',
      q: 'Woran erkennst du eine Ledge (Kante)?',
      o: [
        'Der Preis testet mehrmals denselben Preis und kommt nicht durch, das Profil endet dort gerade',
        'Ein langes Tail am Tagesende',
        'Zwei Profile an einem Tag',
        'Ein sehr breiter IB',
      ],
      e: 'Hinter einer Kante sammeln sich Stops. Bricht der Preis durch, geben sie dem Ausbruch Extra-Schub.',
    },
    {
      id: '4-5',
      q: 'Oben und unten gibt es je ein schwaches Extrem, der Markt ist im Aufwärtstrend. Welches wird eher zuerst repariert?',
      o: ['Das obere, in Trendrichtung', 'Das untere', 'Beide gleichzeitig', 'Keines'],
      e: 'Meist wird das Extrem in Trendrichtung zuerst geholt. Ein schwaches Hoch im Aufwärtstrend heißt: Der Trend sucht noch weiter.',
    },
  ],
  5: [
    {
      id: '5-1',
      q: 'Was bedeutet die linke Zahl in einer Footprint-Zeile, z. B. 120 bei „120 x 131“?',
      o: [
        'Aggressive Verkäufe (Market-Sell, am Bid)',
        'Aggressive Käufe (Market-Buy, am Ask)',
        'Wartende Kauf-Limits',
        'Das Delta',
      ],
      e: 'Links = Bid = aggressive Verkäufer haben in wartende Kauf-Limits verkauft. Rechts = Ask = aggressive Käufer.',
      img: 'bild13',
    },
    {
      id: '5-2',
      q: 'Wie vergleichst du für ein Kauf-Ungleichgewicht?',
      o: [
        'Käufe (Ask) auf einem Preis gegen Verkäufe (Bid) einen Tick darunter',
        'Links gegen rechts in derselben Zeile',
        'Käufe gegen Käufe der Kerze davor',
        'Volumen gegen Delta',
      ],
      e: 'Schräg vergleichen: Ask auf Preis P gegen Bid auf P minus 1 Tick. Ab etwa 3-mal so viel ist es ein Ungleichgewicht.',
      img: 'bild14',
    },
    {
      id: '5-3',
      q: 'Zeile oben: 30 x 150. Zeile einen Tick darunter: 40 x 60. Ist 150 ein Kauf-Ungleichgewicht (Schwelle 300 %)?',
      o: [
        'Ja, 150 gegen 40 ist mehr als 3-mal',
        'Nein, 150 gegen 30 zählt',
        'Nein, 150 gegen 60 ist zu wenig',
        'Das kann man nicht sagen',
      ],
      e: 'Schräg: 150 (Ask oben) gegen 40 (Bid darunter) = 3,75-mal. Das ist ein Kauf-Ungleichgewicht.',
    },
    {
      id: '5-4',
      q: 'Wie berechnet sich das Delta einer Kerze?',
      o: [
        'Aggressive Käufe minus aggressive Verkäufe',
        'Hoch minus Tief',
        'Schluss minus Eröffnung',
        'Volumen geteilt durch Zeit',
      ],
      e: 'Delta zählt nur Market-Orders: Käufe am Ask minus Verkäufe am Bid.',
    },
    {
      id: '5-5',
      q: 'Eine Kerze schließt grün, aber das Delta ist stark negativ. Was heißt das?',
      o: [
        'Passive Käufer haben die aggressiven Verkäufe aufgefangen (Absorption)',
        'Die Daten sind falsch',
        'Die Verkäufer haben gewonnen',
        'Das ist ein Kaufsignal ohne Bedeutung',
      ],
      e: 'Verkäufer haben gedrückt, aber Limits haben alles geschluckt und der Preis ist trotzdem gestiegen. Hinweis auf Absorption.',
    },
    {
      id: '5-6',
      q: 'Der Preis macht ein höheres Hoch, das CVD ein tieferes Hoch. Was bedeutet das?',
      o: [
        'Divergenz: Die aggressiven Käufer werden schwächer',
        'Der Trend ist besonders stark',
        'Die Verkäufer werden schwächer',
        'Nichts, CVD ist unwichtig',
      ],
      e: 'Der Preis steigt noch, aber mit weniger aggressivem Kaufen. Anstrengung und Ergebnis passen nicht mehr zusammen.',
      img: 'bild15',
    },
    {
      id: '5-7',
      q: 'Eine Market-Order ist …',
      o: [
        'aktiv: Sie nimmt Liquidität aus dem Orderbuch',
        'passiv: Sie wartet im Orderbuch',
        'immer eine große Order',
        'unsichtbar im Footprint',
      ],
      e: 'Market-Orders greifen zu und bewegen den Preis. Limit-Orders warten und stellen Liquidität bereit.',
    },
    {
      id: '5-8',
      q: 'Was ist Spoofing?',
      o: [
        'Große Schein-Orders, die gelöscht werden, bevor der Preis sie erreicht',
        'Ein Kauf-Ungleichgewicht',
        'Ein anderes Wort für Delta',
        'Ein Tail im TPO',
      ],
      e: 'Spoofing täuscht Interesse vor und ist in regulierten Märkten verboten. Vertrau großen Zahlen im Orderbuch nicht blind.',
    },
  ],
  6: [
    {
      id: '6-1',
      q: 'Woran erkennst du hier die Absorption?',
      o: [
        'Riesige Verkäufe auf demselben Tief, aber der Preis fällt nicht weiter',
        'Der Preis fällt stark',
        'Das Delta ist positiv',
        'Es gibt viele Kauf-Ungleichgewichte oben',
      ],
      e: 'Viel Druck ohne Ergebnis: Passive Käufer fangen alles auf. Danach dreht der Preis.',
      img: 'bild16',
    },
    {
      id: '6-2',
      q: 'Was zeigt dieser Footprint oben an der Kerze?',
      o: [
        'Erschöpfung: Keiner kauft mehr nach',
        'Absorption durch Verkäufer',
        'Ein starkes Kaufsignal',
        'Gefangene Verkäufer',
      ],
      e: 'Die Zahlen oben werden winzig (3 x 7, 0 x 2). Die Käufer sind leer, der Schub ist vorbei.',
      img: 'bild17',
    },
    {
      id: '6-3',
      q: 'Was passiert mit den Verkäufern, die den Bruch mit viel Volumen verkauft haben?',
      o: [
        'Sie sitzen in der Falle und müssen teuer zurückkaufen',
        'Sie liegen im Gewinn',
        'Nichts, sie sind schon raus',
        'Sie verkaufen weiter nach',
      ],
      e: 'Spät eingestiegen, Preis kommt sofort zurück: Ihre Rückkäufe und Stops treiben den Preis zusätzlich nach oben.',
      img: 'bild18',
    },
    {
      id: '6-4',
      q: 'Was zeigt eine Kerze mit b-Form im Footprint?',
      o: [
        'Das Volumen sitzt unten, Verkäufer waren aktiv',
        'Das Volumen sitzt oben, Käufer waren aktiv',
        'Gleich viel Volumen überall',
        'Erschöpfung der Käufer',
      ],
      e: 'b-Form: Bauch unten = Verkäufer. P-Form: Bauch oben = Käufer. Wechseln b zu P, übernehmen die Käufer.',
    },
    {
      id: '6-5',
      q: 'Nach starkem Anstieg bildet sich eine Range. Viele verkaufen aggressiv, aber das letzte Tief hält. Was passiert oft?',
      o: [
        'Der Preis steigt weiter, die Verkäufer werden zum Treibstoff',
        'Der Preis fällt sofort stark',
        'Der Markt bleibt für immer seitwärts',
        'Nichts davon',
      ],
      e: 'Das ist das Momentum-Muster. Gegen Schwung handelst du erst, wenn das letzte Tief der Struktur bricht.',
    },
    {
      id: '6-6',
      q: 'Was liegt über zwei gleichen Hochs?',
      o: [
        'Viel Liquidität: Stops der Leerverkäufer und Ausbruchs-Orders',
        'Gar nichts',
        'Der POC',
        'Ein starker Widerstand, der nie bricht',
      ],
      e: 'Gleiche Hochs sind Liquiditätszonen. Große Teilnehmer nutzen sie, um in die Gegenrichtung zu verkaufen.',
      img: 'bild19',
    },
    {
      id: '6-7',
      q: 'Wo legst du deinen eigenen Stop?',
      o: [
        'Mit Abstand hinter dem offensichtlichen Hoch oder Tief',
        'Genau auf das offensichtliche Hoch oder Tief',
        'Möglichst eng am Einstieg, egal wo',
        'Gar keinen Stop',
      ],
      e: 'Genau auf dem offensichtlichen Punkt liegen alle Stops und werden gern abgefischt. Leg deinen dahinter.',
    },
  ],
  7: [
    {
      id: '7-1',
      q: 'Welche Bedingung ist ideal für einen Ausbruch aus der Seitwärtsphase?',
      o: [
        'Mehrere Innentage mit überlappenden Wertbereichen',
        'Ein Trendtag am Vortag',
        'Ein sehr breiter IB heute',
        'Ein neutraler Tag',
      ],
      e: 'Je länger die Balance, desto stärker der Ausbruch. Mehrere Innentage und überlappender Wert stauen Energie.',
    },
    {
      id: '7-2',
      q: 'Der Bruch ist da, aber das Chance-Risiko für eine Market-Order ist schlecht. Was tust du?',
      o: [
        'Limit-Order beim Rücksetzer, etwa halber Weg zur Bruchstelle',
        'Trotzdem sofort Market-Order',
        'Long gehen',
        'Den Trade vergessen',
      ],
      e: 'Meist kommt der Preis mindestens zur Hälfte zurück. Dort füllt deine Limit-Order. Stop über dem POC der Range.',
      img: 'bild20',
    },
    {
      id: '7-3',
      q: '80%-Regel: Öffnung über der VAH vom Vortag, C und D schließen im Wertbereich. Wo ist das Ziel?',
      o: ['Die VAL vom Vortag', 'Die VAH vom Vortag', 'Das Tageshoch', 'Der Eröffnungspreis'],
      e: 'Gescheitert außerhalb, zwei Halbstunden zurück im Wert: Der Preis läuft häufig durch den ganzen Wertbereich zur anderen Seite.',
      img: 'bild22',
    },
    {
      id: '7-4',
      q: 'SFP am Hoch: Welches Delta willst du beim Ausbruch über das Hoch sehen?',
      o: ['Stark positiv: aggressives Kaufen durch das Hoch', 'Stark negativ', 'Null', 'Egal'],
      e: 'Aggressive Käufer kaufen den Ausbruch. Scheitert er, sitzen genau diese Käufer in der Falle.',
      img: 'bild23',
    },
    {
      id: '7-5',
      q: 'Wo liegt der Stop bei einem SFP-Short am Hoch?',
      o: [
        'Über der Spitze des Ausbruchs',
        'Genau auf dem alten Hoch',
        'Am POC',
        'Unter dem Tagestief',
      ],
      e: 'Wird die Spitze überschritten, ist das Muster ungültig.',
    },
    {
      id: '7-6',
      q: 'Doppelverteilung nach unten, unten dreht das Delta ins Plus. Wo ist das Ziel?',
      o: [
        'Die Einzelkästchen und die obere Verteilung',
        'Ein neues Tief',
        'Der POC der unteren Verteilung',
        'Es gibt kein Ziel',
      ],
      e: 'Was schnell und ohne Überzeugung gekommen ist, kann schnell zurückgehen. Die Lücke der Einzelkästchen ist das erste Ziel.',
      img: 'bild21',
    },
    {
      id: '7-7',
      q: 'Neutraler Tag: treibende Aktivität an beiden Enden, sehr ausgeglichenes Profil. Was tust du?',
      o: [
        'Zur Mitte handeln, Ausbruch ist unwahrscheinlich',
        'Den Ausbruch kaufen',
        'Die 80%-Regel anwenden',
        'Nur Market-Orders nutzen',
      ],
      e: 'Beide Seiten sind aktiv und das Profil ist ausgeglichen. Hohe Chance auf Pendeln, niedrige Chance auf Ausbruch.',
    },
  ],
};
