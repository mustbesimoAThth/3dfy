-- Allow fal-ai/reconviagen-0.5 (and keep existing Tripo models) in jobs.model

alter table public.jobs drop constraint if exists jobs_model_check;

alter table public.jobs add constraint jobs_model_check check (
  model in (
    'fal-ai/reconviagen-0.5',
    'tripo3d/p1/image-to-3d',
    'tripo3d/h3.1/image-to-3d'
  )
);
