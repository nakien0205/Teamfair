-- Rubric permission and visibility hardening.
-- Aligns rubric access with owner/admin rules and project-scoped visibility.

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
      AND g.lecturer_id = auth.uid()
  );
$$;

ALTER TABLE IF EXISTS public.rubrics
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'project';

UPDATE public.rubrics
SET visibility = 'project'
WHERE visibility IS NULL
   OR lower(visibility) NOT IN ('project', 'private');

ALTER TABLE IF EXISTS public.rubrics
  DROP CONSTRAINT IF EXISTS rubrics_visibility_check;

ALTER TABLE IF EXISTS public.rubrics
  ADD CONSTRAINT rubrics_visibility_check
  CHECK (visibility IN ('project', 'private'));

ALTER TABLE IF EXISTS public.rubrics
  DROP CONSTRAINT IF EXISTS rubrics_status_check;

ALTER TABLE IF EXISTS public.rubrics
  ADD CONSTRAINT rubrics_status_check
  CHECK (status IN ('active', 'archived'));

ALTER TABLE IF EXISTS public.rubric_grades
  DROP CONSTRAINT IF EXISTS rubric_grades_status_check;

ALTER TABLE IF EXISTS public.rubric_grades
  ADD CONSTRAINT rubric_grades_status_check
  CHECK (status IN ('draft', 'submitted', 'locked'));

DROP POLICY IF EXISTS rubrics_select_admin ON public.rubrics;
DROP POLICY IF EXISTS rubrics_select_lecturer ON public.rubrics;
DROP POLICY IF EXISTS rubrics_insert ON public.rubrics;
DROP POLICY IF EXISTS rubrics_update ON public.rubrics;
DROP POLICY IF EXISTS rubrics_delete ON public.rubrics;

CREATE POLICY rubrics_select_admin ON public.rubrics
  FOR SELECT USING (public.is_admin());

CREATE POLICY rubrics_select_owner_or_project_lecturer ON public.rubrics
  FOR SELECT USING (
    created_by = auth.uid()
    OR (
      visibility = 'project'
      AND public.current_user_role() = 'lecturer'::public.user_role
      AND public.is_lecturer_of_project(project_id)
    )
  );

CREATE POLICY rubrics_insert_owner_or_admin ON public.rubrics
  FOR INSERT WITH CHECK (
    public.is_admin()
    OR (
      public.current_user_role() = 'lecturer'::public.user_role
      AND public.is_lecturer_of_project(project_id)
      AND created_by = auth.uid()
    )
  );

CREATE POLICY rubrics_update_owner_or_admin ON public.rubrics
  FOR UPDATE USING (
    public.is_admin()
    OR created_by = auth.uid()
  ) WITH CHECK (
    public.is_admin()
    OR created_by = auth.uid()
  );

CREATE POLICY rubrics_delete_owner_or_admin ON public.rubrics
  FOR DELETE USING (
    public.is_admin()
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS templates_select_admin ON public.rubric_templates;
DROP POLICY IF EXISTS templates_select_lecturer ON public.rubric_templates;
DROP POLICY IF EXISTS templates_insert ON public.rubric_templates;
DROP POLICY IF EXISTS templates_update ON public.rubric_templates;
DROP POLICY IF EXISTS templates_delete ON public.rubric_templates;

CREATE POLICY templates_select_admin ON public.rubric_templates
  FOR SELECT USING (public.is_admin());

CREATE POLICY templates_select_follow_parent_rubric ON public.rubric_templates
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.rubrics r
      WHERE r.id = rubric_templates.rubric_id
        AND (
          r.created_by = auth.uid()
          OR (
            r.visibility = 'project'
            AND public.current_user_role() = 'lecturer'::public.user_role
            AND public.is_lecturer_of_project(r.project_id)
          )
        )
    )
  );

CREATE POLICY templates_insert_owner_or_admin ON public.rubric_templates
  FOR INSERT WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.rubrics r
      WHERE r.id = rubric_templates.rubric_id
        AND r.created_by = auth.uid()
    )
  );

CREATE POLICY templates_update_owner_or_admin ON public.rubric_templates
  FOR UPDATE USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.rubrics r
      WHERE r.id = rubric_templates.rubric_id
        AND r.created_by = auth.uid()
    )
  ) WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.rubrics r
      WHERE r.id = rubric_templates.rubric_id
        AND r.created_by = auth.uid()
    )
  );

CREATE POLICY templates_delete_owner_or_admin ON public.rubric_templates
  FOR DELETE USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.rubrics r
      WHERE r.id = rubric_templates.rubric_id
        AND r.created_by = auth.uid()
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

CREATE POLICY grades_select_student_submitted_only ON public.rubric_grades
  FOR SELECT USING (
    public.current_user_role() = 'student'::public.user_role
    AND status = 'submitted'
    AND EXISTS (
      SELECT 1
      FROM public.group_members gm
      WHERE gm.group_id = rubric_grades.group_id
        AND gm.student_id = auth.uid()
    )
  );

CREATE POLICY grades_insert_lecturer_or_admin ON public.rubric_grades
  FOR INSERT WITH CHECK (
    public.is_admin()
    OR (
      public.current_user_role() = 'lecturer'::public.user_role
      AND public.is_lecturer_of_project(project_id)
    )
  );

CREATE POLICY grades_update_lecturer_or_admin ON public.rubric_grades
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

CREATE POLICY grades_delete_lecturer_or_admin ON public.rubric_grades
  FOR DELETE USING (
    public.is_admin()
    OR (
      public.current_user_role() = 'lecturer'::public.user_role
      AND public.is_lecturer_of_project(project_id)
    )
  );

GRANT EXECUTE ON FUNCTION public.is_lecturer_of_project(uuid) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
