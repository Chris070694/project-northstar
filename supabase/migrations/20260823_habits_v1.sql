-- CPRB Gewohnheiten v1
--
-- Bewusst getrennt von recurring_tasks: eine wiederkehrende Aufgabe erzeugt jeden
-- Tag einen neuen Eintrag, der offen liegen bleibt und die Liste fuellt. Eine
-- Gewohnheit hat keinen Rueckstand -- nur einen Verlauf und eine Serie.
--
-- Gespeichert wird nur, was kein Rechenergebnis ist: welche Tage abgehakt sind.
-- Serie, beste Serie und Quote rechnet der Client bei jedem Render neu, sonst
-- luegen die Zahlen, sobald ein Tag nachgetragen wird.

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 80),
  icon text not null default '' check (char_length(icon) <= 8),
  -- target_type liegt schon hier, obwohl die Oberflaeche vorerst nur 'daily'
  -- anbietet. Spart spaeter eine Migration fuer "3x pro Woche" oder feste Tage.
  target_type text not null default 'daily'
    check (target_type in ('daily', 'weekly_count', 'weekdays')),
  target_count integer not null default 1 check (target_count between 1 and 7),
  weekdays smallint[] not null default '{}',
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists habits_user_board_idx
  on public.habits (user_id, sort_order, created_at)
  where archived_at is null;

-- Ein Tag, eine Gewohnheit, hoechstens ein Eintrag. Der eindeutige Index macht
-- doppeltes Abhaken unmoeglich, statt es im Client abfangen zu muessen.
create table if not exists public.habit_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  unique (habit_id, day)
);

create index if not exists habit_entries_user_day_idx
  on public.habit_entries (user_id, day desc);

alter table public.habits enable row level security;
alter table public.habit_entries enable row level security;

drop policy if exists "Users manage their own habits" on public.habits;
create policy "Users manage their own habits"
  on public.habits
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Zusaetzlich der Nachweis auf die Eltern-Gewohnheit, damit kein Eintrag unter
-- eine fremde Gewohnheit gehaengt werden kann.
drop policy if exists "Users manage their own habit entries" on public.habit_entries;
create policy "Users manage their own habit entries"
  on public.habit_entries
  for all
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.habits habit
      where habit.id = habit_entries.habit_id
        and habit.user_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.habits habit
      where habit.id = habit_entries.habit_id
        and habit.user_id = (select auth.uid())
    )
  );

select pg_notify('pgrst', 'reload schema');
