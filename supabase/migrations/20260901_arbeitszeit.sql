/* Arbeitszeit-Erfassung — Stempeluhr.

   Vier Stempel je Tag: Arbeitsbeginn, Pausenbeginn, Pausenende, Arbeitsende.
   Mehrere Pausen sind erlaubt, Beginn und Ende gibt es genau einmal.

   Warum eine eigene Tabelle und nicht direkt calendar_events: ein Kalendertermin
   kennt weder Pausen noch einen laufenden Zustand. Der fertige Tag wandert
   trotzdem in den Kalender — dafuer sorgt ein Trigger, damit das Kalendermodul
   selbst unveraendert bleibt.

   Das hier ist Christians private Nebenaufzeichnung. Sie ersetzt nicht die
   offizielle Zeiterfassung des Arbeitgebers, sondern dient als Gegenkontrolle. */

-- ---------------------------------------------------------------------------
-- Stempel
-- ---------------------------------------------------------------------------
create table if not exists public.work_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  /* work_date ist der Arbeitstag, nicht das Kalenderdatum des Stempels. Beides
     faellt bei einer Nachtschicht auseinander: ein Feierabend um 02:00 gehoert
     zum Vortag. Der Client setzt den Tag beim Arbeitsbeginn und alle weiteren
     Stempel uebernehmen ihn. */
  work_date date not null,
  kind text not null check (kind in ('work_start', 'break_start', 'break_end', 'work_end')),
  stamped_at timestamptz not null default now(),
  location text,
  note text,
  created_at timestamptz not null default now()
);

/* Arbeitsbeginn und Feierabend genau einmal pro Tag — ein zweiter Stempel ist
   immer ein Fehlgriff. Pausen bleiben absichtlich unbegrenzt. */
create unique index if not exists work_entries_ein_beginn
  on public.work_entries (user_id, work_date) where kind = 'work_start';
create unique index if not exists work_entries_ein_ende
  on public.work_entries (user_id, work_date) where kind = 'work_end';
create index if not exists work_entries_tag
  on public.work_entries (user_id, work_date, stamped_at);

alter table public.work_entries enable row level security;

drop policy if exists "work_entries eigene lesen" on public.work_entries;
create policy "work_entries eigene lesen" on public.work_entries
  for select using (auth.uid() = user_id);
drop policy if exists "work_entries eigene anlegen" on public.work_entries;
create policy "work_entries eigene anlegen" on public.work_entries
  for insert with check (auth.uid() = user_id);
drop policy if exists "work_entries eigene aendern" on public.work_entries;
create policy "work_entries eigene aendern" on public.work_entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "work_entries eigene loeschen" on public.work_entries;
create policy "work_entries eigene loeschen" on public.work_entries
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Tagesauswertung
-- ---------------------------------------------------------------------------
/* Pausen werden ueber das jeweils vorhergehende Stempelpaar gerechnet: ein
   break_end zaehlt nur, wenn direkt davor ein break_start steht. Ein vergessenes
   Pausenende zaehlt damit gar nicht, statt bis zum Feierabend weiterzulaufen —
   lieber eine Pause zu wenig als ein Arbeitstag, der zu kurz aussieht. */
create or replace view public.work_days_v with (security_invoker = on) as
with stempel as (
  select
    user_id,
    work_date,
    kind,
    stamped_at,
    lag(stamped_at) over (partition by user_id, work_date order by stamped_at) as vorher_at,
    lag(kind) over (partition by user_id, work_date order by stamped_at) as vorher_kind
  from public.work_entries
),
letzter as (
  select user_id, work_date, max(stamped_at) as zuletzt
  from public.work_entries group by user_id, work_date
),
tag as (
  select
    s.user_id,
    s.work_date,
    min(s.stamped_at) filter (where s.kind = 'work_start') as beginn,
    max(s.stamped_at) filter (where s.kind = 'work_end') as ende,
    max(s.stamped_at) filter (where s.kind = 'break_start') as letzte_pause_start,
    count(*) filter (where s.kind = 'break_start') as pausen,
    coalesce(
      sum(extract(epoch from (s.stamped_at - s.vorher_at)))
        filter (where s.kind = 'break_end' and s.vorher_kind = 'break_start'),
      0
    )::bigint as pause_sekunden,
    count(*) as stempel
  from stempel s
  group by s.user_id, s.work_date
)
select
  t.user_id,
  t.work_date,
  t.beginn,
  t.ende,
  t.pausen,
  t.pause_sekunden,
  t.stempel,
  /* Ohne Feierabend bleibt die Rechnung leer statt null Stunden zu behaupten.
     Der laufende Tag wird im Client gegen die Uhr gerechnet, nicht hier. */
  case when t.beginn is not null and t.ende is not null
       then extract(epoch from (t.ende - t.beginn))::bigint end as brutto_sekunden,
  case when t.beginn is not null and t.ende is not null
       then (extract(epoch from (t.ende - t.beginn)) - t.pause_sekunden)::bigint end as netto_sekunden,
  (t.beginn is not null and t.ende is null) as laeuft,
  /* Eine Pause laeuft, wenn der letzte Stempel des Tages ein break_start war. */
  (t.letzte_pause_start is not null and t.letzte_pause_start = l.zuletzt) as pause_laeuft
