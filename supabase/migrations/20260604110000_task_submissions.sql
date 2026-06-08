CREATE OR REPLACE FUNCTION public.is_student_leader_of_group(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members m
    WHERE m.group_id = p_group_id
      AND m.student_id = auth.uid()
      AND COALESCE(m.role, 'Member') = 'Leader'
  );
$$;

CREATE TABLE IF NOT EXISTS public.task_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  submission_note text NOT NULL,
  evidence_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_files jsonb NOT NULL DEFAULT '[]'::jsonb,
  checklist_confirmed boolean NOT NULL DEFAULT false,
  late_reason text,
  is_late boolean NOT NULL DEFAULT false,
  submission_status text NOT NULL DEFAULT 'pending_review',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_submissions_note_len_chk CHECK (char_length(submission_note) BETWEEN 20 AND 1000),
  CONSTRAINT task_submissions_links_array_chk CHECK (jsonb_typeof(evidence_links) = 'array'),
  CONSTRAINT task_submissions_files_array_chk CHECK (jsonb_typeof(evidence_files) = 'array'),
  CONSTRAINT task_submissions_status_chk CHECK (submission_status IN ('pending_review', 'approved', 'need_revision', 'rejected'))
);

CREATE INDEX IF NOT EXISTS task_submissions_task_id_idx ON public.task_submissions(task_id);
CREATE INDEX IF NOT EXISTS task_submissions_group_id_idx ON public.task_submissions(group_id);
CREATE INDEX IF NOT EXISTS task_submissions_student_id_idx ON public.task_submissions(student_id);
CREATE INDEX IF NOT EXISTS task_submissions_submitted_at_idx ON public.task_submissions(submitted_at DESC);

ALTER TABLE public.task_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_submissions_select_admin ON public.task_submissions
  FOR SELECT
  USING (public.is_admin());

CREATE POLICY task_submissions_select_lecturer ON public.task_submissions
  FOR SELECT
  USING (public.is_lecturer_of_group(group_id));

CREATE POLICY task_submissions_select_student ON public.task_submissions
  FOR SELECT
  USING (
    public.current_user_role() = 'student'
    AND (
      student_id = auth.uid()
      OR public.is_student_leader_of_group(group_id)
    )
  );

CREATE POLICY task_submissions_insert_admin ON public.task_submissions
  FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY task_submissions_insert_lecturer ON public.task_submissions
  FOR INSERT
  WITH CHECK (public.is_lecturer_of_group(group_id));

CREATE POLICY task_submissions_insert_student ON public.task_submissions
  FOR INSERT
  WITH CHECK (
    public.current_user_role() = 'student'
    AND student_id = auth.uid()
    AND public.is_student_member_of_group(group_id)
  );

CREATE POLICY task_submissions_update_admin ON public.task_submissions
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY task_submissions_update_lecturer ON public.task_submissions
  FOR UPDATE
  USING (public.is_lecturer_of_group(group_id))
  WITH CHECK (public.is_lecturer_of_group(group_id));

CREATE POLICY task_submissions_update_student ON public.task_submissions
  FOR UPDATE
  USING (
    public.current_user_role() = 'student'
    AND student_id = auth.uid()
    AND public.is_student_member_of_group(group_id)
  )
  WITH CHECK (
    public.current_user_role() = 'student'
    AND student_id = auth.uid()
    AND public.is_student_member_of_group(group_id)
  );

CREATE POLICY task_submissions_delete_admin ON public.task_submissions
  FOR DELETE
  USING (public.is_admin());

CREATE POLICY task_submissions_delete_lecturer ON public.task_submissions
  FOR DELETE
  USING (public.is_lecturer_of_group(group_id));

GRANT EXECUTE ON FUNCTION public.is_student_leader_of_group(uuid) TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.task_submissions TO authenticated;
