-- ============================================================
-- Migration: contribution_ai_analysis
-- Stores cached AI analysis results per student per group.
-- ============================================================

-- Table
CREATE TABLE IF NOT EXISTS public.contribution_ai_analysis (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL,
  analysis_json jsonb NOT NULL DEFAULT '{}',
  data_hash text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, group_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS contribution_ai_analysis_student_idx
  ON public.contribution_ai_analysis(student_id);
CREATE INDEX IF NOT EXISTS contribution_ai_analysis_group_idx
  ON public.contribution_ai_analysis(group_id);

-- RLS
ALTER TABLE public.contribution_ai_analysis ENABLE ROW LEVEL SECURITY;

-- Students can read their own analysis
CREATE POLICY contribution_ai_analysis_select_own
  ON public.contribution_ai_analysis
  FOR SELECT
  USING (auth.uid() = student_id);

-- Students can insert their own analysis
CREATE POLICY contribution_ai_analysis_insert_own
  ON public.contribution_ai_analysis
  FOR INSERT
  WITH CHECK (auth.uid() = student_id);

-- Students can update their own analysis
CREATE POLICY contribution_ai_analysis_update_own
  ON public.contribution_ai_analysis
  FOR UPDATE
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_contribution_ai_analysis_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contribution_ai_analysis_touch_updated_at ON public.contribution_ai_analysis;
CREATE TRIGGER contribution_ai_analysis_touch_updated_at
  BEFORE UPDATE ON public.contribution_ai_analysis
  FOR EACH ROW
EXECUTE FUNCTION public.touch_contribution_ai_analysis_updated_at();
