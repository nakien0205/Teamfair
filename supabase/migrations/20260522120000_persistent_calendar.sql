-- Migration to support custom calendar events persistence and group member roles.
-- Timestamp: 2026-05-22 12:00:00

-- ---------------------------------------------------------------------------
-- 1. Create a public.event_type ENUM
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.event_type AS ENUM ('Meeting', 'Task Deadline', 'Milestone');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Create the public.calendar_events table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  title text NOT NULL,
  type public.event_type NOT NULL,
  event_date date NOT NULL,
  event_time text,
  description text,
  created_by_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for foreign key performance
CREATE INDEX IF NOT EXISTS calendar_events_group_id_idx ON public.calendar_events (group_id);

-- ---------------------------------------------------------------------------
-- 3. Enable Row-Level Security on public.calendar_events
-- ---------------------------------------------------------------------------
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 4. Define RLS Policies for public.calendar_events
-- ---------------------------------------------------------------------------

-- SELECT POLICIES: Align with the group_members/tasks select policy in 20260515100000_teamfair_rls.sql
DROP POLICY IF EXISTS calendar_events_select_admin ON public.calendar_events;
CREATE POLICY calendar_events_select_admin ON public.calendar_events
  FOR SELECT
  USING (public.is_admin ());

DROP POLICY IF EXISTS calendar_events_select_lecturer ON public.calendar_events;
CREATE POLICY calendar_events_select_lecturer ON public.calendar_events
  FOR SELECT
  USING (public.is_lecturer_of_group (group_id));

DROP POLICY IF EXISTS calendar_events_select_student ON public.calendar_events;
CREATE POLICY calendar_events_select_student ON public.calendar_events
  FOR SELECT
  USING (public.current_user_role () = 'student'
    AND public.is_student_member_of_group (group_id));

-- INSERT, UPDATE, DELETE POLICIES: Users can modify events if they are members of the group, or the lecturer, or an admin
DROP POLICY IF EXISTS calendar_events_insert ON public.calendar_events;
CREATE POLICY calendar_events_insert ON public.calendar_events FOR INSERT
  WITH CHECK (
    public.is_admin() 
    OR public.is_lecturer_of_group(group_id)
    OR (public.current_user_role() = 'student' AND public.is_student_member_of_group(group_id))
  );

DROP POLICY IF EXISTS calendar_events_update ON public.calendar_events;
CREATE POLICY calendar_events_update ON public.calendar_events FOR UPDATE
  USING (
    public.is_admin() 
    OR public.is_lecturer_of_group(group_id)
    OR (public.current_user_role() = 'student' AND public.is_student_member_of_group(group_id))
  )
  WITH CHECK (
    public.is_admin() 
    OR public.is_lecturer_of_group(group_id)
    OR (public.current_user_role() = 'student' AND public.is_student_member_of_group(group_id))
  );

DROP POLICY IF EXISTS calendar_events_delete ON public.calendar_events;
CREATE POLICY calendar_events_delete ON public.calendar_events FOR DELETE
  USING (
    public.is_admin() 
    OR public.is_lecturer_of_group(group_id)
    OR (public.current_user_role() = 'student' AND public.is_student_member_of_group(group_id))
  );

-- ---------------------------------------------------------------------------
-- 5. Add role column to public.group_members
-- ---------------------------------------------------------------------------
ALTER TABLE public.group_members
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'Member';

-- ---------------------------------------------------------------------------
-- 6. Grant appropriate permissions on public.calendar_events
-- ---------------------------------------------------------------------------
GRANT USAGE ON TYPE public.event_type TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.calendar_events TO authenticated, service_role;
GRANT SELECT ON TABLE public.calendar_events TO anon;
