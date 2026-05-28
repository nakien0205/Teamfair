-- Migration to support invite code sharing and join request workflow.
-- Timestamp: 2026-05-29 12:00:00

-- ---------------------------------------------------------------------------
-- 1. Create public.project_invites table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_invites (
  id text PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expires_at timestamptz,
  max_uses integer,
  uses_count integer NOT NULL DEFAULT 0,
  approval_mode text NOT NULL DEFAULT 'auto' CONSTRAINT project_invites_approval_mode_chk CHECK (approval_mode IN ('auto', 'requires_approval')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS project_invites_group_id_idx ON public.project_invites (group_id);
CREATE INDEX IF NOT EXISTS project_invites_created_by_idx ON public.project_invites (created_by);

-- ---------------------------------------------------------------------------
-- 2. Create public.join_requests table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  invite_id text NOT NULL REFERENCES public.project_invites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CONSTRAINT join_requests_status_chk CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT join_requests_group_user_unique UNIQUE (group_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS join_requests_group_id_idx ON public.join_requests (group_id);
CREATE INDEX IF NOT EXISTS join_requests_invite_id_idx ON public.join_requests (invite_id);
CREATE INDEX IF NOT EXISTS join_requests_user_id_idx ON public.join_requests (user_id);

-- ---------------------------------------------------------------------------
-- 3. Enable Row-Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.project_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 4. Define RLS Policies for public.project_invites
-- ---------------------------------------------------------------------------

-- Select: allowed for all authenticated users
DROP POLICY IF EXISTS project_invites_select ON public.project_invites;
CREATE POLICY project_invites_select ON public.project_invites
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Insert: allowed only for the group's Leader (either auth.uid() = created_by or group's Leader/Lecturer/Admin)
DROP POLICY IF EXISTS project_invites_insert ON public.project_invites;
CREATE POLICY project_invites_insert ON public.project_invites
  FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND (
      public.is_admin()
      OR public.is_lecturer_of_group(group_id)
      OR EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = project_invites.group_id
          AND student_id = auth.uid()
          AND role = 'Leader'
      )
    )
  );

-- Update: allowed only for the group's Leader
DROP POLICY IF EXISTS project_invites_update ON public.project_invites;
CREATE POLICY project_invites_update ON public.project_invites
  FOR UPDATE
  USING (
    public.is_admin()
    OR public.is_lecturer_of_group(group_id)
    OR auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = project_invites.group_id
        AND student_id = auth.uid()
        AND role = 'Leader'
    )
  )
  WITH CHECK (
    public.is_admin()
    OR public.is_lecturer_of_group(group_id)
    OR auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = project_invites.group_id
        AND student_id = auth.uid()
        AND role = 'Leader'
    )
  );

-- Delete: allowed only for the group's Leader
DROP POLICY IF EXISTS project_invites_delete ON public.project_invites;
CREATE POLICY project_invites_delete ON public.project_invites
  FOR DELETE
  USING (
    public.is_admin()
    OR public.is_lecturer_of_group(group_id)
    OR auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = project_invites.group_id
        AND student_id = auth.uid()
        AND role = 'Leader'
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Define RLS Policies for public.join_requests
-- ---------------------------------------------------------------------------

-- Select: allowed for the requesting user OR the leader of the group
DROP POLICY IF EXISTS join_requests_select ON public.join_requests;
CREATE POLICY join_requests_select ON public.join_requests
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_admin()
    OR public.is_lecturer_of_group(group_id)
    OR EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = join_requests.group_id
        AND student_id = auth.uid()
        AND role = 'Leader'
    )
  );

-- Insert: allowed for any authenticated user (must be for their own user_id, or Admin)
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

-- Update: allowed for the leader of the group
DROP POLICY IF EXISTS join_requests_update ON public.join_requests;
CREATE POLICY join_requests_update ON public.join_requests
  FOR UPDATE
  USING (
    public.is_admin()
    OR public.is_lecturer_of_group(group_id)
    OR EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = join_requests.group_id
        AND student_id = auth.uid()
        AND role = 'Leader'
    )
  )
  WITH CHECK (
    public.is_admin()
    OR public.is_lecturer_of_group(group_id)
    OR EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = join_requests.group_id
        AND student_id = auth.uid()
        AND role = 'Leader'
    )
  );

-- Delete: allowed for the leader of the group
DROP POLICY IF EXISTS join_requests_delete ON public.join_requests;
CREATE POLICY join_requests_delete ON public.join_requests
  FOR DELETE
  USING (
    public.is_admin()
    OR public.is_lecturer_of_group(group_id)
    OR EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = join_requests.group_id
        AND student_id = auth.uid()
        AND role = 'Leader'
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Grant Permissions
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.project_invites TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.join_requests TO authenticated, service_role;
