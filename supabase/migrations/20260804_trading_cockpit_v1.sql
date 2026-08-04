-- CPRB Trading Cockpit v1

alter table public.trades
  add column if not exists pre_trade_checklist jsonb not null default '{}'::jsonb,
  add column if not exists rule_score smallint not null default 0 check (rule_score between 0 and 100),
  add column if not exists rule_breaks text[] not null default '{}'::text[],
  add column if not exists account_balance_snapshot numeric(18,2),
  add column if not exists risk_percent numeric(8,4),
  add column if not exists contract_value numeric(18,6),
  add column if not exists position_size numeric(24,8),
  add column if not exists emotion_after text not null default '',
  add column if not exists execution_score smallint check (execution_score between 1 and 10);

create table if not exists public.trading_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_balance numeric(18,2) not null default 10000 check (account_balance>=0),
  default_risk_percent numeric(8,4) not null default 0.25 check (default_risk_percent>0 and default_risk_percent<=5),
  contract_value numeric(18,6) not null default 100 check (contract_value>0),
  daily_loss_limit_r numeric(8,2) not null default 2 check (daily_loss_limit_r>0 and daily_loss_limit_r<=20),
  max_trades_per_day integer not null default 2 check (max_trades_per_day between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trading_settings enable row level security;

drop policy if exists "Users manage their own trading settings" on public.trading_settings;
create policy "Users manage their own trading settings"
  on public.trading_settings
  for all
  to authenticated
  using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);

create index if not exists trades_user_rule_score_idx
  on public.trades(user_id,rule_score);

create index if not exists trades_user_date_plan_idx
  on public.trades(user_id,trade_date,followed_plan);
