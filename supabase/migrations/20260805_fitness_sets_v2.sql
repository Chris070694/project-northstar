-- Fitness v2: set-by-set progress, strict plan comparisons and future Watch imports
create table if not exists public.fitness_set_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.fitness_sessions(id) on delete cascade,
  session_exercise_id uuid not null references public.fitness_session_exercises(id) on delete cascade,
  plan_id uuid references public.fitness_plans(id) on delete set null,
  plan_exercise_id uuid references public.fitness_plan_exercises(id) on delete set null,
  set_number integer not null check (set_number between 1 and 50),
  target_reps integer not null default 0 check (target_reps between 0 and 200),
  actual_reps integer not null default 0 check (actual_reps between 0 and 200),
  weight_kg numeric(7,2) not null default 0 check (weight_kg >= 0),
  is_completed boolean not null default false,
  completed_at timestamptz,
  previous_session_id uuid references public.fitness_sessions(id) on delete set null,
  previous_weight_kg numeric(7,2) check (previous_weight_kg is null or previous_weight_kg >= 0),
  previous_reps integer check (previous_reps is null or previous_reps between 0 and 200),
  source text not null default 'app' check (source in ('app','watch','import')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_exercise_id,set_number)
);

create index if not exists fitness_set_logs_session_idx
  on public.fitness_set_logs(session_id,session_exercise_id,set_number);
create index if not exists fitness_set_logs_plan_exercise_idx
  on public.fitness_set_logs(user_id,plan_id,plan_exercise_id,completed_at desc);

alter table public.fitness_set_logs enable row level security;

drop policy if exists "Users manage their own fitness set logs" on public.fitness_set_logs;
create policy "Users manage their own fitness set logs" on public.fitness_set_logs
  for all
  using (
    auth.uid()=user_id
    and exists (
      select 1 from public.fitness_sessions session
      where session.id=session_id and session.user_id=auth.uid()
    )
    and exists (
      select 1 from public.fitness_session_exercises exercise
      where exercise.id=session_exercise_id
        and exercise.session_id=session_id
        and exercise.user_id=auth.uid()
    )
  )
  with check (
    auth.uid()=user_id
    and exists (
      select 1 from public.fitness_sessions session
      where session.id=session_id and session.user_id=auth.uid()
    )
    and exists (
      select 1 from public.fitness_session_exercises exercise
      where exercise.id=session_exercise_id
        and exercise.session_id=session_id
        and exercise.user_id=auth.uid()
    )
    and (
      plan_id is null
      or exists (
        select 1 from public.fitness_plans plan
        where plan.id=plan_id and plan.user_id=auth.uid()
      )
    )
    and (
      plan_exercise_id is null
      or exists (
        select 1 from public.fitness_plan_exercises exercise
        where exercise.id=plan_exercise_id and exercise.user_id=auth.uid()
      )
    )
  );

select pg_notify('pgrst','reload schema');
