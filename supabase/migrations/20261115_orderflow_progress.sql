/* Orderflow-Bootcamp: Lernfortschritt.

   Der Kursinhalt steht fest im Code (modules/orderflow-data.js). Gespeichert wird
   nur, was Christian schon gelesen und wie er im Quiz geantwortet hat — eine Zeile
   pro Nutzer, damit iPhone, iPad und Mac denselben Stand sehen.

   read:    { "1.1": "2026-11-15", ... }   Lektion -> Datum des ersten Lesens
   answers: { "1-3": true, "5-2": false }  Quizfrage -> zuletzt richtig/falsch */

create table if not exists public.orderflow_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  read jsonb not null default '{}'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.orderflow_progress enable row level security;

drop policy if exists "orderflow_progress eigene lesen" on public.orderflow_progress;
create policy "orderflow_progress eigene lesen" on public.orderflow_progress
  for select using ((select auth.uid()) = user_id);
drop policy if exists "orderflow_progress eigene anlegen" on public.orderflow_progress;
create policy "orderflow_progress eigene anlegen" on public.orderflow_progress
  for insert with check ((select auth.uid()) = user_id);
drop policy if exists "orderflow_progress eigene aendern" on public.orderflow_progress;
create policy "orderflow_progress eigene aendern" on public.orderflow_progress
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "orderflow_progress eigene loeschen" on public.orderflow_progress;
create policy "orderflow_progress eigene loeschen" on public.orderflow_progress
  for delete using ((select auth.uid()) = user_id);

comment on table public.orderflow_progress is
  'Lernfortschritt im Orderflow-Bootcamp: gelesene Lektionen und Quiz-Antworten je Nutzer.';

notify pgrst, 'reload schema';
