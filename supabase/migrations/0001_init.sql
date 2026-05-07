-- 3dfy initial schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).

create extension if not exists "pgcrypto";

-- =========================================================================
-- jobs table
-- =========================================================================
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  model text not null check (
    model in ('tripo3d/p1/image-to-3d', 'tripo3d/h3.1/image-to-3d')
  ),
  options jsonb not null default '{}'::jsonb,
  input_image_path text not null,
  fal_request_id text,
  status text not null default 'queued'
    check (status in ('queued','in_progress','completed','failed')),
  model_glb_path text,
  model_pbr_glb_path text,
  preview_image_url text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_user_created_idx
  on public.jobs (user_id, created_at desc);

create index if not exists jobs_status_idx
  on public.jobs (status);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

-- RLS
alter table public.jobs enable row level security;

drop policy if exists "jobs are private to their owner" on public.jobs;
create policy "jobs are private to their owner"
  on public.jobs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Realtime
alter publication supabase_realtime add table public.jobs;

-- =========================================================================
-- Storage buckets
-- =========================================================================
insert into storage.buckets (id, name, public)
values ('inputs', 'inputs', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('models', 'models', false)
on conflict (id) do nothing;

-- Per-user folder policies on inputs bucket
drop policy if exists "users can read own inputs" on storage.objects;
create policy "users can read own inputs"
  on storage.objects for select
  using (
    bucket_id = 'inputs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "users can upload own inputs" on storage.objects;
create policy "users can upload own inputs"
  on storage.objects for insert
  with check (
    bucket_id = 'inputs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "users can delete own inputs" on storage.objects;
create policy "users can delete own inputs"
  on storage.objects for delete
  using (
    bucket_id = 'inputs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Per-user folder policies on models bucket (read only via signed URLs / API)
drop policy if exists "users can read own models" on storage.objects;
create policy "users can read own models"
  on storage.objects for select
  using (
    bucket_id = 'models'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
-- Note: writes to `models` happen from the webhook with the service role key,
-- which bypasses RLS, so we don't need an INSERT policy here.
