-- CPRB Hydration Smart Reminders v1

alter table public.reminder_settings
  add column if not exists hydration_enabled boolean not null default true;
