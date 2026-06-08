-- Repair migration for environments where rubric tables already exist
-- but public.is_lecturer_of_project() still points to public.projects.

CREATE OR REPLACE FUNCTION public.is_lecturer_of_project(p_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.groups g
    WHERE g.id = p_project_id
      AND g.lecturer_id = auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_lecturer_of_project(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
