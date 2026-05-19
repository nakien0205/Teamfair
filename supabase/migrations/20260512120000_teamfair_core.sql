-- Teamfair core schema: enums, tables, indexes, auth sync triggers, RLS enabled (policies in a later migration).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE public.user_role AS ENUM ('student', 'lecturer', 'admin');

CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'done');

-- ---------------------------------------------------------------------------
-- public.users (extends auth.users)
-- ---------------------------------------------------------------------------

CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.user_role NOT NULL DEFAULT 'student',
  full_name text NOT NULL
);

CREATE INDEX users_email_idx ON public.users (email);
CREATE INDEX users_role_idx ON public.users (role);

-- ---------------------------------------------------------------------------
-- groups (teams)
-- ---------------------------------------------------------------------------

CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  project_name text NOT NULL,
  lecturer_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX groups_lecturer_id_idx ON public.groups (lecturer_id);

-- ---------------------------------------------------------------------------
-- group_members
-- ---------------------------------------------------------------------------

CREATE TABLE public.group_members (
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, student_id)
);

CREATE INDEX group_members_student_id_idx ON public.group_members (student_id);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assignee_id uuid REFERENCES public.users (id) ON DELETE SET NULL,
  status public.task_status NOT NULL DEFAULT 'todo',
  weight integer NOT NULL,
  proof_url text,
  CONSTRAINT tasks_weight_chk CHECK (
    weight >= 1
    AND weight <= 10
  )
);

CREATE INDEX tasks_group_id_idx ON public.tasks (group_id);
CREATE INDEX tasks_assignee_id_idx ON public.tasks (assignee_id);

-- ---------------------------------------------------------------------------
-- contribution_logs
-- Spec asked for column name "timestamp"; Postgres reserves TIMESTAMP — use logged_at.
-- ---------------------------------------------------------------------------

CREATE TABLE public.contribution_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  student_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
  log_text text NOT NULL,
  hours_spent numeric(6, 2) NOT NULL,
  logged_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contribution_logs_hours_chk CHECK (hours_spent >= 0)
);

CREATE INDEX contribution_logs_task_id_idx ON public.contribution_logs (task_id);
CREATE INDEX contribution_logs_student_id_idx ON public.contribution_logs (student_id);

-- ---------------------------------------------------------------------------
-- ai_evaluations
-- ---------------------------------------------------------------------------

CREATE TABLE public.ai_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  ai_score integer NOT NULL,
  ai_reasoning text NOT NULL,
  flagged_for_review boolean NOT NULL DEFAULT false,
  CONSTRAINT ai_evaluations_score_chk CHECK (
    ai_score >= 1
    AND ai_score <= 100
  )
);

CREATE INDEX ai_evaluations_group_id_idx ON public.ai_evaluations (group_id);
CREATE INDEX ai_evaluations_student_id_idx ON public.ai_evaluations (student_id);
CREATE INDEX ai_evaluations_flagged_idx ON public.ai_evaluations (flagged_for_review)
WHERE
  flagged_for_review = true;

-- ---------------------------------------------------------------------------
-- RLS helper functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_role ()
  RETURNS public.user_role
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
  SELECT
    role
  FROM
    public.users
  WHERE
    id = auth.uid ();

$$;

CREATE OR REPLACE FUNCTION public.is_admin ()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
  SELECT
    public.current_user_role () = 'admin'::public.user_role;

$$;

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
        AND public.current_user_role () = 'lecturer'::public.user_role);

$$;

CREATE OR REPLACE FUNCTION public.task_group_id (p_task_id uuid)
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
  SELECT
    group_id
  FROM
    public.tasks
  WHERE
    id = p_task_id;

$$;

-- ---------------------------------------------------------------------------
-- Sync auth.users -> public.users
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user ()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
BEGIN
  INSERT INTO public.users (id, email, role, full_name)
    VALUES (NEW.id, coalesce(NEW.email, ''), 'student', coalesce(NEW.raw_user_meta_data ->> 'full_name', ''))
  ON CONFLICT (id)
    DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user ();

CREATE OR REPLACE FUNCTION public.sync_auth_user_email ()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE
      public.users
    SET
      email = coalesce(NEW.email, '')
    WHERE
      id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.sync_auth_user_email ();

-- ---------------------------------------------------------------------------
-- Row level security (policies added in 20260512120100_teamfair_rls.sql)
-- ---------------------------------------------------------------------------

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.contribution_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_evaluations ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Grants (Supabase client roles)
-- ---------------------------------------------------------------------------

GRANT USAGE ON TYPE public.user_role TO anon,
  authenticated;

GRANT USAGE ON TYPE public.task_status TO anon,
  authenticated;

GRANT EXECUTE ON FUNCTION public.current_user_role () TO authenticated;

GRANT EXECUTE ON FUNCTION public.is_admin () TO authenticated;

GRANT EXECUTE ON FUNCTION public.is_lecturer_of_group (uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.task_group_id (uuid) TO authenticated;

GRANT SELECT,
INSERT,
UPDATE,
DELETE ON TABLE public.users TO authenticated;

GRANT SELECT,
INSERT,
UPDATE,
DELETE ON TABLE public.groups TO authenticated;

GRANT SELECT,
INSERT,
UPDATE,
DELETE ON TABLE public.group_members TO authenticated;

GRANT SELECT,
INSERT,
UPDATE,
DELETE ON TABLE public.tasks TO authenticated;

GRANT SELECT,
INSERT,
UPDATE,
DELETE ON TABLE public.contribution_logs TO authenticated;

GRANT SELECT,
INSERT,
UPDATE,
DELETE ON TABLE public.ai_evaluations TO authenticated;
