-- Trading Journal v2A: editing, review fields and chart screenshots
alter table public.trades add column if not exists result text;
alter table public.trades add column if not exists followed_plan boolean not null default false;
alter table public.trades add column if not exists setup_tags text[] not null default '{}';
alter table public.trades add column if not exists mistakes text not null default '';
alter table public.trades add column if not exists learning text not null default '';
alter table public.trades add column if not exists before_image_path text;
alter table public.trades add column if not exists after_image_path text;
alter table public.trades add column if not exists updated_at timestamptz not null default now();

update public.trades
set result=case
  when coalesce(pnl_usd,0)>0 then 'win'
  when coalesce(pnl_usd,0)<0 then 'loss'
  else 'breakeven'
end
where result is null;

alter table public.trades alter column result set default 'open';
alter table public.trades alter column result set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='trades_result_check' and conrelid='public.trades'::regclass
  ) then
    alter table public.trades
      add constraint trades_result_check
      check (result in ('win','loss','breakeven','open'));
  end if;
end $$;

create index if not exists trades_user_date_idx on public.trades(user_id,trade_date desc);
create index if not exists trades_user_result_idx on public.trades(user_id,result);
