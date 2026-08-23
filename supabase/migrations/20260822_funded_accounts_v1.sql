-- CPRB Funded-Account-Tracking v1
-- Additiv: drei neue Tabellen, zwei neue Spalten an trades. Nichts Bestehendes wird verändert.
-- Gespeichert wird nur, was kein Rechenergebnis ist. Kontostand, Puffer, Fortschritt und
-- Drawdown rechnet der Client bei jedem Render aus den Trades neu — sonst lügt die Karte,
-- sobald ein Trade korrigiert wird.

create table if not exists public.funded_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 80),
  firm text not null default '' check (char_length(firm) <= 80),
  account_size numeric(18, 2) not null check (account_size > 0),
  fee_usd numeric(18, 2) not null default 0 check (fee_usd >= 0),
  profit_split_percent numeric(5, 2) not null default 80
    check (profit_split_percent >= 0 and profit_split_percent <= 100),
  default_drawdown_mode text not null default 'static'
    check (default_drawdown_mode in ('static', 'trailing')),
  is_default boolean not null default false,
  purchased_on date not null default current_date,
  archived_at timestamptz,
  note text not null default '' check (char_length(note) <= 1000),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Bewusst keine status-Spalte am Konto: ob es läuft, verbrannt oder funded ist, steckt
-- vollständig in der aktuellen Phase. Zwei Quellen für denselben Zustand driften auseinander.
create unique index if not exists funded_accounts_one_default_idx
  on public.funded_accounts (user_id)
  where is_default;

create index if not exists funded_accounts_user_board_idx
  on public.funded_accounts (user_id, position, created_at)
  where archived_at is null;

create table if not exists public.funded_phases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.funded_accounts(id) on delete cascade,
  phase_type text not null default 'phase1'
    check (phase_type in ('phase1', 'phase2', 'funded')),
  attempt integer not null default 1 check (attempt between 1 and 50),
  start_balance numeric(18, 2) not null check (start_balance > 0),
  profit_target_usd numeric(18, 2)
    check (profit_target_usd is null or profit_target_usd > 0),
  daily_loss_limit_usd numeric(18, 2) not null check (daily_loss_limit_usd > 0),
  max_loss_usd numeric(18, 2) not null check (max_loss_usd > 0),
  drawdown_mode text not null default 'static'
    check (drawdown_mode in ('static', 'trailing')),
  min_trading_days integer not null default 0 check (min_trading_days between 0 and 60),
  max_trading_days integer check (max_trading_days is null or max_trading_days > 0),
  started_on date not null default current_date,
  ended_on date,
  status text not null default 'active' check (status in ('active', 'passed', 'failed')),
  failed_reason text not null default ''
    check (failed_reason in ('', 'daily_loss', 'max_loss', 'time', 'manual')),
  failed_on date,
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_on is null or ended_on >= started_on)
);

-- Ziele und Limits stehen absolut in USD an der Phase, nicht in Prozent am Konto:
-- "Prozent wovon" beantwortet jede Firma anders, und abgeschlossene Phasen sollen historisch
-- richtig bleiben, wenn die Firma ihre Regeln ändert.
create unique index if not exists funded_phases_one_active_per_account_idx
  on public.funded_phases (account_id)
  where status = 'active';

create index if not exists funded_phases_account_order_idx
  on public.funded_phases (user_id, account_id, started_on desc, created_at desc);

create table if not exists public.funded_payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.funded_accounts(id) on delete cascade,
  phase_id uuid references public.funded_phases(id) on delete set null,
  payout_date date not null default current_date,
  gross_usd numeric(18, 2) not null check (gross_usd >= 0),
  payout_usd numeric(18, 2) not null check (payout_usd >= 0),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);

-- Zwei Beträge, weil sie sich unterscheiden: gross_usd verlässt das Konto und senkt den
-- Kontostand, payout_usd ist das, was nach Split und Gebühren ankommt.
create index if not exists funded_payouts_account_date_idx
  on public.funded_payouts (user_id, account_id, payout_date desc);

alter table public.funded_accounts enable row level security;
alter table public.funded_phases enable row level security;
alter table public.funded_payouts enable row level security;

drop policy if exists "Users manage their own funded accounts" on public.funded_accounts;
create policy "Users manage their own funded accounts"
  on public.funded_accounts
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Zusätzlich der Nachweis auf das Elternkonto, damit eine Phase nicht unter ein fremdes
-- Konto gehängt werden kann — dasselbe Muster wie fitness_plan_exercises gegen fitness_plans.
drop policy if exists "Users manage their own funded phases" on public.funded_phases;
create policy "Users manage their own funded phases"
  on public.funded_phases
  for all
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.funded_accounts account
      where account.id = funded_phases.account_id
        and account.user_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.funded_accounts account
      where account.id = funded_phases.account_id
        and account.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users manage their own funded payouts" on public.funded_payouts;
create policy "Users manage their own funded payouts"
  on public.funded_payouts
  for all
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.funded_accounts account
      where account.id = funded_payouts.account_id
        and account.user_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.funded_accounts account
      where account.id = funded_payouts.account_id
        and account.user_id = (select auth.uid())
    )
  );

-- Beide IDs am Trade, obwohl die Phase ihr Konto kennt: wird eine Phase aufgeräumt, soll der
-- Trade sein Konto nicht mitverlieren (on delete set null). funded_phase_id is null heißt
-- "privater Trade" — er zählt weiter im Journal und in stats.js, aber nie in der Funded-Auswertung.
alter table public.trades
  add column if not exists funded_account_id uuid
    references public.funded_accounts(id) on delete set null,
  add column if not exists funded_phase_id uuid
    references public.funded_phases(id) on delete set null;

create index if not exists trades_funded_phase_idx
  on public.trades (user_id, funded_phase_id, trade_date);

select pg_notify('pgrst', 'reload schema');
