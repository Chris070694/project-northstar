# CPRB OS für iPhone und Apple Watch

Die native Begleit-App verbindet das bestehende CPRB-Fitnessmodul mit der Apple Watch.

## Version 1

- Anmeldung auf dem iPhone mit dem bestehenden CPRB-Konto
- Passwort bleibt nur während der Anmeldung im Speicher und wird danach verworfen
- temporärer Supabase-Zugang wird über `WatchConnectivity` an die gekoppelte Watch übertragen
- Refresh-Token wird verschlüsselt in den Schlüsselbünden von iPhone und Watch gespeichert
- iPhone und Watch verwenden getrennte Supabase-Sitzungen, damit Token-Rotation sicher bleibt
- Anmeldung und Watch-Zugang werden vor Ablauf automatisch erneuert
- Abmeldung auf dem iPhone wird an die Watch weitergegeben
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

Unterstützt werden iOS 17 oder neuer und watchOS 10 oder neuer. Für
`WatchConnectivity` sind weder App Groups noch zusätzliche Entitlements nötig;
entscheidend sind dasselbe Signing-Team, die Companion-Bundle-ID und die im
iPhone-Target eingebettete Watch-App.

Der Supabase Publishable Key ist bewusst ein öffentlicher Client-Schlüssel. RLS schützt weiterhin alle Fitnessdaten pro Benutzer.

## Nächste Ausbaustufe

HealthKit-Workout, Puls, aktive Kalorien, Trainingsdauer und Digital-Crown-Eingabe folgen nach dem erfolgreichen Gerätetest dieser Synchronisationsbasis.
