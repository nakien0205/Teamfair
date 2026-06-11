-- Invite RLS cleanup and member-insert tightening.
-- Timestamp: 2026-05-29 15:00:00
--
-- The invite counter is now updated only inside the service-only
-- consume_project_invite / approve_project_join_request RPC flow. Keeping a
-- separate authenticated increment RPC lets clients mutate counters without
-- proving that a join actually happened, so remove it.

DROP FUNCTION IF EXISTS public.increment_invite_use(text);

-- Leaders may add regular project members, but leader promotion must move
-- through the dedicated member-management RPCs. This keeps browser inserts
-- from minting new project owners.
DROP POLICY IF EXISTS group_members_insert ON public.group_members;
CREATE POLICY group_members_insert ON public.group_members
  FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR public.is_lecturer_of_group(group_id)
    OR (
      student_id = auth.uid()
      AND (
        role = 'Member'
        OR (
          role = 'Leader'
          AND EXISTS (
            SELECT 1
            FROM public.groups g
            WHERE g.id = group_members.group_id
              AND g.lecturer_id = auth.uid()
          )
        )
      )
    )
    OR (
      role = 'Member'
      AND EXISTS (
        SELECT 1
        FROM public.group_members gm
        WHERE gm.group_id = group_members.group_id
          AND gm.student_id = auth.uid()
          AND gm.role = 'Leader'
      )
    )
  );
