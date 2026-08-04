-- CPRB Habits & Smart Reminders v1

create table if not exists public.recurring_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 180),
  category text not null default 'Allgemein',
  frequency text not null default 'daily' check (frequency in ('daily')),
  starts_on date not null default current_date,
  ends_on date,
  is_active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on>=starts_on)
);

alter table public.daily_tasks
  add column if not exists source_recurring_task_id uuid references public.recurring_tasks(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='daily_tasks_recurring_instance_unique'
      and conrelid='public.daily_tasks'::regclass
  ) then
    alter table public.daily_tasks
      add constraint daily_tasks_recurring_instance_unique
      unique (user_id,task_date,source_recurring_task_id);
  end if;
end $$;

create index if not exists recurring_tasks_user_active_idx
  on public.recurring_tasks(user_id,is_active,starts_on);
create index if not exists daily_tasks_recurring_source_idx
  on public.daily_tasks(source_recurring_task_id);

alter table public.recurring_tasks enable row level security;
drop policy if exists "Users manage their own recurring tasks" on public.recurring_tasks;
create policy "Users manage their own recurring tasks"
  on public.recurring_tasks
  for all
  using (auth.uid()=user_id)
  with check (auth.uid()=user_id);

create table if not exists public.recurring_task_skips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recurring_task_id uuid not null references public.recurring_tasks(id) on delete cascade,
  skip_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id,recurring_task_id,skip_date)
);

create index if not exists recurring_task_skips_user_date_idx
  on public.recurring_task_skips(user_id,skip_date);

alter table public.recurring_task_skips enable row level security;
drop policy if exists "Users manage their own recurring task skips" on public.recurring_task_skips;
create policy "Users manage their own recurring task skips"
  on public.recurring_task_skips
  for all
  using (auth.uid()=user_id)
  with check (auth.uid()=user_id);

create table if not exists public.reminder_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'Europe/Vienna',
  daily_focus_enabled boolean not null default false,
  daily_focus_time time not null default '08:00',
  trading_enabled boolean not null default false,
  trading_time time not null default '08:30',
  fitness_enabled boolean not null default false,
  fitness_time time not null default '17:30',
  fitness_days smallint[] not null default '{1,3,5}',
  weekly_enabled boolean not null default false,
  weekly_day smallint not null default 0 check (weekly_day between 0 and 6),
  weekly_time time not null default '18:00',
  quiet_start time not null default '22:00',
  quiet_end time not null default '07:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_type text not null,
  delivery_key text not null,
  delivered_at timestamptz not null default now(),
  unique (user_id,reminder_type,delivery_key)
);

create table if not exists public.push_server_config (
  id smallint primary key default 1 check (id=1),
  public_key text not null,
  private_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
create index if not exists reminder_deliveries_user_idx on public.reminder_deliveries(user_id,delivered_at desc);

alter table public.reminder_settings enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reminder_deliveries enable row level security;
alter table public.push_server_config enable row level security;

drop policy if exists "Users manage their own reminder settings" on public.reminder_settings;
create policy "Users manage their own reminder settings"
  on public.reminder_settings
  for all
  using (auth.uid()=user_id)
  with check (auth.uid()=user_id);

drop policy if exists "Users manage their own push subscriptions" on public.push_subscriptions;
create policy "Users manage their own push subscriptions"
  on public.push_subscriptions
  for all
  using (auth.uid()=user_id)
  with check (auth.uid()=user_id);

-- reminder_deliveries and push_server_config intentionally have no client policies.
-- Only the service-role Edge Function can access them.
