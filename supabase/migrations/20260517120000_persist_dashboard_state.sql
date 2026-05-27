-- Persist dashboard data that was previously only held in TeamContext.

CREATE OR REPLACE FUNCTION public.current_user_role ()
  RETURNS public.user_role
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
  SELECT
    role
  FROM
    public.users
  WHERE
    id = auth.uid ();

$$;

CREATE OR REPLACE FUNCTION public.is_admin ()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
  SELECT
    public.current_user_role () = 'admin'::public.user_role;

$$;

CREATE OR REPLACE FUNCTION public.is_lecturer_of_group (p_group_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
  SELECT
    EXISTS (
      SELECT
        1
      FROM
        public.groups g
      WHERE
        g.id = p_group_id
        AND g.lecturer_id = auth.uid ()
        AND public.current_user_role () = 'lecturer'::public.user_role);

$$;

CREATE OR REPLACE FUNCTION public.task_group_id (p_task_id uuid)
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
  SELECT
    group_id
  FROM
    public.tasks
  WHERE
    id = p_task_id;

$$;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS contribution_percent integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deadline date,
  ADD COLUMN IF NOT EXISTS priority text,
  ADD COLUMN IF NOT EXISTS evidence jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_contribution_percent_chk,
  ADD CONSTRAINT tasks_contribution_percent_chk CHECK (
    contribution_percent >= 0
    AND contribution_percent <= 100
  ),
  DROP CONSTRAINT IF EXISTS tasks_priority_chk,
  ADD CONSTRAINT tasks_priority_chk CHECK (
    priority IS NULL
    OR priority IN ('Low', 'Medium', 'High')
  ),
  DROP CONSTRAINT IF EXISTS tasks_evidence_array_chk,
  ADD CONSTRAINT tasks_evidence_array_chk CHECK (jsonb_typeof(evidence) = 'array');

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_logs_group_id_idx ON public.activity_logs (group_id);

CREATE TABLE IF NOT EXISTS public.student_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  reporter_id uuid REFERENCES public.users (id) ON DELETE SET NULL DEFAULT auth.uid (),
  from_name text NOT NULL,
  to_name text NOT NULL,
  reason text NOT NULL,
  notes text,
  reviewed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS student_reports_group_id_idx ON public.student_reports (group_id);

CREATE TABLE IF NOT EXISTS public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  uploader_id uuid REFERENCES public.users (id) ON DELETE SET NULL DEFAULT auth.uid (),
  file_name text NOT NULL,
  file_size integer NOT NULL,
  uploaded_by_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT materials_file_size_chk CHECK (file_size >= 0)
);

CREATE INDEX IF NOT EXISTS materials_group_id_idx ON public.materials (group_id);

CREATE TABLE IF NOT EXISTS public.lecturer_student_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  lecturer_id uuid REFERENCES public.users (id) ON DELETE SET NULL DEFAULT auth.uid (),
  student_name text NOT NULL,
  rating integer NOT NULL,
  comment text,
  award_badge boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lecturer_student_reviews_rating_chk CHECK (
    rating >= 1
    AND rating <= 5
  )
);

CREATE INDEX IF NOT EXISTS lecturer_student_reviews_group_id_idx ON public.lecturer_student_reviews (group_id);

CREATE TABLE IF NOT EXISTS public.verified_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  lecturer_id uuid REFERENCES public.users (id) ON DELETE SET NULL DEFAULT auth.uid (),
  student_name text NOT NULL,
  rating integer NOT NULL,
  comment text,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  link text NOT NULL DEFAULT 'https://www.linkedin.com/',
  CONSTRAINT verified_badges_rating_chk CHECK (
    rating >= 1
    AND rating <= 5
  )
);

CREATE INDEX IF NOT EXISTS verified_badges_group_id_idx ON public.verified_badges (group_id);

CREATE TABLE IF NOT EXISTS public.lecturer_scores (
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  student_name text NOT NULL,
  lecturer_id uuid REFERENCES public.users (id) ON DELETE SET NULL DEFAULT auth.uid (),
  score numeric(4, 2) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, student_name),
  CONSTRAINT lecturer_scores_score_chk CHECK (
    score >= 0
    AND score <= 10
  )
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.student_reports ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.lecturer_student_reviews ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.verified_badges ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.lecturer_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY activity_logs_select ON public.activity_logs
  FOR SELECT
  USING (public.is_admin () OR public.is_lecturer_of_group (group_id) OR public.is_student_member_of_group (group_id));

CREATE POLICY activity_logs_insert ON public.activity_logs
  FOR INSERT
  WITH CHECK (public.is_admin () OR public.is_lecturer_of_group (group_id) OR public.is_student_member_of_group (group_id));

CREATE POLICY activity_logs_delete ON public.activity_logs
  FOR DELETE
  USING (public.is_admin () OR public.is_lecturer_of_group (group_id));

CREATE POLICY student_reports_select ON public.student_reports
  FOR SELECT
  USING (public.is_admin () OR public.is_lecturer_of_group (group_id));

