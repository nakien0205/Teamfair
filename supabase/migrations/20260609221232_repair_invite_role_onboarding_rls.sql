-- Repair invite, lecturer project scoping, and onboarding role/name RLS behavior.
-- Created manually because the Supabase CLI is not installed in this workspace.

-- Keep app roles sourced from public.users. user_metadata is user-editable and
-- must not drive RLS authorization.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.users
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.current_user_role() = 'admin'::public.user_role
    OR auth.jwt() -> 'app_metadata' ->> 'role' = 'admin';
$$;

-- A lecturer can read/evaluate a project only when explicitly attached to it:
-- by lecturer_id, by a group_members row, or by admin override.
CREATE OR REPLACE FUNCTION public.is_lecturer_of_group(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR (
      public.current_user_role() = 'lecturer'::public.user_role
      AND (
        EXISTS (
          SELECT 1
          FROM public.groups g
          WHERE g.id = p_group_id
            AND g.lecturer_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM public.group_members gm
          WHERE gm.group_id = p_group_id
            AND gm.student_id = auth.uid()
        )
      )
    );
$$;

-- The rubric repair helper had the same all-project lecturer scope. Keep it
-- aligned with the group helper used by the rest of the app.
CREATE OR REPLACE FUNCTION public.is_lecturer_of_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_lecturer_of_group(p_project_id);
$$;

-- Restore group visibility to explicit project relationships. This removes the
-- earlier policy that exposed every project to every lecturer account.
DROP POLICY IF EXISTS groups_select_lecturer ON public.groups;
CREATE POLICY groups_select_lecturer ON public.groups
  FOR SELECT
  USING (public.is_lecturer_of_group(id));

DROP POLICY IF EXISTS groups_update ON public.groups;
CREATE POLICY groups_update ON public.groups
  FOR UPDATE
  USING (public.is_admin() OR lecturer_id = auth.uid())
  WITH CHECK (public.is_admin() OR lecturer_id = auth.uid());

DROP POLICY IF EXISTS groups_delete ON public.groups;
CREATE POLICY groups_delete ON public.groups
  FOR DELETE
  USING (public.is_admin() OR lecturer_id = auth.uid());

-- Rebuild invite policies around a Google-style share boundary:
-- project managers can create/list/revoke links, recipients can see their own
-- join requests, and invite redemption still happens only through team-api.
ALTER TABLE public.project_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_invites_select ON public.project_invites;
CREATE POLICY project_invites_select ON public.project_invites
  FOR SELECT
  USING (
    public.is_admin()
    OR auth.uid() = created_by
    OR EXISTS (
      SELECT 1
      FROM public.groups g
      WHERE g.id = project_invites.group_id
        AND g.lecturer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.group_members gm
      WHERE gm.group_id = project_invites.group_id
        AND gm.student_id = auth.uid()
        AND gm.role = 'Leader'
    )
  );

DROP POLICY IF EXISTS project_invites_insert ON public.project_invites;
CREATE POLICY project_invites_insert ON public.project_invites
  FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.groups g
        WHERE g.id = project_invites.group_id
          AND g.lecturer_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.group_members gm
        WHERE gm.group_id = project_invites.group_id
          AND gm.student_id = auth.uid()
          AND gm.role = 'Leader'
      )
    )
  );

DROP POLICY IF EXISTS project_invites_update ON public.project_invites;
CREATE POLICY project_invites_update ON public.project_invites
  FOR UPDATE
  USING (
    public.is_admin()
    OR auth.uid() = created_by
    OR EXISTS (
      SELECT 1
      FROM public.groups g
      WHERE g.id = project_invites.group_id
        AND g.lecturer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.group_members gm
      WHERE gm.group_id = project_invites.group_id
        AND gm.student_id = auth.uid()
        AND gm.role = 'Leader'
    )
  )
  WITH CHECK (
    public.is_admin()
    OR auth.uid() = created_by
    OR EXISTS (
      SELECT 1
      FROM public.groups g
      WHERE g.id = project_invites.group_id
        AND g.lecturer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.group_members gm
      WHERE gm.group_id = project_invites.group_id
        AND gm.student_id = auth.uid()
        AND gm.role = 'Leader'
    )
  );

DROP POLICY IF EXISTS project_invites_delete ON public.project_invites;
CREATE POLICY project_invites_delete ON public.project_invites
  FOR DELETE
  USING (
    public.is_admin()
    OR auth.uid() = created_by
    OR EXISTS (
      SELECT 1
      FROM public.groups g
      WHERE g.id = project_invites.group_id
        AND g.lecturer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.group_members gm
      WHERE gm.group_id = project_invites.group_id
        AND gm.student_id = auth.uid()
        AND gm.role = 'Leader'
    )
  );

