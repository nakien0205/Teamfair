-- Migration to add selected_cells_json to rubric_grades table
-- Timestamp: 2026-06-11 15:00:00

ALTER TABLE public.rubric_grades
  ADD COLUMN IF NOT EXISTS selected_cells_json jsonb;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