CREATE POLICY student_reports_insert ON public.student_reports
  FOR INSERT
  WITH CHECK (public.is_admin () OR public.is_lecturer_of_group (group_id) OR (reporter_id = auth.uid () AND public.is_student_member_of_group (group_id)));

CREATE POLICY student_reports_update ON public.student_reports
  FOR UPDATE
  USING (public.is_admin () OR public.is_lecturer_of_group (group_id))
  WITH CHECK (public.is_admin () OR public.is_lecturer_of_group (group_id));

CREATE POLICY student_reports_delete ON public.student_reports
  FOR DELETE
  USING (public.is_admin () OR public.is_lecturer_of_group (group_id));

CREATE POLICY materials_select ON public.materials
  FOR SELECT
  USING (public.is_admin () OR public.is_lecturer_of_group (group_id) OR public.is_student_member_of_group (group_id));

CREATE POLICY materials_insert ON public.materials
  FOR INSERT
  WITH CHECK (public.is_admin () OR public.is_lecturer_of_group (group_id) OR (uploader_id = auth.uid () AND public.is_student_member_of_group (group_id)));

CREATE POLICY materials_delete ON public.materials
  FOR DELETE
  USING (public.is_admin () OR public.is_lecturer_of_group (group_id));

CREATE POLICY lecturer_student_reviews_select ON public.lecturer_student_reviews
  FOR SELECT
  USING (public.is_admin () OR public.is_lecturer_of_group (group_id) OR public.is_student_member_of_group (group_id));

CREATE POLICY lecturer_student_reviews_insert ON public.lecturer_student_reviews
  FOR INSERT
  WITH CHECK (public.is_admin () OR (lecturer_id = auth.uid () AND public.is_lecturer_of_group (group_id)));

CREATE POLICY lecturer_student_reviews_update ON public.lecturer_student_reviews
  FOR UPDATE
  USING (public.is_admin () OR public.is_lecturer_of_group (group_id))
  WITH CHECK (public.is_admin () OR public.is_lecturer_of_group (group_id));

CREATE POLICY lecturer_student_reviews_delete ON public.lecturer_student_reviews
  FOR DELETE
  USING (public.is_admin () OR public.is_lecturer_of_group (group_id));

CREATE POLICY verified_badges_select ON public.verified_badges
  FOR SELECT
  USING (public.is_admin () OR public.is_lecturer_of_group (group_id) OR public.is_student_member_of_group (group_id));

CREATE POLICY verified_badges_insert ON public.verified_badges
  FOR INSERT
  WITH CHECK (public.is_admin () OR (lecturer_id = auth.uid () AND public.is_lecturer_of_group (group_id)));

CREATE POLICY verified_badges_update ON public.verified_badges
  FOR UPDATE
  USING (public.is_admin () OR public.is_lecturer_of_group (group_id))
  WITH CHECK (public.is_admin () OR public.is_lecturer_of_group (group_id));

CREATE POLICY verified_badges_delete ON public.verified_badges
  FOR DELETE
  USING (public.is_admin () OR public.is_lecturer_of_group (group_id));

CREATE POLICY lecturer_scores_select ON public.lecturer_scores
  FOR SELECT
  USING (public.is_admin () OR public.is_lecturer_of_group (group_id) OR public.is_student_member_of_group (group_id));

CREATE POLICY lecturer_scores_upsert ON public.lecturer_scores
  FOR INSERT
  WITH CHECK (public.is_admin () OR (lecturer_id = auth.uid () AND public.is_lecturer_of_group (group_id)));

CREATE POLICY lecturer_scores_update ON public.lecturer_scores
  FOR UPDATE
  USING (public.is_admin () OR public.is_lecturer_of_group (group_id))
  WITH CHECK (public.is_admin () OR public.is_lecturer_of_group (group_id));

CREATE POLICY lecturer_scores_delete ON public.lecturer_scores
  FOR DELETE
  USING (public.is_admin () OR public.is_lecturer_of_group (group_id));

GRANT EXECUTE ON FUNCTION public.current_user_role () TO authenticated;

GRANT EXECUTE ON FUNCTION public.is_admin () TO authenticated;

GRANT EXECUTE ON FUNCTION public.is_lecturer_of_group (uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.task_group_id (uuid) TO authenticated;

GRANT SELECT,
INSERT,
UPDATE,
DELETE ON TABLE public.activity_logs TO authenticated;

GRANT SELECT,
INSERT,
UPDATE,
DELETE ON TABLE public.student_reports TO authenticated;

GRANT SELECT,
INSERT,
UPDATE,
DELETE ON TABLE public.materials TO authenticated;

GRANT SELECT,
INSERT,
UPDATE,
DELETE ON TABLE public.lecturer_student_reviews TO authenticated;

GRANT SELECT,
INSERT,
UPDATE,
DELETE ON TABLE public.verified_badges TO authenticated;

GRANT SELECT,
INSERT,
UPDATE,
DELETE ON TABLE public.lecturer_scores TO authenticated;
