-- Project deletion is intentionally database-owned. Storage objects are not
-- foreign-keyed to groups, so this migration does not claim to remove them.

REVOKE DELETE ON TABLE public.groups FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS groups_delete ON public.groups;

CREATE OR REPLACE FUNCTION public.delete_project(
  p_group_id uuid,
  p_project_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_group public.groups%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL OR p_group_id IS NULL OR p_project_name IS NULL THEN
    RAISE EXCEPTION 'project_delete_denied' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_group
  FROM public.groups
  WHERE id = p_group_id
  FOR UPDATE;

  IF NOT FOUND
    OR v_group.project_name <> p_project_name
    OR NOT (
      public.is_admin()
      OR v_group.owner_id = v_actor_id
      OR v_group.lecturer_id = v_actor_id
    ) THEN
    RAISE EXCEPTION 'project_delete_denied' USING ERRCODE = '42501';
  END IF;

  -- `peer_reviews.period_task_id` is RESTRICT, so remove reviews before the
  -- group cascade reaches the task-scoped period rows. These rows belong only
  -- to this group and are deleted, never detached or orphaned.
  DELETE FROM public.peer_reviews WHERE group_id = v_group.id;
  DELETE FROM public.peer_review_period_tasks WHERE group_id = v_group.id;

  DELETE FROM public.groups WHERE id = v_group.id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_project(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_project(uuid, text) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
