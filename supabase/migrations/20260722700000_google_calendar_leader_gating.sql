-- Migration: Leader Plan Gating for Google Calendar Task Sync
-- Schema version: 20260722700000

-- Helper RPC to check if group owner/leader has pro_group or pro_max plan
CREATE OR REPLACE FUNCTION public.group_leader_has_pro_features(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT public.billing_plan_for_user(g.owner_id) IN ('pro_group', 'pro_max')
      FROM public.groups g
      WHERE g.id = p_group_id
    ),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.group_leader_has_pro_features(uuid) TO authenticated, service_role;

-- Update task sync trigger function to enforce leader pro plan requirement
CREATE OR REPLACE FUNCTION private.trg_google_calendar_task_sync_reconcile_func()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'private'
AS $$
DECLARE
  v_group_id uuid;
  v_is_leader_pro boolean;
BEGIN
  v_group_id := COALESCE(NEW.group_id, OLD.group_id);

  -- Check if group leader has pro_group or pro_max plan
  SELECT public.group_leader_has_pro_features(v_group_id) INTO v_is_leader_pro;

  IF NOT v_is_leader_pro THEN
    -- Group leader is on free plan: do not sync tasks to member Google Calendars
    RETURN NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.assignee_id IS NOT NULL AND NEW.deadline IS NOT NULL THEN
      -- Create assignee connection row if missing
      INSERT INTO public.google_calendar_connections (owner_id, status, updated_at)
      VALUES (NEW.assignee_id, 'disconnected', now())
      ON CONFLICT (owner_id) DO NOTHING;

      INSERT INTO private.google_calendar_task_sync_desired (
        task_id,
        owner_id,
        desired_operation,
        desired_version,
        task_title,
        task_description,
        task_deadline,
        available_at,
        attempt_count,
        updated_at
      ) VALUES (
        NEW.id,
        NEW.assignee_id,
        'upsert',
        1,
        NEW.title,
        NEW.description,
        NEW.deadline::date,
        now(),
        0,
        now()
      )
      ON CONFLICT (task_id, owner_id) DO UPDATE SET
        desired_operation = 'upsert',
        desired_version = private.google_calendar_task_sync_desired.desired_version + 1,
        task_title = EXCLUDED.task_title,
        task_description = EXCLUDED.task_description,
        task_deadline = EXCLUDED.task_deadline,
        available_at = now(),
        attempt_count = 0,
        last_error_code = NULL,
        blocked_reason = NULL,
        dead_lettered_at = NULL,
        updated_at = now();
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Check if reassigned away from OLD assignee
    IF OLD.assignee_id IS NOT NULL AND (OLD.assignee_id IS DISTINCT FROM NEW.assignee_id OR NEW.deadline IS NULL) THEN
      INSERT INTO public.google_calendar_connections (owner_id, status, updated_at)
      VALUES (OLD.assignee_id, 'disconnected', now())
      ON CONFLICT (owner_id) DO NOTHING;

      INSERT INTO private.google_calendar_task_sync_desired (
        task_id,
        owner_id,
        desired_operation,
        desired_version,
        available_at,
        attempt_count,
        updated_at
      ) VALUES (
        OLD.id,
        OLD.assignee_id,
        'delete',
        1,
        now(),
        0,
        now()
      )
      ON CONFLICT (task_id, owner_id) DO UPDATE SET
        desired_operation = 'delete',
        desired_version = private.google_calendar_task_sync_desired.desired_version + 1,
        available_at = now(),
        attempt_count = 0,
        last_error_code = NULL,
        blocked_reason = NULL,
        dead_lettered_at = NULL,
        updated_at = now();
    END IF;

    -- Upsert for NEW assignee if eligible
    IF NEW.assignee_id IS NOT NULL AND NEW.deadline IS NOT NULL THEN
      INSERT INTO public.google_calendar_connections (owner_id, status, updated_at)
      VALUES (NEW.assignee_id, 'disconnected', now())
      ON CONFLICT (owner_id) DO NOTHING;

      INSERT INTO private.google_calendar_task_sync_desired (
        task_id,
        owner_id,
        desired_operation,
        desired_version,
        task_title,
        task_description,
        task_deadline,
        available_at,
        attempt_count,
        updated_at
      ) VALUES (
        NEW.id,
        NEW.assignee_id,
        'upsert',
        1,
        NEW.title,
        NEW.description,
        NEW.deadline::date,
        now(),
        0,
        now()
      )
      ON CONFLICT (task_id, owner_id) DO UPDATE SET
        desired_operation = 'upsert',
        desired_version = private.google_calendar_task_sync_desired.desired_version + 1,
        task_title = EXCLUDED.task_title,
        task_description = EXCLUDED.task_description,
        task_deadline = EXCLUDED.task_deadline,
        available_at = now(),
        attempt_count = 0,
        last_error_code = NULL,
        blocked_reason = NULL,
        dead_lettered_at = NULL,
        updated_at = now();
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.assignee_id IS NOT NULL THEN
      INSERT INTO public.google_calendar_connections (owner_id, status, updated_at)
      VALUES (OLD.assignee_id, 'disconnected', now())
      ON CONFLICT (owner_id) DO NOTHING;

      INSERT INTO private.google_calendar_task_sync_desired (
        task_id,
        owner_id,
        desired_operation,
        desired_version,
        available_at,
        attempt_count,
        updated_at
      ) VALUES (
        OLD.id,
        OLD.assignee_id,
        'delete',
        1,
        now(),
        0,
        now()
      )
      ON CONFLICT (task_id, owner_id) DO UPDATE SET
        desired_operation = 'delete',
        desired_version = private.google_calendar_task_sync_desired.desired_version + 1,
        available_at = now(),
        attempt_count = 0,
        last_error_code = NULL,
        blocked_reason = NULL,
        dead_lettered_at = NULL,
        updated_at = now();
    END IF;
  END IF;

  RETURN NULL;
END;
$$;
