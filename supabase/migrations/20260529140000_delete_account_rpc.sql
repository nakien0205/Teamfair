-- Migration: Self-service account deletion RPC
-- Timestamp: 2026-05-29 14:00:00
--
-- Creates a SECURITY DEFINER function that:
-- 1. Sends notifications to affected project members (unless silent)
-- 2. Deletes all projects where the user is lecturer_id (CASCADE handles child rows)
-- 3. Removes the user from all group memberships
-- 4. Cleans up notifications, chat_messages, join_requests, project_invites
-- 5. Deletes the public.users row
--
-- IMPORTANT: groups.lecturer_id has ON DELETE RESTRICT, so we must delete
-- those groups explicitly before deleting public.users.

CREATE OR REPLACE FUNCTION public.delete_user_account(p_silent boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_name text;
  v_led_group RECORD;
  v_member_group RECORD;
  v_member RECORD;
BEGIN
  -- 1. Resolve caller identity
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT full_name INTO v_user_name
  FROM public.users
  WHERE id = v_user_id;

  IF v_user_name IS NULL THEN
    v_user_name := 'Unknown User';
  END IF;

  -- 2. Handle projects where user is the Leader (group_members.role = 'Leader')
  --    AND/OR where user is the groups.lecturer_id
  --    These projects will be fully deleted.
  FOR v_led_group IN
    SELECT DISTINCT g.id AS group_id, g.project_name
    FROM public.groups g
    LEFT JOIN public.group_members gm ON gm.group_id = g.id AND gm.student_id = v_user_id
    WHERE g.lecturer_id = v_user_id
       OR (gm.role = 'Leader' AND gm.student_id = v_user_id)
  LOOP
    -- Send notifications to all OTHER members of this project (if not silent)
    IF NOT p_silent THEN
      FOR v_member IN
        SELECT gm2.student_id
        FROM public.group_members gm2
        WHERE gm2.group_id = v_led_group.group_id
          AND gm2.student_id <> v_user_id
      LOOP
        INSERT INTO public.notifications (recipient_id, sender_name, content, is_read)
        VALUES (
          v_member.student_id,
          v_user_name,
          'You have been removed from project ' || v_led_group.project_name ||
            ' by ' || v_user_name || '. For more information, please contact ' || v_user_name || '.',
          false
        );
      END LOOP;
    END IF;

    -- Delete the group (CASCADE handles tasks, group_members, contribution_logs,
    -- ai_evaluations, calendar_events, materials, student_reports,
    -- lecturer_scores, lecturer_reviews, activity_logs, project_invites, join_requests)
    DELETE FROM public.groups WHERE id = v_led_group.group_id;
  END LOOP;

  -- 3. Handle projects where user is just a Member (not Leader / not lecturer_id)
  --    Remove the user from these projects and notify remaining members (if not silent)
  FOR v_member_group IN
    SELECT gm.group_id, g.project_name
    FROM public.group_members gm
    JOIN public.groups g ON g.id = gm.group_id
    WHERE gm.student_id = v_user_id
  LOOP
    IF NOT p_silent THEN
      FOR v_member IN
        SELECT gm2.student_id
        FROM public.group_members gm2
        WHERE gm2.group_id = v_member_group.group_id
          AND gm2.student_id <> v_user_id
      LOOP
        INSERT INTO public.notifications (recipient_id, sender_name, content, is_read)
        VALUES (
          v_member.student_id,
          v_user_name,
          v_user_name || ' has left the project ' || v_member_group.project_name || '.',
          false
        );
      END LOOP;
    END IF;

    -- Remove the user's membership
    DELETE FROM public.group_members
    WHERE group_id = v_member_group.group_id AND student_id = v_user_id;
  END LOOP;

  -- 4. Clean up remaining user data

  -- Delete all notifications where user is the recipient
  DELETE FROM public.notifications WHERE recipient_id = v_user_id;

  -- Delete all chat messages (references auth.users, but clean up explicitly)
  DELETE FROM public.chat_messages WHERE user_id = v_user_id;

  -- Delete any remaining join requests by the user
  DELETE FROM public.join_requests WHERE user_id = v_user_id;

  -- Delete any project invites created by the user
  DELETE FROM public.project_invites WHERE created_by = v_user_id;

  -- Delete any remaining contribution_logs by the user
  DELETE FROM public.contribution_logs WHERE student_id = v_user_id;

  -- Delete any remaining ai_evaluations for the user
  DELETE FROM public.ai_evaluations WHERE student_id = v_user_id;

  -- 5. Delete the public.users row
  --    This must come AFTER deleting groups where lecturer_id = v_user_id
  --    because of the ON DELETE RESTRICT constraint.
  DELETE FROM public.users WHERE id = v_user_id;

  RETURN v_user_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_user_account(boolean) TO authenticated;
