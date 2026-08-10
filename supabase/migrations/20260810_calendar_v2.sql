-- CPRB Kalender v2: jährliche Termine und Push-Erinnerungen

alter table public.calendar_events
  add column if not exists recurrence text not null default 'none',
  add column if not exists reminder_enabled boolean not null default false,
  add column if not exists reminder_time time;

update public.calendar_events
set recurrence='none'
where recurrence is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='calendar_events_recurrence_check'
      and conrelid='public.calendar_events'::regclass
  ) then
    alter table public.calendar_events
      add constraint calendar_events_recurrence_check
      check (recurrence in ('none','yearly'));
  end if;
end $$;

create index if not exists calendar_events_reminders_idx
  on public.calendar_events(user_id,reminder_enabled,event_date,reminder_time)
  where reminder_enabled=true;

comment on column public.calendar_events.recurrence is
  'none = einmalig, yearly = jährlich am Monat und Tag von event_date';
comment on column public.calendar_events.reminder_time is
  'Lokale Erinnerungszeit in der Zeitzone aus reminder_settings';

select pg_notify('pgrst','reload schema');
