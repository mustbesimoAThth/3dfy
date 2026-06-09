-- =========================================================================
-- 0004 · Multi-image input support
-- =========================================================================
-- Adds a side table that holds 1..N input images per job, in order.
--
-- Why a side table (vs. an array column on jobs)?
--   * Lets us add per-image metadata later (e.g. caption, alpha mask)
--     without another migration.
--   * Keeps `jobs.input_image_path` as the "primary thumbnail" used by the
--     recent-jobs grid and asset?variant=input endpoint (back-compat).
--
-- Convention: every job (including legacy single-image rows) writes ALL of
-- its input paths here, ordered by `position`. Existing rows have no
-- job_inputs and the UI falls back to `jobs.input_image_path`.
-- =========================================================================

create table if not exists public.job_inputs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  image_path text not null,
  -- 0-based ordering. Hard cap of 16 protects us from buggy clients;
  -- the API enforces a per-model max (currently 4 for reconviagen).
  position int not null check (position >= 0 and position < 16),
  created_at timestamptz not null default now(),
  unique (job_id, position)
);

create index if not exists job_inputs_job_idx
  on public.job_inputs (job_id, position);

-- RLS — same per-owner rule as jobs.
alter table public.job_inputs enable row level security;

drop policy if exists "job_inputs are private to their owner" on public.job_inputs;
create policy "job_inputs are private to their owner"
  on public.job_inputs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
