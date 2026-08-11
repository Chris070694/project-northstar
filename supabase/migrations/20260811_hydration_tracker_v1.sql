-- CPRB Hydration Tracker v1
-- Persistent daily goal + one hydration total per user/day.

create table if not exists public.hydration_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_goal_ml integer not null default 2500 check (daily_goal_ml between 500 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hydration_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  amount_ml integer not null default 0 check (amount_ml between 0 and 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

create index if not exists hydration_days_user_day_idx
  on public.hydration_days(user_id, day desc);

alter table public.hydration_settings enable row level security;
alter table public.hydration_days enable row level security;

drop policy if exists "Users manage their own hydration settings" on public.hydration_settings;
create policy "Users manage their own hydration settings"
  on public.hydration_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage their own hydration days" on public.hydration_days;
create policy "Users manage their own hydration days"
  on public.hydration_days
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
