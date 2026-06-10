-- Email-based group invitation log for lecturer workflow.

CREATE TABLE IF NOT EXISTS public.group_email_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  invited_user_id uuid REFERENCES public.users (id) ON DELETE SET NULL,
  invite_code text NOT NULL REFERENCES public.project_invites (id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'revoked')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS group_email_invites_group_email_idx
  ON public.group_email_invites (group_id, invited_email);

CREATE INDEX IF NOT EXISTS group_email_invites_group_id_idx
  ON public.group_email_invites (group_id);

CREATE INDEX IF NOT EXISTS group_email_invites_invited_user_id_idx
  ON public.group_email_invites (invited_user_id);

ALTER TABLE public.group_email_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS group_email_invites_select ON public.group_email_invites;
CREATE POLICY group_email_invites_select ON public.group_email_invites
  FOR SELECT
  USING (
    public.is_admin()
    OR public.is_lecturer_of_group(group_id)
    OR invited_user_id = auth.uid()
  );

DROP POLICY IF EXISTS group_email_invites_insert ON public.group_email_invites;
CREATE POLICY group_email_invites_insert ON public.group_email_invites
  FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR (
      created_by = auth.uid()
      AND public.is_lecturer_of_group(group_id)
    )
  );

DROP POLICY IF EXISTS group_email_invites_update ON public.group_email_invites;
CREATE POLICY group_email_invites_update ON public.group_email_invites
  FOR UPDATE
  USING (
    public.is_admin()
    OR public.is_lecturer_of_group(group_id)
  )
  WITH CHECK (
    public.is_admin()
    OR public.is_lecturer_of_group(group_id)
  );

DROP POLICY IF EXISTS group_email_invites_delete ON public.group_email_invites;
CREATE POLICY group_email_invites_delete ON public.group_email_invites
  FOR DELETE
  USING (
    public.is_admin()
    OR public.is_lecturer_of_group(group_id)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.group_email_invites TO authenticated;
