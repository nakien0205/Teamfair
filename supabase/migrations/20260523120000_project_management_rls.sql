-- Relax RLS policies for group management and group members join

-- 1. Relax groups insertion: Allow any authenticated user (Student or Lecturer) to INSERT into public.groups as long as lecturer_id = auth.uid()
DROP POLICY IF EXISTS groups_insert ON public.groups;
CREATE POLICY groups_insert ON public.groups
  FOR INSERT
  WITH CHECK (public.is_admin () OR (lecturer_id = auth.uid ()));

-- 2. Update groups_select_lecturer, groups_update, and groups_delete policies so they check lecturer_id = auth.uid() without checking the user role
DROP POLICY IF EXISTS groups_select_lecturer ON public.groups;
CREATE POLICY groups_select_lecturer ON public.groups
  FOR SELECT
  USING (lecturer_id = auth.uid ());

DROP POLICY IF EXISTS groups_update ON public.groups;
CREATE POLICY groups_update ON public.groups
  FOR UPDATE
  USING (public.is_admin () OR lecturer_id = auth.uid ())
  WITH CHECK (public.is_admin () OR lecturer_id = auth.uid ());

DROP POLICY IF EXISTS groups_delete ON public.groups;
CREATE POLICY groups_delete ON public.groups
  FOR DELETE
  USING (public.is_admin () OR lecturer_id = auth.uid ());

-- 3. Relax group_members insertion: Allow any authenticated user (Student or Lecturer) to INSERT into public.group_members to join a project as long as student_id = auth.uid()
DROP POLICY IF EXISTS group_members_insert ON public.group_members;
CREATE POLICY group_members_insert ON public.group_members
  FOR INSERT
  WITH CHECK (public.is_admin () OR public.is_lecturer_of_group (group_id) OR student_id = auth.uid ());
