-- Fitness Plan v1: 2er-Split, active workouts and history
create table if not exists public.fitness_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  position integer not null default 0,
  accent text not null default 'cyan',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fitness_plan_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.fitness_plans(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  muscle_group text not null default '',
  target_sets integer not null default 3 check (target_sets between 1 and 20),
  target_reps integer not null default 10 check (target_reps between 1 and 100),
  target_weight numeric(7,2) not null default 0 check (target_weight >= 0),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fitness_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.fitness_plans(id) on delete set null,
  plan_name_snapshot text not null,
  session_date date not null default current_date,
  status text not null default 'active' check (status in ('active','completed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.fitness_session_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.fitness_sessions(id) on delete cascade,
  plan_exercise_id uuid references public.fitness_plan_exercises(id) on delete set null,
  exercise_name text not null,
  muscle_group text not null default '',
  target_sets integer not null,
  target_reps integer not null,
  actual_weight numeric(7,2) not null default 0 check (actual_weight >= 0),
  is_completed boolean not null default false,
  completed_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fitness_plans_user_position_idx on public.fitness_plans(user_id,position);
create index if not exists fitness_plan_exercises_plan_position_idx on public.fitness_plan_exercises(plan_id,position);
create index if not exists fitness_sessions_user_started_idx on public.fitness_sessions(user_id,started_at desc);
create index if not exists fitness_session_exercises_session_position_idx on public.fitness_session_exercises(session_id,position);

alter table public.fitness_plans enable row level security;
alter table public.fitness_plan_exercises enable row level security;
alter table public.fitness_sessions enable row level security;
alter table public.fitness_session_exercises enable row level security;

drop policy if exists "Users manage their own fitness plans" on public.fitness_plans;
create policy "Users manage their own fitness plans" on public.fitness_plans
  for all
  using (auth.uid()=user_id)
  with check (auth.uid()=user_id);

drop policy if exists "Users manage their own plan exercises" on public.fitness_plan_exercises;
create policy "Users manage their own plan exercises" on public.fitness_plan_exercises
  for all
  using (
    auth.uid()=user_id
    and exists (
      select 1 from public.fitness_plans plan
      where plan.id=plan_id and plan.user_id=auth.uid()
    )
  )
  with check (
    auth.uid()=user_id
    and exists (
      select 1 from public.fitness_plans plan
      where plan.id=plan_id and plan.user_id=auth.uid()
    )
  );

drop policy if exists "Users manage their own fitness sessions" on public.fitness_sessions;
create policy "Users manage their own fitness sessions" on public.fitness_sessions
  for all
  using (auth.uid()=user_id)
  with check (
    auth.uid()=user_id
    and (
      plan_id is null
      or exists (
        select 1 from public.fitness_plans plan
        where plan.id=plan_id and plan.user_id=auth.uid()
      )
    )
  );

drop policy if exists "Users manage their own session exercises" on public.fitness_session_exercises;
create policy "Users manage their own session exercises" on public.fitness_session_exercises
  for all
  using (
    auth.uid()=user_id
    and exists (
      select 1 from public.fitness_sessions session
      where session.id=session_id and session.user_id=auth.uid()
    )
  )
  with check (
    auth.uid()=user_id
    and exists (
      select 1 from public.fitness_sessions session
      where session.id=session_id and session.user_id=auth.uid()
    )
    and (
      plan_exercise_id is null
      or exists (
        select 1 from public.fitness_plan_exercises exercise
        where exercise.id=plan_exercise_id and exercise.user_id=auth.uid()
      )
    )
  );
