-- CPRB Pencil Notes v1

alter table public.notes
  add column if not exists note_type text not null default 'text',
  add column if not exists drawing_path text,
  add column if not exists paper_style text not null default 'lined',
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='notes_note_type_check'
      and conrelid='public.notes'::regclass
  ) then
    alter table public.notes
      add constraint notes_note_type_check
      check (note_type in ('text','handwriting'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname='notes_paper_style_check'
      and conrelid='public.notes'::regclass
  ) then
    alter table public.notes
      add constraint notes_paper_style_check
      check (paper_style in ('lined','grid','dotted','blank'));
  end if;
end $$;

create index if not exists notes_user_type_updated_idx
  on public.notes(user_id,note_type,updated_at desc);

comment on column public.notes.drawing_path is
  'Private vector stroke data stored in northstar-media under the user folder';

select pg_notify('pgrst','reload schema');
