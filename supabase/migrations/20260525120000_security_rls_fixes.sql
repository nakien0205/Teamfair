-- Security RLS Hardening and Lecturer Project Management Fixes.
-- Timestamp: 2026-05-25 12:00:00

-- ---------------------------------------------------------------------------
-- 1. Revoke anon access from calendar_events to prevent unauthenticated SELECT queries
-- ---------------------------------------------------------------------------
REVOKE SELECT ON TABLE public.calendar_events FROM anon;


-- ---------------------------------------------------------------------------
-- 2. Redefine is_lecturer_of_group helper function to support student-created groups
-- ---------------------------------------------------------------------------
-- Previously, g.lecturer_id = auth.uid() caused student-created groups (where lecturer_id is set to a student ID)
-- to be completely invisible and inaccessible to real lecturers. Redefining this function allows users
-- with the 'lecturer' role to oversee, score, and evaluate all project groups.
CREATE OR REPLACE FUNCTION public.is_lecturer_of_group (p_group_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = p_group_id
    ) AND public.current_user_role() = 'lecturer'::public.user_role;
$$;


-- ---------------------------------------------------------------------------
-- 3. Update public.groups RLS policies to grant lecturers proper access
-- ---------------------------------------------------------------------------
-- These updates ensure real lecturers can view, update, or delete any project group in the system
-- while preserving the creators' (lecturers or student leaders) original access.
DROP POLICY IF EXISTS groups_select_lecturer ON public.groups;
CREATE POLICY groups_select_lecturer ON public.groups
  FOR SELECT
  USING (
    public.current_user_role() = 'lecturer'::public.user_role
    OR lecturer_id = auth.uid()
  );

DROP POLICY IF EXISTS groups_update ON public.groups;
CREATE POLICY groups_update ON public.groups
  FOR UPDATE
  USING (
    public.is_admin()
    OR public.current_user_role() = 'lecturer'::public.user_role
    OR lecturer_id = auth.uid()
  )
  WITH CHECK (
    public.is_admin()
    OR public.current_user_role() = 'lecturer'::public.user_role
    OR lecturer_id = auth.uid()
  );

DROP POLICY IF EXISTS groups_delete ON public.groups;
CREATE POLICY groups_delete ON public.groups
  FOR DELETE
  USING (
    public.is_admin()
    OR public.current_user_role() = 'lecturer'::public.user_role
    OR lecturer_id = auth.uid()
  );


-- ---------------------------------------------------------------------------
-- 4. Harden group_members INSERT policy to prevent unauthorized role escalation
-- ---------------------------------------------------------------------------
-- Restricts students to only joining groups with the 'Member' role, unless they
-- are the creator/owner of the group (in which case they can join as 'Leader').
DROP POLICY IF EXISTS group_members_insert ON public.group_members;
CREATE POLICY group_members_insert ON public.group_members
  FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR public.is_lecturer_of_group(group_id)
    OR (
      student_id = auth.uid()
      AND (
        (role = 'Member')
        OR (role = 'Leader' AND EXISTS (
          SELECT 1 FROM public.groups g
          WHERE g.id = group_id AND g.lecturer_id = auth.uid()
        ))
      )
    )
  );


-- ---------------------------------------------------------------------------
-- 5. Harden notifications INSERT policy to prevent forged alerts and spam
-- ---------------------------------------------------------------------------
-- Replaces the loose 'auth.uid() IS NOT NULL' check with a secure relationship check.
-- Senders can only notify recipients who share a group with them (as a peer student,
-- student notifying a lecturer, lecturer notifying a student, self-notification, or admin).
DROP POLICY IF EXISTS notifications_insert ON public.notifications;
CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      -- Case 1: Sender is sending a notification to themselves (self/system alerts)
      auth.uid() = recipient_id
      OR
      -- Case 2: Sender is a lecturer of a group where the recipient is a student member
      EXISTS (
        SELECT 1 FROM public.groups g
        INNER JOIN public.group_members m ON m.group_id = g.id
        WHERE g.lecturer_id = auth.uid() AND m.student_id = recipient_id
      )
      OR
      -- Case 3: Sender is a student member of a group where the recipient is the lecturer
      EXISTS (
        SELECT 1 FROM public.groups g
        INNER JOIN public.group_members m ON m.group_id = g.id
        WHERE m.student_id = auth.uid() AND g.lecturer_id = recipient_id
      )
      OR
      -- Case 4: Sender and recipient are both student members of the same group
      EXISTS (
        SELECT 1 FROM public.group_members m1
        INNER JOIN public.group_members m2 ON m1.group_id = m2.group_id
        WHERE m1.student_id = auth.uid() AND m2.student_id = recipient_id
      )
      OR
      -- Case 5: Sender is an admin
      public.is_admin()
    )
  );
