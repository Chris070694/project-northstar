
-- NORTHSTAR v0.3.3: Academy + Kalender
-- Als neue Query in Supabase ausführen.

create table if not exists public.academy_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  category text not null default 'Market Structure',
  definition text,
  rules text,
  example_text text,
  mistakes text,
  checklist text,
  tags text[] not null default '{}',
  image_path text
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  title text not null,
  event_date date not null,
  start_time time,
  end_time time,
  category text not null default 'Privat',
  description text,
  completed boolean not null default false
);

alter table public.academy_notes enable row level security;
alter table public.calendar_events enable row level security;

drop policy if exists "own academy notes" on public.academy_notes;
create policy "own academy notes" on public.academy_notes
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "own calendar events" on public.calendar_events;
create policy "own calendar events" on public.calendar_events
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists academy_notes_user_category_idx
on public.academy_notes(user_id, category);

create index if not exists calendar_events_user_date_idx
on public.calendar_events(user_id, event_date);
