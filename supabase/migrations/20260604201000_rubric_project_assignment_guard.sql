-- Ensure rubric/project access follows lecturer assignment on public.groups.

CREATE OR REPLACE FUNCTION public.is_lecturer_of_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.groups g
    WHERE g.id = p_project_id
      AND g.lecturer_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_lecturer_of_project(uuid) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
