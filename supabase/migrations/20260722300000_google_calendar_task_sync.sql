-- Migration: Phase 3 Task-to-Google Write Sync
-- Schema version: 20260722300000

CREATE SCHEMA IF NOT EXISTS private;

-- Private desired-state outbox table for Google Calendar task reconciliation
CREATE TABLE IF NOT EXISTS private.google_calendar_task_sync_desired (
  task_id uuid NOT NULL,
  owner_id uuid NOT NULL REFERENCES public.google_calendar_connections(owner_id) ON DELETE CASCADE,
  desired_operation text NOT NULL CHECK (desired_operation IN ('upsert', 'delete')),
  desired_version bigint NOT NULL DEFAULT 1 CHECK (desired_version >= 1),
  processed_version bigint NOT NULL DEFAULT 0 CHECK (processed_version >= 0),
  task_title text NULL,
  task_description text NULL,
  task_deadline date NULL,
  available_at timestamptz NOT NULL DEFAULT now(),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error_code text NULL,
  blocked_reason text NULL,
  lease_token uuid NULL,
  leased_version bigint NULL,
  leased_until timestamptz NULL,
  dead_lettered_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, owner_id)
);

ALTER TABLE private.google_calendar_task_sync_desired ENABLE ROW LEVEL SECURITY;

-- Private event mapping recovery index table
CREATE TABLE IF NOT EXISTS private.google_calendar_task_event_mappings (
  task_id uuid NOT NULL,
  owner_id uuid NOT NULL REFERENCES public.google_calendar_connections(owner_id) ON DELETE CASCADE,
  google_event_id text NOT NULL,
  connection_generation bigint NOT NULL DEFAULT 0 CHECK (connection_generation >= 0),
  last_applied_version bigint NOT NULL DEFAULT 0 CHECK (last_applied_version >= 0),
  etag text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, owner_id)
);

ALTER TABLE private.google_calendar_task_event_mappings ENABLE ROW LEVEL SECURITY;

-- Revoke all client privileges on private tables
REVOKE ALL ON TABLE private.google_calendar_task_sync_desired FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE private.google_calendar_task_sync_desired TO service_role;

REVOKE ALL ON TABLE private.google_calendar_task_event_mappings FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE private.google_calendar_task_event_mappings TO service_role;

-- 1. Helper RPC: Reconcile desired state for an owner from authoritative tasks
CREATE OR REPLACE FUNCTION private.reconcile_google_calendar_tasks_for_owner_internal(
  p_owner_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'private'
AS $$
BEGIN
  -- Insert/update upsert desired state for all eligible tasks assigned to this owner
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
    last_error_code,
    blocked_reason,
    dead_lettered_at,
    updated_at
  )
  SELECT 
    t.id,
    t.assignee_id,
    'upsert'::text,
    1::bigint,
    t.title,
    t.description,
    t.deadline::date,
    now(),
    0,
    NULL,
    NULL,
    NULL,
    now()
  FROM public.tasks t
  WHERE t.assignee_id = p_owner_id AND t.deadline IS NOT NULL
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
END;
$$;

REVOKE ALL ON FUNCTION private.reconcile_google_calendar_tasks_for_owner_internal FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.reconcile_google_calendar_tasks_for_owner_internal TO service_role;

