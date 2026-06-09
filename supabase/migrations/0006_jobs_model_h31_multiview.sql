-- =========================================================================
-- 0006 · Allow tripo3d/h3.1/multiview-to-3d in jobs.model
-- =========================================================================
-- Replaces the single-image "Advanced" tier (`tripo3d/h3.1/image-to-3d`)
-- with the documented multi-view variant from Tripo:
--   https://fal.ai/models/tripo3d/h3.1/multiview-to-3d
--
-- The single-image id stays in the check constraint so HISTORICAL job rows
-- created against it continue to satisfy the constraint and render their
-- model badge correctly. New generations from the UI use the multiview id.
-- =========================================================================

alter table public.jobs drop constraint if exists jobs_model_check;

alter table public.jobs add constraint jobs_model_check check (
  model in (
    'fal-ai/reconviagen-0.5',
    'tripo3d/p1/image-to-3d',
    'tripo3d/h3.1/image-to-3d',
    'tripo3d/h3.1/multiview-to-3d'
  )
);
