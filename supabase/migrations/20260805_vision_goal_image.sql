-- Add goal images safely for databases where vision_goals already existed
alter table public.vision_goals
  add column if not exists image_path text;

-- Refresh the PostgREST schema cache immediately.
select pg_notify('pgrst','reload schema');
