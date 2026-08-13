-- Tasks that stay visible until the user completes them
alter table public.daily_tasks
  add column if not exists keep_until_done boolean not null default false;

create index if not exists daily_tasks_open_persistent_idx
  on public.daily_tasks (user_id, task_date, created_at)
  where keep_until_done and not is_completed;

comment on column public.daily_tasks.keep_until_done is
  'Keeps an unfinished task visible across day and week boundaries until it is completed.';
