-- Migration to update notifications insert policy to support student-created groups with NULL lecturer_id
-- Timestamp: 2026-06-11 16:00:00

DROP POLICY IF EXISTS notifications_insert ON public.notifications;

CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      -- Case 1: Sender is sending a notification to themselves (self/system alerts)
      auth.uid() = recipient_id
      OR
      -- Case 2: Sender is a lecturer of a group where the recipient is a student member,
      -- or sender has the 'lecturer' role and recipient is a student member of some group.
      EXISTS (
        SELECT 1 FROM public.groups g
        INNER JOIN public.group_members m ON m.group_id = g.id
        WHERE (g.lecturer_id = auth.uid() OR public.current_user_role() = 'lecturer'::public.user_role)
        AND m.student_id = recipient_id
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

-- Reload PostgREST schema cache
SELECT pg_notify('pgrst', 'reload schema');
