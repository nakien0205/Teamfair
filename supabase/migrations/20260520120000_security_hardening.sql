-- Hardening RLS policies and constraints for Teamfair
-- 0. Clean up legacy/demo non-UUID entries in chat_messages to prevent UUID casting errors
DELETE FROM public.chat_messages 
  WHERE group_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
-- 1. Alter public.chat_messages.group_id from TEXT to UUID and add Foreign Key constraint
ALTER TABLE public.chat_messages 
  ALTER COLUMN group_id TYPE uuid USING group_id::uuid,
  ADD CONSTRAINT chat_messages_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups (id) ON DELETE CASCADE;
-- 2. Harden RLS policies for public.chat_messages
DROP POLICY IF EXISTS "Users read own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users insert own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users delete own messages" ON public.chat_messages;
CREATE POLICY chat_messages_select ON public.chat_messages FOR SELECT
  USING (
    auth.uid() = user_id 
    AND (
      public.is_admin() 
      OR public.is_lecturer_of_group(group_id) 
      OR public.is_student_member_of_group(group_id)
    )
  );
CREATE POLICY chat_messages_insert ON public.chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND (
      public.is_admin() 
      OR public.is_lecturer_of_group(group_id) 
      OR public.is_student_member_of_group(group_id)
    )
  );
CREATE POLICY chat_messages_delete ON public.chat_messages FOR DELETE
  USING (
    auth.uid() = user_id 
    AND (
      public.is_admin() 
      OR public.is_lecturer_of_group(group_id) 
      OR public.is_student_member_of_group(group_id)
    )
  );
-- 3. Update public.tasks RLS policies to allow group members (including students/Student Leaders) to insert, update, and delete tasks
DROP POLICY IF EXISTS tasks_insert ON public.tasks;
DROP POLICY IF EXISTS tasks_update ON public.tasks;
DROP POLICY IF EXISTS tasks_delete ON public.tasks;
CREATE POLICY tasks_insert ON public.tasks FOR INSERT
  WITH CHECK (
    public.is_admin() 
    OR public.is_lecturer_of_group(group_id)
    OR (public.current_user_role() = 'student' AND public.is_student_member_of_group(group_id))
  );
CREATE POLICY tasks_update ON public.tasks FOR UPDATE
  USING (
    public.is_admin() 
    OR public.is_lecturer_of_group(group_id)
    OR (public.current_user_role() = 'student' AND public.is_student_member_of_group(group_id))
  )
  WITH CHECK (
    public.is_admin() 
    OR public.is_lecturer_of_group(group_id)
    OR (public.current_user_role() = 'student' AND public.is_student_member_of_group(group_id))
  );
CREATE POLICY tasks_delete ON public.tasks FOR DELETE
  USING (
    public.is_admin() 
    OR public.is_lecturer_of_group(group_id)
    OR (public.current_user_role() = 'student' AND public.is_student_member_of_group(group_id))
  );
-- 4. Update public.materials RLS delete policy to allow students to delete materials in their assigned group
DROP POLICY IF EXISTS materials_delete ON public.materials;
CREATE POLICY materials_delete ON public.materials FOR DELETE
  USING (
    public.is_admin() 
    OR public.is_lecturer_of_group(group_id)
    OR (public.current_user_role() = 'student' AND public.is_student_member_of_group(group_id))
  );
