-- Narrow RLS: lecturers scoped to groups they own; students read tasks/logs in their groups
-- and may INSERT/UPDATE only their own contribution_logs.

CREATE OR REPLACE FUNCTION public.is_student_member_of_group (p_group_id uuid)
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
        public.group_members m
      WHERE
        m.group_id = p_group_id
        AND m.student_id = auth.uid ());

$$;


-- ---------------------------------------------------------------------------
-- public.users
-- ---------------------------------------------------------------------------

CREATE POLICY users_select ON public.users
  FOR SELECT
  USING (auth.uid () = id OR public.is_admin () OR (public.current_user_role () = 'lecturer' AND EXISTS (
    SELECT
      1
    FROM
      public.groups g
      INNER JOIN public.group_members m ON m.group_id = g.id
    WHERE
      g.lecturer_id = auth.uid ()
      AND m.student_id = users.id)));

CREATE POLICY users_update_self ON public.users
  FOR UPDATE
  USING (auth.uid () = id)
  WITH CHECK (auth.uid () = id AND role = public.current_user_role ());

CREATE POLICY users_update_admin ON public.users
  FOR UPDATE
  USING (public.is_admin ())
  WITH CHECK (public.is_admin ());

CREATE POLICY users_delete_admin ON public.users
  FOR DELETE
  USING (public.is_admin ());

-- ---------------------------------------------------------------------------
-- public.groups
-- ---------------------------------------------------------------------------

CREATE POLICY groups_select_admin ON public.groups
  FOR SELECT
  USING (public.is_admin ());

CREATE POLICY groups_select_lecturer ON public.groups
  FOR SELECT
  USING (lecturer_id = auth.uid ()
    AND public.current_user_role () = 'lecturer');

CREATE POLICY groups_select_student ON public.groups
  FOR SELECT
  USING (public.current_user_role () = 'student'
    AND public.is_student_member_of_group (id));

CREATE POLICY groups_insert ON public.groups
  FOR INSERT
  WITH CHECK (public.is_admin () OR (lecturer_id = auth.uid () AND public.current_user_role () IN ('lecturer', 'admin')));

CREATE POLICY groups_update ON public.groups
  FOR UPDATE
  USING (public.is_admin () OR (lecturer_id = auth.uid () AND public.current_user_role () = 'lecturer'))
  WITH CHECK (public.is_admin () OR (lecturer_id = auth.uid () AND public.current_user_role () = 'lecturer'));

CREATE POLICY groups_delete ON public.groups
  FOR DELETE
  USING (public.is_admin () OR (lecturer_id = auth.uid () AND public.current_user_role () = 'lecturer'));

-- ---------------------------------------------------------------------------
-- public.group_members
-- ---------------------------------------------------------------------------

CREATE POLICY group_members_select_admin ON public.group_members
  FOR SELECT
  USING (public.is_admin ());

CREATE POLICY group_members_select_lecturer ON public.group_members
  FOR SELECT
  USING (public.is_lecturer_of_group (group_id));

CREATE POLICY group_members_select_student ON public.group_members
  FOR SELECT
  USING (public.current_user_role () = 'student'
    AND public.is_student_member_of_group (group_id));

CREATE POLICY group_members_insert ON public.group_members
  FOR INSERT
  WITH CHECK (public.is_admin () OR public.is_lecturer_of_group (group_id));

CREATE POLICY group_members_delete ON public.group_members
  FOR DELETE
  USING (public.is_admin () OR public.is_lecturer_of_group (group_id));

-- ---------------------------------------------------------------------------
-- public.tasks
-- ---------------------------------------------------------------------------

CREATE POLICY tasks_select_admin ON public.tasks
  FOR SELECT
  USING (public.is_admin ());

CREATE POLICY tasks_select_lecturer ON public.tasks
  FOR SELECT
  USING (public.is_lecturer_of_group (group_id));

CREATE POLICY tasks_select_student ON public.tasks
  FOR SELECT
  USING (public.current_user_role () = 'student'
    AND public.is_student_member_of_group (group_id));

CREATE POLICY tasks_insert ON public.tasks
  FOR INSERT
  WITH CHECK (public.is_admin () OR public.is_lecturer_of_group (group_id));

