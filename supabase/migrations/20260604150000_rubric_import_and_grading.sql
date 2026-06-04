-- SQL Migration for Lecturer Rubric Spreadsheet Import and Grading
-- Filename: 20260604150000_rubric_import_and_grading.sql

-- ---------------------------------------------------------------------------
-- 1. Create Tables
-- ---------------------------------------------------------------------------

-- Table public.rubrics
CREATE TABLE IF NOT EXISTS public.rubrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  course_id text,
  name text NOT NULL,
  description text,
  original_file_name text,
  file_type text,
  status text NOT NULL DEFAULT 'Active', -- e.g. 'Active', 'Archived'
  created_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table public.rubric_templates
CREATE TABLE IF NOT EXISTS public.rubric_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id uuid NOT NULL UNIQUE REFERENCES public.rubrics (id) ON DELETE CASCADE,
  table_json jsonb NOT NULL,
  columns_json jsonb NOT NULL,
  settings_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table public.rubric_grades
CREATE TABLE IF NOT EXISTS public.rubric_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id uuid NOT NULL REFERENCES public.rubrics (id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  graded_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  grade_table_json jsonb NOT NULL,
  total_score numeric(5, 2) NOT NULL DEFAULT 0.0,
  max_total_score numeric(5, 2) NOT NULL DEFAULT 0.0,
  status text NOT NULL DEFAULT 'Draft', -- 'Draft' or 'Submitted'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rubric_grades_unique_rubric_group UNIQUE (rubric_id, group_id)
);

