-- CPRB Fitness v0.5
-- 1. Trainingstasche: Checkliste mit Items, die sich taeglich selbst zuruecksetzen.
-- 2. Pausentimer: gemerkte Pausenzeit pro Uebung.
--
-- Additiv. Nach dem Einspielen kennt PostgREST das Schema erst durch pg_notify am Ende.

-- ---------------------------------------------------------------------------
-- 1. Trainingstasche
-- ---------------------------------------------------------------------------
-- checked_on haelt fest, an welchem Tag der Haken gesetzt wurde. Ein Haken gilt
-- nur fuer den heutigen Tag: liegt checked_on in der Vergangenheit, ist das Item
-- offen. Damit braucht der Reset keinen Cron-Job -- er passiert beim Lesen.

create table if not exists public.gym_bag_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 80),
  checked boolean not null default false,
  checked_on date,
  sort_order integer not null default 0,
  kind text not null default 'gym' check (kind in ('gym', 'home', 'cardio')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gym_bag_items_user_sort_idx
  on public.gym_bag_items(user_id, kind, sort_order);

alter table public.gym_bag_items enable row level security;

drop policy if exists "Users manage their own gym bag items" on public.gym_bag_items;
create policy "Users manage their own gym bag items"
  on public.gym_bag_items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. Pausenzeit pro Uebung
-- ---------------------------------------------------------------------------
-- Der Timer selbst laeuft rein im Browser. Persistiert wird nur, wie lange die
-- Pause bei dieser Uebung zuletzt war -- damit sie auf jedem Geraet gleich ist.

alter table public.fitness_plan_exercises
  add column if not exists rest_seconds integer;

alter table public.fitness_plan_exercises
  drop constraint if exists fitness_plan_exercises_rest_seconds_check;
alter table public.fitness_plan_exercises
  add constraint fitness_plan_exercises_rest_seconds_check
  check (rest_seconds is null or rest_seconds between 10 and 900);

-- ---------------------------------------------------------------------------
select pg_notify('pgrst', 'reload schema');
