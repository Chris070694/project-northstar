-- CPRB private PDF library v1

create table if not exists public.library_books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 180),
  author text not null default '' check (char_length(author)<=160),
  category text not null default 'Andere' check (char_length(category)<=80),
  description text not null default '' check (char_length(description)<=2000),
  pdf_path text not null unique,
  cover_path text,
  file_name text not null default '',
  file_size bigint not null default 0 check (file_size>=0),
  total_pages integer not null default 1 check (total_pages>0),
  current_page integer not null default 1 check (current_page>0),
  last_opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_page<=total_pages)
);

create index if not exists library_books_user_created_idx
  on public.library_books(user_id,created_at desc);
create index if not exists library_books_user_last_opened_idx
  on public.library_books(user_id,last_opened_at desc nulls last);

alter table public.library_books enable row level security;
drop policy if exists "Users manage their own library books" on public.library_books;
create policy "Users manage their own library books"
  on public.library_books
  for all
  to authenticated
  using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'northstar-library',
  'northstar-library',
  false,
  52428800,
  array['application/pdf','image/webp','image/jpeg','image/png']
)
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Users read their own library files" on storage.objects;
create policy "Users read their own library files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id='northstar-library'
    and (storage.foldername(name))[1]=(select auth.uid()::text)
  );

drop policy if exists "Users upload their own library files" on storage.objects;
create policy "Users upload their own library files"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id='northstar-library'
    and (storage.foldername(name))[1]=(select auth.uid()::text)
  );

drop policy if exists "Users update their own library files" on storage.objects;
create policy "Users update their own library files"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id='northstar-library'
    and (storage.foldername(name))[1]=(select auth.uid()::text)
  )
  with check (
    bucket_id='northstar-library'
    and (storage.foldername(name))[1]=(select auth.uid()::text)
  );

drop policy if exists "Users delete their own library files" on storage.objects;
create policy "Users delete their own library files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id='northstar-library'
    and (storage.foldername(name))[1]=(select auth.uid()::text)
  );
