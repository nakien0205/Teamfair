-- Fix circular dependency in users RLS policies
-- Problem: current_user_role() queries public.users, but users_select policy calls current_user_role()
-- Solution: Simplify users_select policy to avoid circular dependency

-- Drop existing policies
DROP POLICY IF EXISTS users_select ON public.users;
DROP POLICY IF EXISTS users_update_self ON public.users;
DROP POLICY IF EXISTS users_update_admin ON public.users;
DROP POLICY IF EXISTS users_delete_admin ON public.users;

-- Create simplified users_select policy that doesn't cause circular dependency
-- Users can always read their own profile
-- Lecturers can read profiles of students in their groups (checked via group_members + groups)
-- Admins can read all profiles (checked via direct metadata, not current_user_role())
CREATE POLICY users_select ON public.users
  FOR SELECT
  USING (
    -- User can always read their own profile (no function call needed)
    auth.uid() = id
    OR
    -- Admin check: use raw_app_metadata instead of current_user_role() to avoid circular dependency
    (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
    OR
    -- Lecturer can read students in their groups
    EXISTS (
      SELECT 1
      FROM public.groups g
      INNER JOIN public.group_members m ON m.group_id = g.id
      WHERE g.lecturer_id = auth.uid()
        AND m.student_id = users.id
    )
  );

-- Recreate other policies without changes
CREATE POLICY users_update_self ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY users_update_admin ON public.users
  FOR UPDATE
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

CREATE POLICY users_delete_admin ON public.users
  FOR DELETE
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

-- Add comment explaining the fix
COMMENT ON POLICY users_select ON public.users IS 
  'Simplified SELECT policy to avoid circular dependency. Uses direct auth.jwt() checks instead of current_user_role() function.';
