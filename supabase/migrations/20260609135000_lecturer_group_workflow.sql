-- Lecturer group workflow hardening.
-- Scope lecturers to their own groups, fix member-role RPCs, and add email invite claim/response helpers.

CREATE OR REPLACE FUNCTION public.is_lecturer_of_group (p_group_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.groups g
      WHERE g.id = p_group_id
        AND g.lecturer_id = auth.uid ()
        AND public.current_user_role () = 'lecturer'::public.user_role
    );
$$;

DROP POLICY IF EXISTS groups_select_lecturer ON public.groups;
CREATE POLICY groups_select_lecturer ON public.groups
  FOR SELECT
  USING (
    public.current_user_role () = 'lecturer'::public.user_role
    AND lecturer_id = auth.uid ()
  );

DROP FUNCTION IF EXISTS public.update_member_role (uuid, uuid, public.user_role);

CREATE OR REPLACE FUNCTION public.update_member_role (
  p_group_id uuid,
  p_target_user_id uuid,
  p_new_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin () OR public.is_lecturer_of_group (p_group_id)) THEN
    RAISE EXCEPTION 'Not allowed to update group members.';
  END IF;

  IF p_new_role NOT IN ('Leader', 'Member') THEN
    RAISE EXCEPTION 'Invalid group role.';
  END IF;

  IF p_new_role = 'Leader' THEN
    UPDATE public.group_members
    SET role = 'Member'
    WHERE group_id = p_group_id;
  END IF;

  UPDATE public.group_members
  SET role = p_new_role
  WHERE group_id = p_group_id
    AND student_id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Group member not found.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_group_leader (
  p_group_id uuid,
  p_new_leader_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin () OR public.is_lecturer_of_group (p_group_id)) THEN
    RAISE EXCEPTION 'Not allowed to assign a leader.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE group_id = p_group_id
      AND student_id = p_new_leader_id
  ) THEN
    RAISE EXCEPTION 'Target user is not a member of the group.';
  END IF;

  PERFORM public.update_member_role (p_group_id, p_new_leader_id, 'Leader');
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_group_member (
  p_group_id uuid,
  p_target_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF NOT (public.is_admin () OR public.is_lecturer_of_group (p_group_id)) THEN
    RAISE EXCEPTION 'Not allowed to remove group members.';
  END IF;

  SELECT role
  INTO v_role
  FROM public.group_members
  WHERE group_id = p_group_id
    AND student_id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Group member not found.';
  END IF;

  IF v_role = 'Leader' THEN
    RAISE EXCEPTION 'Please assign a new leader before removing the current one.';
  END IF;

  DELETE FROM public.group_members
  WHERE group_id = p_group_id
    AND student_id = p_target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_group_email_invites_for_current_user ()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_claimed integer := 0;
BEGIN
  v_email := lower (coalesce (auth.jwt () ->> 'email', ''));
  IF v_email = '' OR auth.uid () IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.group_email_invites
  SET invited_user_id = auth.uid ()
  WHERE invited_user_id IS NULL
    AND lower (invited_email) = v_email;

  GET DIAGNOSTICS v_claimed = ROW_COUNT;
  RETURN v_claimed;
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
    INSERT INTO public.group_members (group_id, student_id, role)
    VALUES (v_invite.group_id, auth.uid (), 'Member')
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

ALTER TABLE public.group_email_invites
  DROP CONSTRAINT IF EXISTS group_email_invites_status_check;

ALTER TABLE public.group_email_invites
  ADD CONSTRAINT group_email_invites_status_check
  CHECK (status IN ('pending', 'sent', 'accepted', 'rejected', 'revoked'));

DROP POLICY IF EXISTS group_email_invites_select ON public.group_email_invites;
CREATE POLICY group_email_invites_select ON public.group_email_invites
  FOR SELECT
  USING (
    public.is_admin ()
    OR public.is_lecturer_of_group (group_id)
    OR invited_user_id = auth.uid ()
    OR lower (invited_email) = lower (coalesce (auth.jwt () ->> 'email', ''))
  );

DROP POLICY IF EXISTS group_email_invites_update ON public.group_email_invites;
CREATE POLICY group_email_invites_update ON public.group_email_invites
  FOR UPDATE
  USING (
    public.is_admin ()
    OR public.is_lecturer_of_group (group_id)
    OR invited_user_id = auth.uid ()
    OR lower (invited_email) = lower (coalesce (auth.jwt () ->> 'email', ''))
  )
  WITH CHECK (
    public.is_admin ()
    OR public.is_lecturer_of_group (group_id)
    OR invited_user_id = auth.uid ()
    OR lower (invited_email) = lower (coalesce (auth.jwt () ->> 'email', ''))
  );

GRANT EXECUTE ON FUNCTION public.update_member_role (uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_group_leader (uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_group_member (uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_group_email_invites_for_current_user () TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_group_email_invite (uuid, text) TO authenticated;
