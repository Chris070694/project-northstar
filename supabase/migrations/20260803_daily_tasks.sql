-- Daily Focus task checklist
create table if not exists public.daily_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_date date not null default current_date,
  title text not null check (char_length(trim(title)) between 1 and 180),
  category text not null default 'Allgemein',
  is_completed boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists daily_tasks_user_date_position_idx
  on public.daily_tasks (user_id, task_date, position, created_at);

alter table public.daily_tasks enable row level security;

create policy "Users can manage their own daily tasks"
  on public.daily_tasks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
