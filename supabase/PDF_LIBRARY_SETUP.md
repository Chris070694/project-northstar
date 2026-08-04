# CPRB PDF-Bibliothek einrichten

Die Bibliothek speichert PDFs in einem privaten Supabase-Storage-Bucket. Jeder angemeldete Nutzer kann ausschließlich seinen eigenen Ordner lesen und verwalten.

## 1. Migration ausführen

1. Supabase öffnen und zum **SQL Editor** wechseln.
2. Eine neue Query anlegen.
3. Den vollständigen Inhalt aus `supabase/migrations/20260804_pdf_library_v1.sql` einfügen.
4. **Run** drücken.

Die Migration erstellt:

- die Tabelle `library_books` inklusive Lesefortschritt,
- den privaten Bucket `northstar-library`,
- Row-Level-Security-Regeln für Datenbank und Dateien,
- ein Dateilimit von 50 MB pro PDF.

Es sind keine zusätzlichen Edge Functions oder Secrets nötig.

## 2. Vorschau testen

1. Den Vercel-Preview-Link des Pull Requests öffnen und anmelden.
2. **Mehr → Bibliothek** auswählen.
3. Eine eigene oder rechtmäßig nutzbare PDF hochladen.
4. Das Buch öffnen, ein paar Seiten weiterblättern und den Reader schließen.
5. Das Buch erneut öffnen: CPRB soll auf der zuletzt gelesenen Seite starten.
6. Optional prüfen, ob Suche, Kategorie und Löschen funktionieren.

## Hinweise

- Der Upload ist fortsetzbar und funktioniert auch bei größeren PDFs stabiler.
- Cover und Seitenzahl werden direkt im Browser aus der ersten PDF-Seite erzeugt.
- PDFs sind nicht öffentlich erreichbar; die App erstellt beim Lesen einen zeitlich begrenzten Link.
- Bitte nur PDFs hochladen, die dir gehören oder die du rechtmäßig verwenden darfst.
