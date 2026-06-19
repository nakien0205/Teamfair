-- Migration to add member kick RPC
-- Timestamp: 2026-06-19 19:32:00

CREATE OR REPLACE FUNCTION public.kick_member(
  p_group_id uuid,
  p_target_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_caller_name text;
  v_target_name text;
BEGIN
  -- Verify if the caller is the 'Leader' of the group
  SELECT role INTO v_caller_role
  FROM public.group_members
  WHERE group_id = p_group_id AND student_id = auth.uid();

  IF v_caller_role IS DISTINCT FROM 'Leader' THEN
    RAISE EXCEPTION 'Only the group leader can kick members.';
  END IF;

  -- Verify that the target is NOT the leader themselves (can't kick self)
  IF p_target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Leader cannot kick themselves. Use resignation instead.';
  END IF;

  -- Verify that the target is a member of the group
  IF NOT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND student_id = p_target_user_id
  ) THEN
    RAISE EXCEPTION 'Target user is not a member of the group.';
  END IF;

  -- Delete from public.group_members
  DELETE FROM public.group_members
  WHERE group_id = p_group_id AND student_id = p_target_user_id;

  -- Update any tasks assigned to the kicked user in this group to be unassigned
  UPDATE public.tasks
  SET assignee_id = NULL
  WHERE group_id = p_group_id AND assignee_id = p_target_user_id;

  -- Get user names for activity log
  SELECT full_name INTO v_caller_name FROM public.users WHERE id = auth.uid();
  SELECT full_name INTO v_target_name FROM public.users WHERE id = p_target_user_id;

  -- Fallback if names not found
  IF v_caller_name IS NULL THEN
    v_caller_name := 'Trưởng nhóm';
  END IF;
  IF v_target_name IS NULL THEN
    v_target_name := 'Thành viên';
  END IF;

  INSERT INTO public.activity_logs (group_id, description)
  VALUES (p_group_id, v_caller_name || ' đã xóa ' || v_target_name || ' khỏi nhóm.');

END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.kick_member(uuid, uuid) TO authenticated;
