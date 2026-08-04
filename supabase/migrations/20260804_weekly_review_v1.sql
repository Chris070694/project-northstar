-- CPRB Weekly Review v1: one persistent reflection and plan per user/week
create table if not exists public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  rating smallint not null default 7 check (rating between 1 and 10),
  wins text not null default '',
  challenges text not null default '',
  learning text not null default '',
  next_week_focus text not null default '',
  priority_one text not null default '',
  priority_two text not null default '',
  priority_three text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id,week_start)
);

create index if not exists weekly_reviews_user_week_idx
  on public.weekly_reviews(user_id,week_start desc);

alter table public.weekly_reviews enable row level security;

drop policy if exists "Users manage their own weekly reviews" on public.weekly_reviews;
create policy "Users manage their own weekly reviews"
  on public.weekly_reviews
  for all
  using (auth.uid()=user_id)
  with check (auth.uid()=user_id);
