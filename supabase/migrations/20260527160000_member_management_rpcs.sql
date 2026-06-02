-- Migration to add member role update and leader resignation RPCs
-- Timestamp: 2026-05-27 16:00:00

CREATE OR REPLACE FUNCTION public.update_member_role(
  p_group_id uuid,
  p_target_user_id uuid,
  p_new_role public.user_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
BEGIN
  -- Verify if the caller is the 'Leader' of the group
  SELECT role INTO v_caller_role
  FROM public.group_members
  WHERE group_id = p_group_id AND student_id = auth.uid();

  IF v_caller_role IS DISTINCT FROM 'Leader' THEN
    RAISE EXCEPTION 'Only the group leader can update member roles.';
  END IF;

  -- Update target user's role in public.users
  UPDATE public.users
  SET role = p_new_role
  WHERE id = p_target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.resign_as_leader(
  p_group_id uuid,
  p_new_leader_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
BEGIN
  -- Verify if the caller is the 'Leader' of the group
  SELECT role INTO v_caller_role
  FROM public.group_members
  WHERE group_id = p_group_id AND student_id = auth.uid();

  IF v_caller_role IS DISTINCT FROM 'Leader' THEN
    RAISE EXCEPTION 'Only the group leader can resign.';
  END IF;

  -- Verify that the successor is a member of the group
  IF NOT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND student_id = p_new_leader_id
  ) THEN
    RAISE EXCEPTION 'Successor must be a member of the group.';
  END IF;

  -- Swap roles in public.group_members
  UPDATE public.group_members
  SET role = 'Member'
  WHERE group_id = p_group_id AND student_id = auth.uid();

  UPDATE public.group_members
  SET role = 'Leader'
  WHERE group_id = p_group_id AND student_id = p_new_leader_id;

  -- Also update groups.lecturer_id if the project was student-created (i.e. g.lecturer_id = auth.uid())
  UPDATE public.groups
  SET lecturer_id = p_new_leader_id
  WHERE id = p_group_id AND lecturer_id = auth.uid();
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.update_member_role(uuid, uuid, public.user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resign_as_leader(uuid, uuid) TO authenticated;
