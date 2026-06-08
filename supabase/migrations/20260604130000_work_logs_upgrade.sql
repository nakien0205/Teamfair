ALTER TABLE public.contribution_logs
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS work_date date,
  ADD COLUMN IF NOT EXISTS evidence_link text,
  ADD COLUMN IF NOT EXISTS attachment jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.contribution_logs
SET
  group_id = COALESCE(group_id, public.task_group_id(task_id)),
  work_date = COALESCE(work_date, logged_at::date)
WHERE group_id IS NULL OR work_date IS NULL;

ALTER TABLE public.contribution_logs
  ALTER COLUMN task_id DROP NOT NULL,
  ALTER COLUMN group_id SET NOT NULL,
  ALTER COLUMN work_date SET NOT NULL;

ALTER TABLE public.contribution_logs
  DROP CONSTRAINT IF EXISTS contribution_logs_attachment_array_chk,
  ADD CONSTRAINT contribution_logs_attachment_array_chk CHECK (jsonb_typeof(attachment) = 'array'),
  DROP CONSTRAINT IF EXISTS contribution_logs_hours_chk,
  ADD CONSTRAINT contribution_logs_hours_chk CHECK (hours_spent > 0 AND hours_spent <= 24);

CREATE INDEX IF NOT EXISTS contribution_logs_group_id_idx ON public.contribution_logs (group_id);
CREATE INDEX IF NOT EXISTS contribution_logs_work_date_idx ON public.contribution_logs (work_date DESC);
CREATE INDEX IF NOT EXISTS contribution_logs_deleted_at_idx ON public.contribution_logs (deleted_at);

DROP POLICY IF EXISTS contribution_logs_select_admin ON public.contribution_logs;
DROP POLICY IF EXISTS contribution_logs_select_lecturer ON public.contribution_logs;
DROP POLICY IF EXISTS contribution_logs_select_student ON public.contribution_logs;
DROP POLICY IF EXISTS contribution_logs_insert_admin ON public.contribution_logs;
DROP POLICY IF EXISTS contribution_logs_insert_lecturer ON public.contribution_logs;
DROP POLICY IF EXISTS contribution_logs_insert_student ON public.contribution_logs;
DROP POLICY IF EXISTS contribution_logs_update_admin ON public.contribution_logs;
DROP POLICY IF EXISTS contribution_logs_update_lecturer ON public.contribution_logs;
DROP POLICY IF EXISTS contribution_logs_update_student ON public.contribution_logs;
DROP POLICY IF EXISTS contribution_logs_delete_admin ON public.contribution_logs;
DROP POLICY IF EXISTS contribution_logs_delete_lecturer ON public.contribution_logs;

CREATE POLICY contribution_logs_select_admin ON public.contribution_logs
  FOR SELECT
  USING (public.is_admin());

CREATE POLICY contribution_logs_select_lecturer ON public.contribution_logs
  FOR SELECT
  USING (public.is_lecturer_of_group(group_id));

CREATE POLICY contribution_logs_select_student ON public.contribution_logs
  FOR SELECT
  USING (
    public.current_user_role() = 'student'
    AND public.is_student_member_of_group(group_id)
  );

CREATE POLICY contribution_logs_insert_admin ON public.contribution_logs
  FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY contribution_logs_insert_lecturer ON public.contribution_logs
  FOR INSERT
  WITH CHECK (public.is_lecturer_of_group(group_id));

CREATE POLICY contribution_logs_insert_student ON public.contribution_logs
  FOR INSERT
  WITH CHECK (
    public.current_user_role() = 'student'
    AND student_id = auth.uid()
    AND public.is_student_member_of_group(group_id)
    AND (
      task_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.tasks t
        WHERE t.id = task_id
          AND t.group_id = contribution_logs.group_id
      )
    )
  );

CREATE POLICY contribution_logs_update_admin ON public.contribution_logs
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY contribution_logs_update_lecturer ON public.contribution_logs
  FOR UPDATE
  USING (public.is_lecturer_of_group(group_id))
  WITH CHECK (public.is_lecturer_of_group(group_id));

CREATE POLICY contribution_logs_update_student ON public.contribution_logs
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

CREATE POLICY contribution_logs_delete_admin ON public.contribution_logs
  FOR DELETE
  USING (public.is_admin());

CREATE POLICY contribution_logs_delete_lecturer ON public.contribution_logs
  FOR DELETE
  USING (public.is_lecturer_of_group(group_id));