from tag t
join letzter l on l.user_id = t.user_id and l.work_date = t.work_date;

-- ---------------------------------------------------------------------------
-- Der fertige Tag wandert in den Kalender
-- ---------------------------------------------------------------------------
/* Additiv: eine neue Spalte, damit der erzeugte Termin eindeutig als solcher
   erkennbar ist. Ihn ueber Titel oder Kategorie zu suchen waere bruechig — ein
   selbst angelegter Arbeitstermin wuerde ueberschrieben. Das Kalendermodul
   liest select * und traegt die Spalte einfach mit. */
alter table public.calendar_events add column if not exists source text;
create unique index if not exists calendar_events_stempeluhr
  on public.calendar_events (user_id, event_date) where source = 'work_clock';

create or replace function public.work_entries_sync_calendar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wer uuid;
  tag date;
  daten record;
  beginn_zeit time;
  ende_zeit time;
  pause_minuten int;
  titel text;
begin
  wer := coalesce(new.user_id, old.user_id);
  tag := coalesce(new.work_date, old.work_date);

  /* Ueber die Sicht statt einer zweiten Rechnung: sonst driften die Zahlen in
     der App und im Kalender irgendwann auseinander. Der Filter auf user_id ist
     hier Pflicht — die Funktion laeuft als Eigentuemer, RLS greift nicht. */
  select * into daten from public.work_days_v w
   where w.user_id = wer and w.work_date = tag;

  /* Kein Feierabend, kein Kalendereintrag. Ein halber Tag im Kalender waere
     eine Behauptung ueber eine Arbeitszeit, die noch laeuft. Gilt auch nach
     einer Korrektur: wird der Feierabend geloescht, verschwindet der Termin. */
  if daten is null or daten.ende is null then
    delete from public.calendar_events c
     where c.user_id = wer and c.event_date = tag and c.source = 'work_clock';
    return null;
  end if;

  /* Ausnahme von der Hausregel "Zeitzonen gehoeren zum Client": der Titel ist
     ein Text und wird hier gebaut, also muss die Zone hier stehen. Die Stempel
     selbst bleiben timestamptz und damit ortsunabhaengig richtig — nur die
     Beschriftung ist auf Wien festgelegt. */
  beginn_zeit := (daten.beginn at time zone 'Europe/Vienna')::time;
  ende_zeit := (daten.ende at time zone 'Europe/Vienna')::time;
  pause_minuten := round(daten.pause_sekunden / 60.0);

  titel := 'Arbeit ' || to_char(beginn_zeit, 'HH24:MI') || '–' || to_char(ende_zeit, 'HH24:MI');
  if pause_minuten > 0 then
    titel := titel || ' (' || pause_minuten || ' min Pause)';
  end if;

  insert into public.calendar_events
    (user_id, title, event_date, start_time, end_time, category, description, source)
  values
    (wer, titel, tag, beginn_zeit, ende_zeit, 'Arbeit',
     'Netto ' || to_char(make_interval(secs => daten.netto_sekunden), 'HH24:MI') || ' h',
     'work_clock')
  on conflict (user_id, event_date) where source = 'work_clock'
  do update set
    title = excluded.title,
    start_time = excluded.start_time,
    end_time = excluded.end_time,
    description = excluded.description;

  return null;
end;
$$;

/* Auf jede Aenderung, nicht nur auf den Feierabend: Christian korrigiert
   Fehlstempel durch Antippen der Zeile. Ein Trigger nur auf work_end wuerde den
   Kalendereintrag danach mit den alten Zeiten stehen lassen. */
drop trigger if exists work_entries_kalender on public.work_entries;
create trigger work_entries_kalender
  after insert or update or delete on public.work_entries
  for each row execute function public.work_entries_sync_calendar();

comment on table public.work_entries is
  'Stempeluhr fuer die Arbeitszeit. Private Nebenaufzeichnung, ersetzt nicht die offizielle Zeiterfassung des Arbeitgebers.';
comment on view public.work_days_v is
  'Brutto, Pause und Netto je Arbeitstag. Ohne Feierabend bleiben die Summen leer.';
comment on column public.calendar_events.source is
  'work_clock kennzeichnet Termine, die die Stempeluhr erzeugt hat. Von Hand angelegte Termine bleiben null.';

notify pgrst, 'reload schema';
