# CPRB Habits & Smart Reminders einrichten

Die App-Oberfläche ist Teil des normalen Vercel-Deployments. Für tägliche To-dos und echte Push-Benachrichtigungen sind zusätzlich die folgenden einmaligen Supabase-Schritte nötig.

## 1. Datenbank-Migration ausführen

Im Supabase Dashboard den **SQL Editor** öffnen und den vollständigen Inhalt von
`supabase/migrations/20260804_habits_smart_reminders_v1.sql` ausführen.

Danach funktionieren die täglich wiederholenden To-dos bereits.

## 2. Edge Function deployen

Im Supabase Dashboard zu **Edge Functions** wechseln, eine Function mit dem Namen
`smart-reminder` erstellen und den Inhalt von
`supabase/functions/smart-reminder/index.ts` einsetzen.

Die JWT-Prüfung der Function muss deaktiviert sein. Die Function prüft Aufrufe selbst:

- `public-key` verlangt einen gültigen angemeldeten Benutzer.
- `dispatch` verlangt das geheime `x-cron-secret`.

Mit der Supabase CLI entspricht das:

```bash
supabase functions deploy smart-reminder --no-verify-jwt
```

## 3. Cron-Secret setzen

Ein langes zufälliges Secret erzeugen und im Supabase Dashboard unter **Edge Functions → Secrets** als `CRON_SECRET` speichern. Optional kann `VAPID_SUBJECT` auf eine eigene `mailto:`-Adresse gesetzt werden.

Das Secret niemals in GitHub, `config.js` oder Chat-Nachrichten einfügen.

## 4. Minütlichen Cron-Job anlegen

`YOUR_PROJECT_REF` und `YOUR_LONG_RANDOM_SECRET` ersetzen und danach im SQL Editor ausführen. Für `YOUR_LONG_RANDOM_SECRET` exakt denselben Wert wie bei `CRON_SECRET` verwenden.

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret(
  'https://YOUR_PROJECT_REF.supabase.co',
  'cprb_project_url'
);

select vault.create_secret(
  'YOUR_LONG_RANDOM_SECRET',
  'cprb_cron_secret'
);

select cron.schedule(
  'cprb-smart-reminder',
  '* * * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'cprb_project_url'
    ) || '/functions/v1/smart-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'cprb_cron_secret'
      )
    ),
    body := '{"action":"dispatch"}'::jsonb
  );
  $$
);
```

## 5. Auf dem Handy aktivieren

1. CPRB als Home-Screen-App öffnen.
2. **Mehr → Erinnerungen** öffnen.
3. Uhrzeiten und Wochentage einstellen und speichern.
4. **Push aktivieren** antippen und die Systemabfrage erlauben.
5. Mit **Test senden** prüfen.

VAPID-Schlüssel werden beim ersten Aktivieren automatisch erzeugt und ausschließlich in der RLS-geschützten Tabelle `push_server_config` gespeichert.

## Fehlerbehebung

- Keine Serienfunktion: Prüfen, ob die Migration ohne Fehler abgeschlossen wurde.
- „Push-Server ist noch nicht aktiviert“: Function ist noch nicht deployt oder nicht erreichbar.
- Test funktioniert, geplante Nachricht nicht: `CRON_SECRET`, Cron-Job und Function-Logs prüfen.
- iPhone zeigt keine Freigabe: App zum Home-Bildschirm hinzufügen, von dort öffnen und erst dann **Push aktivieren** antippen.