CREATE POLICY tasks_update ON public.tasks
  FOR UPDATE
  USING (public.is_admin () OR public.is_lecturer_of_group (group_id))
  WITH CHECK (public.is_admin () OR public.is_lecturer_of_group (group_id));

CREATE POLICY tasks_delete ON public.tasks
  FOR DELETE
  USING (public.is_admin () OR public.is_lecturer_of_group (group_id));

-- ---------------------------------------------------------------------------
-- public.contribution_logs
-- ---------------------------------------------------------------------------

CREATE POLICY contribution_logs_select_admin ON public.contribution_logs
  FOR SELECT
  USING (public.is_admin ());

CREATE POLICY contribution_logs_select_lecturer ON public.contribution_logs
  FOR SELECT
  USING (public.is_lecturer_of_group (public.task_group_id (task_id)));

CREATE POLICY contribution_logs_select_student ON public.contribution_logs
  FOR SELECT
  USING (public.current_user_role () = 'student'
    AND public.is_student_member_of_group (public.task_group_id (task_id)));

CREATE POLICY contribution_logs_insert_admin ON public.contribution_logs
  FOR INSERT
  WITH CHECK (public.is_admin ());

CREATE POLICY contribution_logs_insert_lecturer ON public.contribution_logs
  FOR INSERT
  WITH CHECK (public.is_lecturer_of_group (public.task_group_id (task_id)));

CREATE POLICY contribution_logs_insert_student ON public.contribution_logs
  FOR INSERT
  WITH CHECK (public.current_user_role () = 'student'
    AND student_id = auth.uid ()
    AND public.is_student_member_of_group (public.task_group_id (task_id)));

CREATE POLICY contribution_logs_update_admin ON public.contribution_logs
  FOR UPDATE
  USING (public.is_admin ())
  WITH CHECK (public.is_admin ());

CREATE POLICY contribution_logs_update_lecturer ON public.contribution_logs
  FOR UPDATE
  USING (public.is_lecturer_of_group (public.task_group_id (task_id)))
  WITH CHECK (public.is_lecturer_of_group (public.task_group_id (task_id)));

CREATE POLICY contribution_logs_update_student ON public.contribution_logs
  FOR UPDATE
  USING (public.current_user_role () = 'student'
    AND student_id = auth.uid ()
    AND public.is_student_member_of_group (public.task_group_id (task_id)))
  WITH CHECK (public.current_user_role () = 'student'
    AND student_id = auth.uid ()
    AND public.is_student_member_of_group (public.task_group_id (task_id)));

CREATE POLICY contribution_logs_delete_admin ON public.contribution_logs
  FOR DELETE
  USING (public.is_admin ());

CREATE POLICY contribution_logs_delete_lecturer ON public.contribution_logs
  FOR DELETE
  USING (public.is_lecturer_of_group (public.task_group_id (task_id)));

-- ---------------------------------------------------------------------------
-- public.ai_evaluations (lecturer: same scope as groups; students: read-only in their groups)
-- ---------------------------------------------------------------------------

CREATE POLICY ai_evaluations_select_admin ON public.ai_evaluations
  FOR SELECT
  USING (public.is_admin ());

CREATE POLICY ai_evaluations_select_lecturer ON public.ai_evaluations
  FOR SELECT
  USING (public.is_lecturer_of_group (group_id));

CREATE POLICY ai_evaluations_select_student ON public.ai_evaluations
  FOR SELECT
  USING (public.current_user_role () = 'student'
    AND public.is_student_member_of_group (group_id));

CREATE POLICY ai_evaluations_insert ON public.ai_evaluations
  FOR INSERT
  WITH CHECK (public.is_admin () OR public.is_lecturer_of_group (group_id));

CREATE POLICY ai_evaluations_update ON public.ai_evaluations
  FOR UPDATE
  USING (public.is_admin () OR public.is_lecturer_of_group (group_id))
  WITH CHECK (public.is_admin () OR public.is_lecturer_of_group (group_id));

CREATE POLICY ai_evaluations_delete ON public.ai_evaluations
  FOR DELETE
  USING (public.is_admin () OR public.is_lecturer_of_group (group_id));

GRANT EXECUTE ON FUNCTION public.is_student_member_of_group (uuid) TO authenticated;
