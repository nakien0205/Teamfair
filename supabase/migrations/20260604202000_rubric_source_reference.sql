alter table if exists public.rubrics
  add column if not exists source_rubric_id uuid references public.rubrics(id) on delete set null;

create index if not exists rubrics_source_rubric_id_idx
  on public.rubrics(source_rubric_id);
