-- Safe rubric repair migration.
-- Aligns rubric RLS with the actual TeamFair schema and normalizes status fields.

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  db_role public.user_role;
  jwt_role text;
BEGIN
  SELECT role INTO db_role
  FROM public.users
  WHERE id = auth.uid();

  IF db_role IS NOT NULL THEN
    RETURN db_role;
  END IF;

  jwt_role := COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'app_role',
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role',
    auth.jwt() ->> 'role'
  );

  IF jwt_role IN ('student', 'lecturer', 'admin') THEN
    RETURN jwt_role::public.user_role;
  END IF;

  RETURN 'student'::public.user_role;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_lecturer_of_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.groups g
    WHERE g.id = p_project_id
  )
  AND (
    public.is_admin()
    OR public.current_user_role() = 'lecturer'::public.user_role
  );
$$;

ALTER TABLE IF EXISTS public.rubrics
  ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE IF EXISTS public.rubric_grades
  ALTER COLUMN status SET DEFAULT 'draft';

ALTER TABLE public.rubric_grades
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;

UPDATE public.rubrics
SET status = lower(status)
WHERE status IS NOT NULL
  AND status <> lower(status);

UPDATE public.rubric_grades
SET status = lower(status)
WHERE status IS NOT NULL
  AND status <> lower(status);

UPDATE public.rubric_grades
SET submitted_at = COALESCE(submitted_at, updated_at, created_at)
WHERE status = 'submitted'
  AND submitted_at IS NULL;

UPDATE public.rubric_grades
SET locked_at = COALESCE(locked_at, updated_at, created_at)
WHERE status = 'locked'
  AND locked_at IS NULL;

DROP POLICY IF EXISTS rubrics_select_admin ON public.rubrics;
DROP POLICY IF EXISTS rubrics_select_lecturer ON public.rubrics;
DROP POLICY IF EXISTS rubrics_insert ON public.rubrics;
DROP POLICY IF EXISTS rubrics_update ON public.rubrics;
DROP POLICY IF EXISTS rubrics_delete ON public.rubrics;

CREATE POLICY rubrics_select_admin ON public.rubrics
  FOR SELECT USING (public.is_admin());

CREATE POLICY rubrics_select_lecturer ON public.rubrics
  FOR SELECT USING (
    public.current_user_role() = 'lecturer'::public.user_role
    AND public.is_lecturer_of_project(project_id)
  );

CREATE POLICY rubrics_insert ON public.rubrics
  FOR INSERT WITH CHECK (
    public.is_admin()
    OR (
      public.current_user_role() = 'lecturer'::public.user_role
      AND public.is_lecturer_of_project(project_id)
    )
  );

CREATE POLICY rubrics_update ON public.rubrics
  FOR UPDATE USING (
    public.is_admin()
    OR (
      public.current_user_role() = 'lecturer'::public.user_role
      AND public.is_lecturer_of_project(project_id)
    )
  ) WITH CHECK (
    public.is_admin()
    OR (
      public.current_user_role() = 'lecturer'::public.user_role
      AND public.is_lecturer_of_project(project_id)
    )
  );

CREATE POLICY rubrics_delete ON public.rubrics
  FOR DELETE USING (
    public.is_admin()
    OR (
      public.current_user_role() = 'lecturer'::public.user_role
      AND public.is_lecturer_of_project(project_id)
    )
  );

DROP POLICY IF EXISTS templates_select_admin ON public.rubric_templates;
DROP POLICY IF EXISTS templates_select_lecturer ON public.rubric_templates;
DROP POLICY IF EXISTS templates_insert ON public.rubric_templates;
DROP POLICY IF EXISTS templates_update ON public.rubric_templates;
DROP POLICY IF EXISTS templates_delete ON public.rubric_templates;

CREATE POLICY templates_select_admin ON public.rubric_templates
  FOR SELECT USING (public.is_admin());

CREATE POLICY templates_select_lecturer ON public.rubric_templates
  FOR SELECT USING (
    public.current_user_role() = 'lecturer'::public.user_role
    AND EXISTS (
      SELECT 1
      FROM public.rubrics r
      WHERE r.id = rubric_templates.rubric_id
        AND public.is_lecturer_of_project(r.project_id)
    )
  );

