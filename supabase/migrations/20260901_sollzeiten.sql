/* Sollzeiten je Wochentag — die Grundlage fuer das Gleitzeitkonto.

   Christians Regelarbeitszeit: Mo–Do 06:00–14:30 mit 30 min Pause (8:00 netto),
   Fr 06:00–13:00 mit 30 min Pause (6:30 netto). Macht 38:30 in der Woche.

   Gespeichert wird die Nettozeit, dazu Regelbeginn und Regelpause. Beides wird
   gebraucht, um vorherzusagen, bis wann er an einem kuenftigen Tag bleiben muss —
   fuer heute rechnet die App mit dem echten Beginn und der echten Pause. */

create table if not exists public.work_targets (
  user_id uuid not null references auth.users (id) on delete cascade,
  /* 0 = Sonntag bis 6 = Samstag, wie Postgres extract(dow) und JavaScript
     getDay(). Zwei Zaehlweisen im selben Projekt waeren eine Fehlerquelle. */
  weekday smallint not null check (weekday between 0 and 6),
  net_minutes int not null default 0 check (net_minutes between 0 and 1440),
  start_time time not null default '06:00',
  break_minutes int not null default 0 check (break_minutes between 0 and 480),
  updated_at timestamptz not null default now(),
  primary key (user_id, weekday)
);

alter table public.work_targets enable row level security;

drop policy if exists "work_targets eigene lesen" on public.work_targets;
create policy "work_targets eigene lesen" on public.work_targets
  for select using (auth.uid() = user_id);
drop policy if exists "work_targets eigene anlegen" on public.work_targets;
create policy "work_targets eigene anlegen" on public.work_targets
  for insert with check (auth.uid() = user_id);
drop policy if exists "work_targets eigene aendern" on public.work_targets;
create policy "work_targets eigene aendern" on public.work_targets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "work_targets eigene loeschen" on public.work_targets;
create policy "work_targets eigene loeschen" on public.work_targets
  for delete using (auth.uid() = user_id);

/* Christians Woche als Startwert. Nur einfuegen, was noch fehlt — eine spaetere
   Aenderung von Hand darf nicht wieder ueberschrieben werden. */
insert into public.work_targets (user_id, weekday, net_minutes, start_time, break_minutes)
select u.id, t.weekday, t.net_minutes, t.start_time, t.break_minutes
from auth.users u
cross join (values
  (0, 0,   time '06:00', 0),   -- Sonntag
  (1, 480, time '06:00', 30),  -- Montag
  (2, 480, time '06:00', 30),
  (3, 480, time '06:00', 30),
  (4, 480, time '06:00', 30),  -- Donnerstag
  (5, 390, time '06:00', 30),  -- Freitag
  (6, 0,   time '06:00', 0)    -- Samstag
) as t(weekday, net_minutes, start_time, break_minutes)
on conflict (user_id, weekday) do nothing;

comment on table public.work_targets is
  'Sollarbeitszeit je Wochentag. net_minutes ist die Nettozeit ohne Pause; start_time und break_minutes dienen der Vorhersage kuenftiger Tage.';

notify pgrst, 'reload schema';
