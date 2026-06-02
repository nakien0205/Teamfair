-- Migration to fix Row-Level Security (RLS) constraints for invite counters and request approvals
-- Timestamp: 2026-05-29 15:00:00

-- ---------------------------------------------------------------------------
-- 1. Create increment_invite_use SECURITY DEFINER RPC function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_invite_use(p_invite_code text)
RETURNS void
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Perform direct atomic update bypassing standard RLS checks for updating guests
  UPDATE public.project_invites
  SET uses_count = uses_count + 1
  WHERE id = p_invite_code;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.increment_invite_use(text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Modify group_members INSERT policy to allow Leaders to add members
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS group_members_insert ON public.group_members;
CREATE POLICY group_members_insert ON public.group_members
  FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR public.is_lecturer_of_group(group_id)
    -- Allow the student themselves to join with 'Member' role
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
    -- Allow the Group Leader of the target group to insert/add new members
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_members.group_id
        AND gm.student_id = auth.uid()
        AND gm.role = 'Leader'
    )
  );