CREATE POLICY templates_insert ON public.rubric_templates
  FOR INSERT WITH CHECK (
    public.is_admin()
    OR (
      public.current_user_role() = 'lecturer'::public.user_role
      AND EXISTS (
        SELECT 1
        FROM public.rubrics r
        WHERE r.id = rubric_templates.rubric_id
          AND public.is_lecturer_of_project(r.project_id)
      )
    )
  );

CREATE POLICY templates_update ON public.rubric_templates
  FOR UPDATE USING (
    public.is_admin()
    OR (
      public.current_user_role() = 'lecturer'::public.user_role
      AND EXISTS (
        SELECT 1
        FROM public.rubrics r
        WHERE r.id = rubric_templates.rubric_id
          AND public.is_lecturer_of_project(r.project_id)
      )
    )
  ) WITH CHECK (
    public.is_admin()
    OR (
      public.current_user_role() = 'lecturer'::public.user_role
      AND EXISTS (
        SELECT 1
        FROM public.rubrics r
        WHERE r.id = rubric_templates.rubric_id
          AND public.is_lecturer_of_project(r.project_id)
      )
    )
  );

CREATE POLICY templates_delete ON public.rubric_templates
  FOR DELETE USING (
    public.is_admin()
    OR (
      public.current_user_role() = 'lecturer'::public.user_role
      AND EXISTS (
        SELECT 1
        FROM public.rubrics r
        WHERE r.id = rubric_templates.rubric_id
          AND public.is_lecturer_of_project(r.project_id)
      )
    )
  );

DROP POLICY IF EXISTS grades_select_admin ON public.rubric_grades;
DROP POLICY IF EXISTS grades_select_lecturer ON public.rubric_grades;
DROP POLICY IF EXISTS grades_select_student ON public.rubric_grades;
DROP POLICY IF EXISTS grades_insert ON public.rubric_grades;
DROP POLICY IF EXISTS grades_update ON public.rubric_grades;
DROP POLICY IF EXISTS grades_delete ON public.rubric_grades;

CREATE POLICY grades_select_admin ON public.rubric_grades
  FOR SELECT USING (public.is_admin());

CREATE POLICY grades_select_lecturer ON public.rubric_grades
  FOR SELECT USING (
    public.current_user_role() = 'lecturer'::public.user_role
    AND public.is_lecturer_of_project(project_id)
  );

CREATE POLICY grades_select_student ON public.rubric_grades
  FOR SELECT USING (
    public.current_user_role() = 'student'::public.user_role
    AND status IN ('submitted', 'locked')
    AND EXISTS (
      SELECT 1
      FROM public.group_members gm
      WHERE gm.group_id = rubric_grades.group_id
        AND gm.student_id = auth.uid()
    )
  );

CREATE POLICY grades_insert ON public.rubric_grades
  FOR INSERT WITH CHECK (
    public.is_admin()
    OR (
      public.current_user_role() = 'lecturer'::public.user_role
      AND public.is_lecturer_of_project(project_id)
    )
  );

CREATE POLICY grades_update ON public.rubric_grades
  FOR UPDATE USING (
    public.is_admin()
    OR (
      public.current_user_role() = 'lecturer'::public.user_role
      AND public.is_lecturer_of_project(project_id)
    )
  ) WITH CHECK (
    public.is_admin()
    OR (
      public.current_user_role() = 'lecturer'::public.user_role
      AND public.is_lecturer_of_project(project_id)
    )
  );

CREATE POLICY grades_delete ON public.rubric_grades
  FOR DELETE USING (
    public.is_admin()
    OR (
      public.current_user_role() = 'lecturer'::public.user_role
      AND public.is_lecturer_of_project(project_id)
    )
  );

DROP POLICY IF EXISTS audit_logs_select_admin ON public.rubric_audit_logs;
DROP POLICY IF EXISTS audit_logs_select_lecturer ON public.rubric_audit_logs;
DROP POLICY IF EXISTS audit_logs_insert ON public.rubric_audit_logs;

CREATE POLICY audit_logs_select_admin ON public.rubric_audit_logs
  FOR SELECT USING (public.is_admin());

CREATE POLICY audit_logs_select_lecturer ON public.rubric_audit_logs
  FOR SELECT USING (
    public.current_user_role() = 'lecturer'::public.user_role
    AND user_id = auth.uid()
  );

CREATE POLICY audit_logs_insert ON public.rubric_audit_logs
  FOR INSERT WITH CHECK (
    public.is_admin()
    OR public.current_user_role() = 'lecturer'::public.user_role
  );

GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_lecturer_of_project(uuid) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
