-- Migration to fix lecturer role invitation mappings and project visibility
-- Timestamp: 2026-06-18 12:00:00

CREATE OR REPLACE FUNCTION public.is_lecturer_of_group (p_group_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
  SELECT
    EXISTS (
      SELECT
        1
      FROM
        public.groups g
      WHERE
        g.id = p_group_id
        AND g.lecturer_id = auth.uid ()
        AND public.current_user_role () = 'lecturer'::public.user_role
    ) OR EXISTS (
      SELECT
        1
      FROM
        public.group_members gm
      WHERE
        gm.group_id = p_group_id
        AND gm.student_id = auth.uid ()
        AND gm.role = 'Lecturer'
        AND public.current_user_role () = 'lecturer'::public.user_role
    );
$$;

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
  v_user_role public.user_role;
  v_member_role text;
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

  SELECT role INTO v_user_role FROM public.users WHERE id = p_user_id;
  IF v_user_role = 'lecturer'::public.user_role THEN
    v_member_role := 'Lecturer';
  ELSE
    v_member_role := 'Member';
  END IF;

  INSERT INTO public.group_members (group_id, student_id, role)
  VALUES (v_invite.group_id, p_user_id, v_member_role);

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
  v_user_role public.user_role;
  v_member_role text;
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

  SELECT role INTO v_user_role FROM public.users WHERE id = v_request.user_id;
  IF v_user_role = 'lecturer'::public.user_role THEN
    v_member_role := 'Lecturer';
  ELSE
    v_member_role := 'Member';
  END IF;

  INSERT INTO public.group_members (group_id, student_id, role)
  VALUES (v_request.group_id, v_request.user_id, v_member_role);

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

CREATE OR REPLACE FUNCTION public.respond_to_group_email_invite (
  p_invite_id uuid,
  p_response text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.group_email_invites%ROWTYPE;
  v_email text;
  v_user_role public.user_role;
  v_member_role text;
BEGIN
  SELECT *
  INTO v_invite
  FROM public.group_email_invites
  WHERE id = p_invite_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Email invite not found.';
  END IF;

  v_email := lower (coalesce (auth.jwt () ->> 'email', ''));
  IF auth.uid () IS NULL OR (lower (v_invite.invited_email) <> v_email AND v_invite.invited_user_id IS DISTINCT FROM auth.uid ()) THEN
    RAISE EXCEPTION 'This invite does not belong to the current user.';
  END IF;

  IF v_invite.status IN ('accepted', 'rejected', 'revoked') THEN
    RAISE EXCEPTION 'This invite has already been processed.';
  END IF;

  IF p_response = 'accepted' THEN
    SELECT role INTO v_user_role FROM public.users WHERE id = auth.uid ();
    IF v_user_role = 'lecturer'::public.user_role THEN
      v_member_role := 'Lecturer';
    ELSE
      v_member_role := 'Member';
    END IF;

    INSERT INTO public.group_members (group_id, student_id, role)
    VALUES (v_invite.group_id, auth.uid (), v_member_role)
    ON CONFLICT (group_id, student_id) DO UPDATE
      SET role = EXCLUDED.role;
  ELSIF p_response <> 'rejected' THEN
    RAISE EXCEPTION 'Invalid invite response.';
  END IF;

  UPDATE public.group_email_invites
  SET
    invited_user_id = coalesce (invited_user_id, auth.uid ()),
    status = CASE WHEN p_response = 'accepted' THEN 'accepted' ELSE 'rejected' END,
    responded_at = now ()
  WHERE id = p_invite_id;
END;
$$;
