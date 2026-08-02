
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  title text not null,
  category text default 'Allgemein',
  content text,
  image_path text
);

create table if not exists public.fitness_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  muscle_group text,
  default_sets integer default 3,
  default_reps integer default 10,
  default_weight numeric default 0
);

alter table public.notes enable row level security;
alter table public.fitness_exercises enable row level security;

drop policy if exists "own notes" on public.notes;
create policy "own notes" on public.notes
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "own fitness exercises" on public.fitness_exercises;
create policy "own fitness exercises" on public.fitness_exercises
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);
