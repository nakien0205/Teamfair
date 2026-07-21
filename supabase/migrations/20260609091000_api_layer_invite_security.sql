-- API layer invite hardening and service-only helpers.
-- Timestamp: 2026-06-04 14:00:00

-- Authenticated users should not be able to enumerate every invite code.
DROP POLICY IF EXISTS project_invites_select ON public.project_invites;
CREATE POLICY project_invites_select ON public.project_invites
  FOR SELECT
  USING (
    public.is_admin()
    OR public.is_lecturer_of_group(group_id)
    OR auth.uid() = created_by
    OR EXISTS (
      SELECT 1
      FROM public.group_members gm
      WHERE gm.group_id = project_invites.group_id
        AND gm.student_id = auth.uid()
        AND gm.role = 'Leader'
    )
  );

CREATE OR REPLACE FUNCTION public.consume_project_invite(p_invite_id text, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.project_invites%ROWTYPE;
  v_group_name text;
  v_existing_status text;
  v_request_id uuid;
BEGIN
  SELECT *
  INTO v_invite
  FROM public.project_invites
  WHERE id = upper(trim(p_invite_id))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;

  SELECT project_name
  INTO v_group_name
  FROM public.groups
  WHERE id = v_invite.group_id;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at <= now() THEN
    RAISE EXCEPTION 'invite_expired';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE group_id = v_invite.group_id
      AND student_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'already_member';
  END IF;

  IF v_invite.max_uses IS NOT NULL AND v_invite.uses_count >= v_invite.max_uses THEN
    RAISE EXCEPTION 'invite_full';
  END IF;

  IF v_invite.approval_mode = 'requires_approval' THEN
    SELECT id, status
    INTO v_request_id, v_existing_status
    FROM public.join_requests
    WHERE group_id = v_invite.group_id
      AND user_id = p_user_id
    LIMIT 1;

    IF v_request_id IS NOT NULL THEN
      IF v_existing_status = 'pending' THEN
        RAISE EXCEPTION 'request_already_pending';
      END IF;

      UPDATE public.join_requests
      SET status = 'pending', invite_id = v_invite.id, created_at = now()
      WHERE id = v_request_id;
    ELSE
      INSERT INTO public.join_requests (group_id, invite_id, user_id, status)
      VALUES (v_invite.group_id, v_invite.id, p_user_id, 'pending')
      RETURNING id INTO v_request_id;
    END IF;

    RETURN jsonb_build_object(
      'group_id', v_invite.group_id,
      'group_name', coalesce(v_group_name, 'Nhóm dự án'),
      'approval_mode', v_invite.approval_mode,
      'status', 'pending_approval',
      'request_id', v_request_id
    );
  END IF;

  INSERT INTO public.group_members (group_id, student_id, role)
  VALUES (v_invite.group_id, p_user_id, 'Member');

  UPDATE public.project_invites
  SET uses_count = uses_count + 1
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'group_id', v_invite.group_id,
    'group_name', coalesce(v_group_name, 'Nhóm dự án'),
    'approval_mode', v_invite.approval_mode,
    'status', 'success'
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'already_member';
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_project_join_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.join_requests%ROWTYPE;
  v_invite public.project_invites%ROWTYPE;
  v_group_name text;
BEGIN
  SELECT *
  INTO v_request
  FROM public.join_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'request_not_pending';
  END IF;

  SELECT *
  INTO v_invite
  FROM public.project_invites
  WHERE id = v_request.invite_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at <= now() THEN
    RAISE EXCEPTION 'invite_expired';
  END IF;

  IF v_invite.max_uses IS NOT NULL AND v_invite.uses_count >= v_invite.max_uses THEN
    RAISE EXCEPTION 'invite_full';
  END IF;

  SELECT project_name
  INTO v_group_name
  FROM public.groups
  WHERE id = v_request.group_id;

  INSERT INTO public.group_members (group_id, student_id, role)
  VALUES (v_request.group_id, v_request.user_id, 'Member');

  UPDATE public.project_invites
  SET uses_count = uses_count + 1
  WHERE id = v_invite.id;

  UPDATE public.join_requests
  SET status = 'approved'
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'request_id', p_request_id,
    'status', 'approved',
    'group_id', v_request.group_id,
    'group_name', coalesce(v_group_name, 'Nhóm dự án'),
    'user_id', v_request.user_id
  );
EXCEPTION
  WHEN unique_violation THEN
    UPDATE public.join_requests
    SET status = 'approved'
    WHERE id = p_request_id;

    RETURN jsonb_build_object(
      'request_id', p_request_id,
      'status', 'approved',
      'group_id', v_request.group_id,
      'group_name', coalesce(v_group_name, 'Nhóm dự án'),
      'user_id', v_request.user_id,
      'already_member', true
    );
END;
$$;

DROP FUNCTION IF EXISTS public.increment_invite_use(text);

REVOKE ALL ON FUNCTION public.consume_project_invite(text, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_project_invite(text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.approve_project_join_request(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_project_join_request(uuid) TO service_role;