-- Table public.rubric_audit_logs
CREATE TABLE IF NOT EXISTS public.rubric_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users (id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS rubrics_project_id_idx ON public.rubrics (project_id);
CREATE INDEX IF NOT EXISTS rubrics_created_by_idx ON public.rubrics (created_by);
CREATE INDEX IF NOT EXISTS rubric_templates_rubric_id_idx ON public.rubric_templates (rubric_id);
CREATE INDEX IF NOT EXISTS rubric_grades_rubric_id_idx ON public.rubric_grades (rubric_id);
CREATE INDEX IF NOT EXISTS rubric_grades_group_id_idx ON public.rubric_grades (group_id);
CREATE INDEX IF NOT EXISTS rubric_grades_project_id_idx ON public.rubric_grades (project_id);
CREATE INDEX IF NOT EXISTS rubric_audit_logs_user_id_idx ON public.rubric_audit_logs (user_id);

-- ---------------------------------------------------------------------------
-- 3. Enable RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_audit_logs ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 4. RLS Policies
-- ---------------------------------------------------------------------------

-- Rubrics Policies
CREATE POLICY rubrics_select_admin ON public.rubrics
  FOR SELECT USING (public.is_admin());

CREATE POLICY rubrics_select_lecturer ON public.rubrics
  FOR SELECT USING (
    public.current_user_role() = 'lecturer'::public.user_role 
    AND public.is_lecturer_of_group(project_id)
  );

CREATE POLICY rubrics_insert ON public.rubrics
  FOR INSERT WITH CHECK (
    public.is_admin() 
    OR (
      public.current_user_role() = 'lecturer'::public.user_role 
      AND public.is_lecturer_of_group(project_id)
    )
  );

CREATE POLICY rubrics_update ON public.rubrics
  FOR UPDATE USING (
    public.is_admin() 
    OR (
      public.current_user_role() = 'lecturer'::public.user_role 
      AND public.is_lecturer_of_group(project_id)
    )
  ) WITH CHECK (
    public.is_admin() 
    OR (
      public.current_user_role() = 'lecturer'::public.user_role 
      AND public.is_lecturer_of_group(project_id)
    )
  );

CREATE POLICY rubrics_delete ON public.rubrics
  FOR DELETE USING (
    public.is_admin() 
    OR (
      public.current_user_role() = 'lecturer'::public.user_role 
      AND public.is_lecturer_of_group(project_id)
    )
  );


-- Rubric Templates Policies
CREATE POLICY templates_select_admin ON public.rubric_templates
  FOR SELECT USING (public.is_admin());

CREATE POLICY templates_select_lecturer ON public.rubric_templates
  FOR SELECT USING (
    public.current_user_role() = 'lecturer'::public.user_role 
    AND EXISTS (
      SELECT 1 FROM public.rubrics r 
      WHERE r.id = rubric_templates.rubric_id 
      AND public.is_lecturer_of_group(r.project_id)
    )
  );

CREATE POLICY templates_insert ON public.rubric_templates
  FOR INSERT WITH CHECK (
    public.is_admin() 
    OR (
      public.current_user_role() = 'lecturer'::public.user_role 
      AND EXISTS (
        SELECT 1 FROM public.rubrics r 
        WHERE r.id = rubric_templates.rubric_id 
        AND public.is_lecturer_of_group(r.project_id)
      )
    )
  );

CREATE POLICY templates_update ON public.rubric_templates
  FOR UPDATE USING (
    public.is_admin() 
    OR (
      public.current_user_role() = 'lecturer'::public.user_role 
      AND EXISTS (
        SELECT 1 FROM public.rubrics r 
        WHERE r.id = rubric_templates.rubric_id 
        AND public.is_lecturer_of_group(r.project_id)
      )
    )
  ) WITH CHECK (
    public.is_admin() 
    OR (
      public.current_user_role() = 'lecturer'::public.user_role 
      AND EXISTS (
        SELECT 1 FROM public.rubrics r 
        WHERE r.id = rubric_templates.rubric_id 
        AND public.is_lecturer_of_group(r.project_id)
      )
    )
  );

CREATE POLICY templates_delete ON public.rubric_templates
  FOR DELETE USING (
    public.is_admin() 
    OR (
      public.current_user_role() = 'lecturer'::public.user_role 
      AND EXISTS (
        SELECT 1 FROM public.rubrics r 
        WHERE r.id = rubric_templates.rubric_id 
        AND public.is_lecturer_of_group(r.project_id)
      )
    )
  );


-- Rubric Grades Policies
CREATE POLICY grades_select_admin ON public.rubric_grades
  FOR SELECT USING (public.is_admin());

CREATE POLICY grades_select_lecturer ON public.rubric_grades
  FOR SELECT USING (
    public.current_user_role() = 'lecturer'::public.user_role 
    AND public.is_lecturer_of_group(project_id)
  );

CREATE POLICY grades_select_student ON public.rubric_grades
  FOR SELECT USING (
    public.current_user_role() = 'student'::public.user_role 
    AND public.is_student_member_of_group(group_id)
  );

CREATE POLICY grades_insert ON public.rubric_grades
  FOR INSERT WITH CHECK (
    public.is_admin() 
    OR (
      public.current_user_role() = 'lecturer'::public.user_role 
      AND public.is_lecturer_of_group(project_id)
    )
  );

CREATE POLICY grades_update ON public.rubric_grades
  FOR UPDATE USING (
    public.is_admin() 
    OR (
      public.current_user_role() = 'lecturer'::public.user_role 
      AND public.is_lecturer_of_group(project_id)
    )
  ) WITH CHECK (
    public.is_admin() 
    OR (
      public.current_user_role() = 'lecturer'::public.user_role 
      AND public.is_lecturer_of_group(project_id)
    )
  );

CREATE POLICY grades_delete ON public.rubric_grades
  FOR DELETE USING (
    public.is_admin() 
    OR (
      public.current_user_role() = 'lecturer'::public.user_role 
      AND public.is_lecturer_of_group(project_id)
    )
  );


-- Rubric Audit Logs Policies
CREATE POLICY audit_logs_select_admin ON public.rubric_audit_logs
  FOR SELECT USING (public.is_admin());

CREATE POLICY audit_logs_select_lecturer ON public.rubric_audit_logs
  FOR SELECT USING (public.current_user_role() = 'lecturer'::public.user_role);

CREATE POLICY audit_logs_insert ON public.rubric_audit_logs
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    AND public.current_user_role() IN ('lecturer'::public.user_role, 'admin'::public.user_role)
  );

-- ---------------------------------------------------------------------------
-- 5. Database Permissions (Grants)
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rubrics TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rubric_templates TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rubric_grades TO anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.rubric_audit_logs TO anon, authenticated;
