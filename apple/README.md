# CPRB OS für iPhone und Apple Watch

Die native Begleit-App verbindet das bestehende CPRB-Fitnessmodul mit der Apple Watch.

## Version 1

- Anmeldung auf dem iPhone mit dem bestehenden CPRB-Konto
- Passwort bleibt nur während der Anmeldung im Speicher und wird danach verworfen
- temporärer Supabase-Zugang wird über `WatchConnectivity` an die gekoppelte Watch übertragen
- aktive Training-A- oder Training-B-Sitzung laden
- Sätze, Gewicht und Wiederholungen auf der Watch ändern
- einzelne Sätze auf der Watch abschließen oder wieder öffnen
- Übungsstatus in Supabase automatisch synchronisieren
- vorherigen Satzwert aus dem passenden A/B-Training anzeigen

## Projekt öffnen

1. `apple/CPRBOS/CPRBOS.xcodeproj` mit Xcode öffnen.
2. Für beide Targets unter **Signing & Capabilities** das eigene Personal Team auswählen.
3. Zuerst die iPhone-App auf einem gekoppelten iPhone starten und anmelden.
4. Danach die Watch-App starten und das aktive Training aktualisieren.

Der Supabase Publishable Key ist bewusst ein öffentlicher Client-Schlüssel. RLS schützt weiterhin alle Fitnessdaten pro Benutzer.

## Nächste Ausbaustufe

HealthKit-Workout, Puls, aktive Kalorien, Trainingsdauer und Digital-Crown-Eingabe folgen nach dem erfolgreichen Gerätetest dieser Synchronisationsbasis.
