# CPRB OS (project-northstar)

Persönliches Betriebssystem: Trading, Fitness, Fokus, Ziele, Bibliothek, Kalender.
PWA ohne Build-Step, Backend über Supabase, dazu native iPhone- und Watch-Apps.

Sprache im Projekt: **Deutsch** — UI-Texte, Commit-Messages, Kommentare.

## Starten

Kein Build, kein `npm install`. `index.html` im Browser öffnen.

Lokal über `file://` läuft die App, aber der Service Worker wird vom Browser blockiert —
PWA-Installation funktioniert erst über eine echte URL (Vercel).

## Tests

Reine Node-Skripte ohne Framework, jedes läuft für sich. **Vom Repo-Root aus starten**,
die Pfade sind relativ:

```
for t in tests/*.test.js; do node "$t" || echo "ROT: $t"; done
```

Zwei Sorten:

- **Verhaltenstests** — `tasks.test.js` und `backup.test.js` laden Module in einen `vm`-Context
  mit gefaktem DOM und Supabase-Client und prüfen echtes Verhalten.
- **Quelltext-Tests** — der Rest liest Dateien als Text und prüft per Regex, dass bestimmte
  Logik, CSS-Regeln oder Migrationen vorhanden sind.

> **Wichtig bei Quelltext-Tests:** Regexe so schreiben, dass sie **Formatierung tolerieren**
> (`\s*` zwischen Operatoren, `;?` vor `}`). Sonst reißt jede Umformatierung die Tests,
> ohne dass sich Verhalten geändert hat.
>
> Ebenso: **keine Versionsnummern wörtlich prüfen.** `fitness-mobile.test.js` erwartete
> `styles.css?v=4`, während im HTML längst `?v=5` stand — der Test war rot, ohne dass es
> jemandem auffiel. Prüfe `\?v=\d+`, nicht die Ziffer.

## Aufbau

```
index.html      alle Views als HTML, Script-Tags am Ende
styles.css      komplettes Styling, Design-Tokens als CSS-Variablen in :root
app.js          boot() + loadAll() — Supabase-Client, Auth, Initial-Render
config.js       SUPABASE_URL und SUPABASE_KEY
sw.js           Service Worker, App-Shell-Cache
modules/*.js    ein Modul pro Bereich
supabase/       Migrationen + Edge Function smart-reminder
apple/CPRBOS/   Xcode-Projekt: iPhone-App + Watch App (SwiftUI)
tests/          Node-Testskripte
```

### Module

| Datei | Zuständig für |
|---|---|
| `core.js` | Helfer (`$`, `escapeHtml`), Navigation, Auth-UI |
| `focus.js` | Tagesfokus, Daily Tasks, Priorität, wiederkehrende Aufgaben |
| `goals.js` | Vision-Ziele inkl. Bild-Upload |
| `trading.js` | Trading-Cockpit, Journal, Regel-Checkliste, Analytics |
| `fitness.js` | Trainingspläne, Sessions, satzgenaues Logging, A/B-Vergleich |
| `notes.js` | Notizen, inkl. Pencil-Handschrift |
| `academy.js` | Trading Academy, Lernnotizen |
| `library.js` | PDF-Bibliothek mit Supabase Storage |
| `calendar.js` | Monatskalender, Termine |
| `weekly.js` | Weekly Review |
| `reminders.js` | Smart Reminders, Habits |
| `backup.js` | Export/Import, AES-verschlüsseltes ZIP, CSV |
| `hydration.js` | Trinkmenge, Push-Checkpoints — wird per `loadOptionalModule()` nachgeladen |
| `today.js` | Heute-Screen: Anker, Jetzt-Karte, Heute noch, Momentum |
| `stats.js` | Trading-Kennzahlen, Kapitalkurve, Tagesergebnis |
| `pwa.js` | Service-Worker-Registrierung, Install-Prompt |

## Navigation

Zwei Ebenen, eine Quelle: jede `<section class="page">` ist eine Seite, `showPage(id)` schaltet um.

- **Desktop:** Seitenleiste mit allen Seiten.
- **Mobil:** fünf Tabs — Heute · Trading · Körper · Wissen · Ich.
  Wissen und Ich öffnen ein Sheet (`openMobileSheet('wissen')` / `('ich')`), das die
  restlichen Seiten anbietet. `openMobileMore()` und `closeMobileMore()` existieren weiter
  als Aliase, damit alte Aufrufe nicht brechen.
- Startseite ist `today`, nicht mehr `home` — `home` heißt in der Oberfläche jetzt "Dashboard".

## Konventionen

- **Vanilla JS, keine Frameworks, kein Bundler.** Alle Skripte sind klassische Scripts,
  keine ES-Module — Funktionen und State liegen global. Kein `import`/`export`.
- **Ein Modul = ein Bereich.** Pro Modul üblich: `loadX()` holt Daten, `renderX()` zeichnet,
  dazwischen Aktionen. `app.js` ruft beide in `loadAll()` auf — neue Module dort eintragen.
- **DOM-Zugriff über `$('#id')`** aus `core.js`.
- **Nutzereingaben immer durch `escapeHtml()`**, bevor sie in `innerHTML` landen.
- **Supabase über die globale `sb`.** Fehler abfangen und dem Nutzer melden, nicht schlucken.
- **Formatierung: Prettier 3**, Konfiguration in `.prettierrc`
  (100 Zeichen, einfache Anführungszeichen, Semikolons). Vor dem Commit:
  `npx prettier --write .`

## Fallstricke

- **Asset-Versionen von Hand pflegen.** Skripte und Styles hängen `?v=N` an. Wird eine Datei
  geändert, muss die Nummer **an drei Stellen gleichzeitig** hoch:
  `index.html`, `sw.js` (`APP_SHELL`) und die Cache-Konstante `CACHE` in `sw.js`.
  Sonst liefern installierte PWAs die alte Version aus.
- **`config.js` liegt im Git.** Enthält URL und Publishable Key. Der Key ist für den Client
  gedacht und durch Row Level Security geschützt — trotzdem: dort **niemals** `service_role`
  oder `CRON_SECRET` ablegen. `apple-watch.test.js` prüft genau das.
- **Der Web-Key und der native Key müssen identisch sein** — `config.js` und
  `apple/CPRBOS/CPRBOS/CPRBModels.swift`. Wird ebenfalls getestet.
- **Migrationen sind additiv.** `add column if not exists`, danach
  `pg_notify('pgrst','reload schema')`, sonst kennt PostgREST die neue Spalte nicht.
  Module fangen fehlende Spalten ab (`isMissingTradingV2Columns`, `isMissingGoalImageSchema`) —
  bei neuen Spalten dieses Muster fortführen.
- **`backup.js` muss neue Tabellen kennen**, sonst fallen sie aus Export und Import heraus.

## Datenbank

`daily_focus` · `daily_tasks` · `recurring_tasks` · `vision_goals` ·
`fitness_plans` · `fitness_plan_exercises` · `fitness_sessions` ·
`fitness_session_exercises` · `fitness_set_logs` ·
`trading_cockpit` · `trading_journal_v2` · `library_books` ·
`habits` + Smart Reminders · `weekly_review` · Academy + Calendar (V033)

Storage-Buckets: `northstar-media` (Bilder, Screenshots), `northstar-library` (PDFs).

## Kontext

Langzeitgedächtnis liegt im Obsidian-Vault `~/Documents/BrainofCloud`,
siehe dort `Projekte/project-northstar.md` und `Gedächtnis/Offene Fäden.md`.
