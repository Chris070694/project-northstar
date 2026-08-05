-- One dashboard priority per user and day
alter table public.daily_tasks
  add column if not exists is_priority boolean not null default false;

create unique index if not exists daily_tasks_one_priority_per_day_idx
  on public.daily_tasks (user_id, task_date)
  where is_priority;
