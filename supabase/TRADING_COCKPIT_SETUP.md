# CPRB Trading Cockpit einrichten

## 1. Migration ausführen

1. Supabase öffnen und zum **SQL Editor** wechseln.
2. Eine neue Query anlegen.
3. Den vollständigen Inhalt aus `supabase/migrations/20260804_trading_cockpit_v1.sql` einfügen.
4. **Run** drücken.

Die Migration ergänzt jeden Trade um Pre-Trade-Checkliste, Regel-Score, Fehler, Risiko-Snapshot, Positionsgröße und Ausführungsbewertung. Zusätzlich wird `trading_settings` für deine persönlichen Risiko- und Tageslimits erstellt.

## 2. Vorschau testen

1. Den Vercel-Preview-Link des Pull Requests öffnen und anmelden.
2. **Trading** öffnen und das Cockpit speichern.
3. **Trade planen** wählen.
4. Kontostand, Risiko, Entry, Stop und optional Take Profit eingeben.
5. Prüfen, ob Risikobetrag, Positionsgröße und geplantes CRV berechnet werden.
6. Alle acht Regeln abhaken: Der Status muss auf **Trade erlaubt** wechseln.
7. Den Plan ohne P&L speichern. Er muss im Journal als **Offen** erscheinen.
8. Den Trade erneut öffnen, P&L und Review ergänzen und speichern.
9. Prüfen, ob Regel-Score, Planquote und Fehlerkosten aktualisiert werden.

## Hinweis zum Kontraktwert

Die Positionsgröße ist nur korrekt, wenn der Kontraktwert zum Instrument und Broker passt. Bei XAUUSD entspricht 1 Standard-Lot häufig ungefähr 100 USD je 1.0 Preisbewegung. Die verbindliche Angabe steht in der Kontraktspezifikation deines Brokers.
