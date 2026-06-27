-- Fix: Make lecturer_id nullable so student-created projects don't auto-assign
-- the student as the lecturer. Update RLS policies to handle NULL lecturer_id.
-- Timestamp: 2026-06-11 14:00:00

-- ---------------------------------------------------------------------------
-- 1. Make lecturer_id nullable
-- ---------------------------------------------------------------------------
ALTER TABLE public.groups
  ALTER COLUMN lecturer_id DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Update groups_insert policy to allow students to insert with NULL lecturer_id
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS groups_insert ON public.groups;
CREATE POLICY groups_insert ON public.groups
  FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR lecturer_id = auth.uid()
    OR (
      lecturer_id IS NULL
      AND auth.uid() IS NOT NULL
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Update groups_select_lecturer to handle NULL lecturer_id
-- ---------------------------------------------------------------------------
-- The 20260525 migration already grants all lecturers SELECT via current_user_role().
-- The `lecturer_id = auth.uid()` fallback is for student-created groups where
-- lecturer_id was set to the student. With nullable lecturer_id, student creators
-- now rely on groups_select_student (membership-based) instead. No change needed.

-- ---------------------------------------------------------------------------
-- 4. Update group_members_insert to let project creators insert as Leader
--    even when lecturer_id is NULL (student-created projects)
-- ---------------------------------------------------------------------------
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
          WHERE g.id = group_id
          AND (g.lecturer_id = auth.uid() OR g.lecturer_id IS NULL)
        ))
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Backfill: Clear lecturer_id for student-created groups
--    where the lecturer_id points to a user with role='student'
-- ---------------------------------------------------------------------------
UPDATE public.groups g
SET lecturer_id = NULL
WHERE EXISTS (
  SELECT 1 FROM public.users u
  WHERE u.id = g.lecturer_id
  AND u.role = 'student'
);
