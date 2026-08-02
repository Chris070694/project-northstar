
-- NORTHSTAR MAIN v0.3.1
-- Only needed if v0.3 migration was not already run.
create table if not exists public.daily_focus (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  focus_date date not null default current_date,
  main_focus text, trading_focus text, fitness_focus text, learning_focus text,
  next_action text, reflection text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, focus_date)
);

create table if not exists public.vision_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  title text not null,
  goal_type text not null default 'short' check (goal_type in ('short','long')),
  category text default 'Persönlich',
  why_text text,
  next_action text,
  current_value numeric not null default 0,
  target_value numeric not null default 100,
  target_date date,
  image_path text
);

alter table public.daily_focus enable row level security;
alter table public.vision_goals enable row level security;

drop policy if exists "daily focus own rows" on public.daily_focus;
create policy "daily focus own rows" on public.daily_focus
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "vision goals own rows" on public.vision_goals;
create policy "vision goals own rows" on public.vision_goals
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('northstar-media','northstar-media',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