-- Service role external RPC for owner reconciliation
CREATE OR REPLACE FUNCTION public.reconcile_google_calendar_tasks_for_owner(
  p_owner_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'private'
AS $$
BEGIN
  PERFORM private.reconcile_google_calendar_tasks_for_owner_internal(p_owner_id);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_google_calendar_tasks_for_owner FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_google_calendar_tasks_for_owner TO service_role;

-- 2. Trigger on public.tasks to populate desired sync state
CREATE OR REPLACE FUNCTION private.trg_google_calendar_task_sync_reconcile_func()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'private'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assignee_id IS NOT NULL AND NEW.deadline IS NOT NULL THEN
      -- Create owner connection row if missing to satisfy FK
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

DROP TRIGGER IF EXISTS trg_google_calendar_task_sync_reconcile ON public.tasks;
CREATE TRIGGER trg_google_calendar_task_sync_reconcile
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION private.trg_google_calendar_task_sync_reconcile_func();

-- 3. Trigger on public.google_calendar_connections to handle disconnect cleanup & reconnect wake
CREATE OR REPLACE FUNCTION private.trg_google_calendar_connection_sync_reconcile_func()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'private'
AS $$
BEGIN
  IF NEW.status = 'disconnected' AND OLD.status != 'disconnected' THEN
    -- Disconnect cleanup: delete Phase 3 private rows for this owner
    DELETE FROM private.google_calendar_task_sync_desired WHERE owner_id = NEW.owner_id;
    DELETE FROM private.google_calendar_task_event_mappings WHERE owner_id = NEW.owner_id;
  ELSIF NEW.status = 'connected' AND NEW.opted_in = true AND (OLD.status != 'connected' OR OLD.opted_in = false) THEN
    -- Wake / reconcile eligible tasks for owner
    PERFORM private.reconcile_google_calendar_tasks_for_owner_internal(NEW.owner_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_google_calendar_connection_sync_reconcile ON public.google_calendar_connections;
CREATE TRIGGER trg_google_calendar_connection_sync_reconcile
  AFTER UPDATE ON public.google_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION private.trg_google_calendar_connection_sync_reconcile_func();

-- 4. RPC: Claim due sync jobs (Service Role Only)
CREATE OR REPLACE FUNCTION public.claim_google_calendar_task_sync_jobs(
  p_worker_id text,
  p_batch_size integer,
  p_lease_seconds integer
)
RETURNS TABLE (
  task_id uuid,
  owner_id uuid,
  desired_operation text,
  desired_version bigint,
  processed_version bigint,
  task_title text,
  task_description text,
  task_deadline date,
  attempt_count integer,
  lease_token uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'private'
AS $$
DECLARE
  v_batch_limit integer;
  v_lease_ttl integer;
  v_token uuid;
BEGIN
  v_batch_limit := LEAST(GREATEST(p_batch_size, 1), 10);
  v_lease_ttl := LEAST(GREATEST(p_lease_seconds, 30), 300);
  v_token := gen_random_uuid();

  RETURN QUERY
  WITH due_rows AS (
    SELECT d.task_id, d.owner_id
    FROM private.google_calendar_task_sync_desired d
    JOIN public.google_calendar_connections c ON c.owner_id = d.owner_id
    WHERE d.available_at <= now()
      AND d.dead_lettered_at IS NULL
      AND (d.leased_until IS NULL OR d.leased_until < now())
      AND (d.processed_version < d.desired_version OR d.desired_operation = 'delete')
      AND c.status = 'connected'
      AND c.opted_in = true
    ORDER BY d.available_at ASC
    LIMIT v_batch_limit
    FOR UPDATE OF d SKIP LOCKED
  )
  UPDATE private.google_calendar_task_sync_desired d
  SET lease_token = v_token,
      leased_version = d.desired_version,
      leased_until = now() + (v_lease_ttl || ' seconds')::interval,
      updated_at = now()
  FROM due_rows r
  WHERE d.task_id = r.task_id AND d.owner_id = r.owner_id
  RETURNING 
    d.task_id,
    d.owner_id,
    d.desired_operation,
    d.desired_version,
    d.processed_version,
    d.task_title,
    d.task_description,
    d.task_deadline,
    d.attempt_count,
    v_token AS lease_token;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_google_calendar_task_sync_jobs FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_google_calendar_task_sync_jobs TO service_role;

-- 5. RPC: Complete sync job with version CAS (Service Role Only)
CREATE OR REPLACE FUNCTION public.complete_google_calendar_task_sync_job(
  p_task_id uuid,
  p_owner_id uuid,
  p_lease_token uuid,
  p_claimed_version bigint,
  p_google_event_id text,
  p_etag text,
  p_connection_generation bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'private'
AS $$
DECLARE
  v_updated boolean := false;
  v_desired_op text;
BEGIN
  -- Verify lease token and version CAS
  SELECT desired_operation INTO v_desired_op
  FROM private.google_calendar_task_sync_desired
  WHERE task_id = p_task_id 
    AND owner_id = p_owner_id
    AND lease_token = p_lease_token
    AND leased_version = p_claimed_version;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_desired_op = 'delete' THEN
    -- Delete mapping row
    DELETE FROM private.google_calendar_task_event_mappings
    WHERE task_id = p_task_id AND owner_id = p_owner_id;

    -- Update processed version and clear lease
    UPDATE private.google_calendar_task_sync_desired
    SET processed_version = p_claimed_version,
        lease_token = NULL,
        leased_version = NULL,
        leased_until = NULL,
        attempt_count = 0,
        last_error_code = NULL,
        updated_at = now()
    WHERE task_id = p_task_id AND owner_id = p_owner_id;

    v_updated := true;
  ELSE
    -- Upsert mapping row
    IF p_google_event_id IS NOT NULL THEN
      INSERT INTO private.google_calendar_task_event_mappings (
        task_id,
        owner_id,
        google_event_id,
        connection_generation,
        last_applied_version,
        etag,
        updated_at
      ) VALUES (
        p_task_id,
        p_owner_id,
        p_google_event_id,
        COALESCE(p_connection_generation, 0),
        p_claimed_version,
        p_etag,
        now()
      )
      ON CONFLICT (task_id, owner_id) DO UPDATE SET
        google_event_id = EXCLUDED.google_event_id,
        connection_generation = EXCLUDED.connection_generation,
        last_applied_version = EXCLUDED.last_applied_version,
        etag = EXCLUDED.etag,
        updated_at = now();
    END IF;

    -- Update processed version and clear lease
    UPDATE private.google_calendar_task_sync_desired
    SET processed_version = p_claimed_version,
        lease_token = NULL,
        leased_version = NULL,
        leased_until = NULL,
        attempt_count = 0,
        last_error_code = NULL,
        updated_at = now()
    WHERE task_id = p_task_id AND owner_id = p_owner_id;

    v_updated := true;
  END IF;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_google_calendar_task_sync_job FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_google_calendar_task_sync_job TO service_role;

-- 6. RPC: Reschedule / Fail sync job (Service Role Only)
CREATE OR REPLACE FUNCTION public.reschedule_google_calendar_task_sync_job(
  p_task_id uuid,
  p_owner_id uuid,
  p_lease_token uuid,
  p_claimed_version bigint,
  p_outcome_code text,
  p_available_at timestamptz,
  p_consume_attempt boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'private'
AS $$
DECLARE
  v_current_attempts integer;
BEGIN
  SELECT attempt_count INTO v_current_attempts
  FROM private.google_calendar_task_sync_desired
  WHERE task_id = p_task_id 
    AND owner_id = p_owner_id
    AND lease_token = p_lease_token
    AND leased_version = p_claimed_version;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF p_consume_attempt THEN
    v_current_attempts := v_current_attempts + 1;
  END IF;

  IF v_current_attempts >= 8 THEN
    UPDATE private.google_calendar_task_sync_desired
    SET attempt_count = v_current_attempts,
        blocked_reason = p_outcome_code,
        dead_lettered_at = now(),
        lease_token = NULL,
        leased_version = NULL,
        leased_until = NULL,
        updated_at = now()
    WHERE task_id = p_task_id AND owner_id = p_owner_id;
  ELSE
    UPDATE private.google_calendar_task_sync_desired
    SET attempt_count = v_current_attempts,
        last_error_code = p_outcome_code,
        available_at = COALESCE(p_available_at, now()),
        lease_token = NULL,
        leased_version = NULL,
        leased_until = NULL,
        updated_at = now()
    WHERE task_id = p_task_id AND owner_id = p_owner_id;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.reschedule_google_calendar_task_sync_job FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_google_calendar_task_sync_job TO service_role;