DROP POLICY IF EXISTS join_requests_select ON public.join_requests;
CREATE POLICY join_requests_select ON public.join_requests
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.groups g
      WHERE g.id = join_requests.group_id
        AND g.lecturer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.group_members gm
      WHERE gm.group_id = join_requests.group_id
        AND gm.student_id = auth.uid()
        AND gm.role = 'Leader'
    )
  );

DROP POLICY IF EXISTS join_requests_insert ON public.join_requests;
CREATE POLICY join_requests_insert ON public.join_requests
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      public.is_admin()
      OR auth.uid() = user_id
    )
  );

DROP POLICY IF EXISTS join_requests_update ON public.join_requests;
CREATE POLICY join_requests_update ON public.join_requests
  FOR UPDATE
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.groups g
      WHERE g.id = join_requests.group_id
        AND g.lecturer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.group_members gm
      WHERE gm.group_id = join_requests.group_id
        AND gm.student_id = auth.uid()
        AND gm.role = 'Leader'
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.groups g
      WHERE g.id = join_requests.group_id
        AND g.lecturer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.group_members gm
      WHERE gm.group_id = join_requests.group_id
        AND gm.student_id = auth.uid()
        AND gm.role = 'Leader'
    )
  );

DROP POLICY IF EXISTS join_requests_delete ON public.join_requests;
CREATE POLICY join_requests_delete ON public.join_requests
  FOR DELETE
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.groups g
      WHERE g.id = join_requests.group_id
        AND g.lecturer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.group_members gm
      WHERE gm.group_id = join_requests.group_id
        AND gm.student_id = auth.uid()
        AND gm.role = 'Leader'
    )
  );

-- Explicit grants keep project_invites/join_requests reachable through the Data
-- API on newer Supabase projects while RLS still controls row access.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.project_invites TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.join_requests TO authenticated, service_role;

-- Onboarding role selection should not mark the profile completed before the
-- name save succeeds. It also must not silently fail for a stale fallback row.
CREATE OR REPLACE FUNCTION public.set_signup_role(p_role public.user_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_full_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_role = 'admin'::public.user_role THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  SELECT email, coalesce(raw_user_meta_data ->> 'full_name', '')
  INTO v_email, v_full_name
  FROM auth.users
  WHERE id = auth.uid();

  INSERT INTO public.users (id, email, role, full_name, profile_completed)
  VALUES (auth.uid(), coalesce(v_email, ''), p_role, coalesce(v_full_name, ''), FALSE)
  ON CONFLICT (id) DO UPDATE
    SET role = excluded.role,
        email = coalesce(public.users.email, excluded.email)
    WHERE public.users.profile_completed = FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.set_signup_role(public.user_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_signup_role(public.user_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_signup_role(public.user_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_signup_profile(
  p_role public.user_role,
  p_full_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_role = 'admin'::public.user_role THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  v_name := btrim(coalesce(p_full_name, ''));
  IF v_name = '' OR char_length(v_name) > 160 THEN
    RAISE EXCEPTION 'Invalid full name';
  END IF;

  SELECT email
  INTO v_email
  FROM auth.users
  WHERE id = auth.uid();

  INSERT INTO public.users (id, email, role, full_name, profile_completed)
  VALUES (auth.uid(), coalesce(v_email, ''), p_role, v_name, TRUE)
  ON CONFLICT (id) DO UPDATE
    SET email = coalesce(public.users.email, excluded.email),
        role = excluded.role,
        full_name = excluded.full_name,
        profile_completed = TRUE
    WHERE public.users.profile_completed = FALSE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_already_completed';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_signup_profile(public.user_role, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_signup_profile(public.user_role, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_signup_profile(public.user_role, text) TO authenticated;

-- Users may edit their display name directly, but role/profile completion must
-- move through guarded SECURITY DEFINER onboarding/admin paths.
REVOKE ALL ON TABLE public.users FROM authenticated;
REVOKE ALL ON TABLE public.users FROM anon;
GRANT SELECT ON TABLE public.users TO authenticated;
GRANT UPDATE (full_name) ON TABLE public.users TO authenticated;

-- Remove the obsolete client-callable counter RPC. Invite use counts are now
-- advanced only inside the service-only join/approval helpers.
DROP FUNCTION IF EXISTS public.increment_invite_use(text);

REVOKE ALL ON FUNCTION public.consume_project_invite(text, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_project_invite(text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.approve_project_join_request(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_project_join_request(uuid) TO service_role;
