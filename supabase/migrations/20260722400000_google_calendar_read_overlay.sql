-- Migration: Phase 4 Private Google Calendar Read Overlay
-- Schema version: 20260722400000

CREATE SCHEMA IF NOT EXISTS private;

-- Private overlay windows table to store per-owner/generation/range cursors and sync tokens
CREATE TABLE IF NOT EXISTS private.google_calendar_overlay_windows (
  owner_id uuid NOT NULL REFERENCES public.google_calendar_connections(owner_id) ON DELETE CASCADE,
  connection_generation bigint NOT NULL DEFAULT 0 CHECK (connection_generation >= 0),
  range_start date NOT NULL,
  range_end_exclusive date NOT NULL,
  sync_token text NULL,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, connection_generation, range_start, range_end_exclusive),
  CONSTRAINT check_range_dates CHECK (range_end_exclusive > range_start)
);

ALTER TABLE private.google_calendar_overlay_windows ENABLE ROW LEVEL SECURITY;

-- Private cached Google overlay events table (minimal stored projection)
CREATE TABLE IF NOT EXISTS private.google_calendar_overlay_events (
  owner_id uuid NOT NULL,
  connection_generation bigint NOT NULL DEFAULT 0 CHECK (connection_generation >= 0),
  range_start date NOT NULL,
  range_end_exclusive date NOT NULL,
  provider_event_id text NOT NULL,
  title text NULL,
  start_at timestamptz NULL,
  end_at timestamptz NULL,
  start_date date NULL,
  end_date date NULL,
  all_day boolean NOT NULL DEFAULT false,
  cached_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, connection_generation, range_start, range_end_exclusive, provider_event_id),
  FOREIGN KEY (owner_id, connection_generation, range_start, range_end_exclusive)
    REFERENCES private.google_calendar_overlay_windows(owner_id, connection_generation, range_start, range_end_exclusive)
    ON DELETE CASCADE
);

ALTER TABLE private.google_calendar_overlay_events ENABLE ROW LEVEL SECURITY;

-- Indexes for efficient lookup and pruning
CREATE INDEX IF NOT EXISTS idx_overlay_events_owner_gen ON private.google_calendar_overlay_events (owner_id, connection_generation);
CREATE INDEX IF NOT EXISTS idx_overlay_events_cached_at ON private.google_calendar_overlay_events (cached_at);

-- Revoke all client privileges from public, anon, authenticated
REVOKE ALL ON TABLE private.google_calendar_overlay_windows FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE private.google_calendar_overlay_windows TO service_role;

REVOKE ALL ON TABLE private.google_calendar_overlay_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE private.google_calendar_overlay_events TO service_role;

-- 1. RPC: Read overlay window cursor and cached events (Service Role Only)
CREATE OR REPLACE FUNCTION public.read_google_calendar_overlay_window(
  p_owner_id uuid,
  p_connection_generation bigint,
  p_range_start date,
  p_range_end_exclusive date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_window record;
  v_events jsonb;
BEGIN
  -- Fetch window cursor
  SELECT sync_token, last_synced_at
  INTO v_window
  FROM private.google_calendar_overlay_windows
  WHERE owner_id = p_owner_id
    AND connection_generation = p_connection_generation
    AND range_start = p_range_start
    AND range_end_exclusive = p_range_end_exclusive;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'found', false,
      'sync_token', NULL,
      'last_synced_at', NULL,
      'events', '[]'::jsonb
    );
  END IF;

  -- Fetch cached minimal events
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'provider_event_id', provider_event_id,
        'title', title,
        'start_at', start_at,
        'end_at', end_at,
        'start_date', start_date,
        'end_date', end_date,
        'all_day', all_day,
        'cached_at', cached_at
      )
    ),
    '[]'::jsonb
  )
  INTO v_events
  FROM private.google_calendar_overlay_events
  WHERE owner_id = p_owner_id
    AND connection_generation = p_connection_generation
    AND range_start = p_range_start
    AND range_end_exclusive = p_range_end_exclusive;

  RETURN jsonb_build_object(
    'found', true,
    'sync_token', v_window.sync_token,
    'last_synced_at', v_window.last_synced_at,
    'events', v_events
  );
END;
$$;

REVOKE ALL ON FUNCTION public.read_google_calendar_overlay_window FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_google_calendar_overlay_window TO service_role;

-- 2. RPC: Replace overlay window state atomically (Service Role Only)
CREATE OR REPLACE FUNCTION public.replace_google_calendar_overlay_window(
  p_owner_id uuid,
  p_connection_generation bigint,
  p_range_start date,
  p_range_end_exclusive date,
  p_sync_token text,
  p_events jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_elem jsonb;
BEGIN
  -- Upsert window cursor
  INSERT INTO private.google_calendar_overlay_windows (
    owner_id,
    connection_generation,
    range_start,
    range_end_exclusive,
    sync_token,
    last_synced_at,
    updated_at
  ) VALUES (
    p_owner_id,
    p_connection_generation,
    p_range_start,
    p_range_end_exclusive,
    p_sync_token,
    now(),
    now()
  )
  ON CONFLICT (owner_id, connection_generation, range_start, range_end_exclusive) DO UPDATE SET
    sync_token = EXCLUDED.sync_token,
    last_synced_at = now(),
    updated_at = now();

  -- Delete existing cached events for this window
  DELETE FROM private.google_calendar_overlay_events
  WHERE owner_id = p_owner_id
    AND connection_generation = p_connection_generation
    AND range_start = p_range_start
    AND range_end_exclusive = p_range_end_exclusive;

  -- Insert new cached events
  IF p_events IS NOT NULL AND jsonb_array_length(p_events) > 0 THEN
    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_events)
    LOOP
      INSERT INTO private.google_calendar_overlay_events (
        owner_id,
        connection_generation,
        range_start,
        range_end_exclusive,
        provider_event_id,
        title,
        start_at,
        end_at,
        start_date,
        end_date,
        all_day,
        cached_at
      ) VALUES (
        p_owner_id,
        p_connection_generation,
        p_range_start,
        p_range_end_exclusive,
        v_elem->>'provider_event_id',
        v_elem->>'title',
        CASE WHEN v_elem->>'start_at' IS NOT NULL THEN (v_elem->>'start_at')::timestamptz ELSE NULL END,
        CASE WHEN v_elem->>'end_at' IS NOT NULL THEN (v_elem->>'end_at')::timestamptz ELSE NULL END,
        CASE WHEN v_elem->>'start_date' IS NOT NULL THEN (v_elem->>'start_date')::date ELSE NULL END,
        CASE WHEN v_elem->>'end_date' IS NOT NULL THEN (v_elem->>'end_date')::date ELSE NULL END,
        COALESCE((v_elem->>'all_day')::boolean, false),
        now()
      );
    END LOOP;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_google_calendar_overlay_window FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_google_calendar_overlay_window TO service_role;

-- 3. RPC: Apply incremental delta update to overlay window (Service Role Only)
CREATE OR REPLACE FUNCTION public.apply_google_calendar_overlay_delta(
  p_owner_id uuid,
  p_connection_generation bigint,
  p_range_start date,
  p_range_end_exclusive date,
  p_sync_token text,
  p_upsert_events jsonb,
  p_deleted_event_ids text[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_elem jsonb;
  v_del_id text;
BEGIN
  -- Verify window exists
  IF NOT EXISTS (
    SELECT 1 FROM private.google_calendar_overlay_windows
    WHERE owner_id = p_owner_id
      AND connection_generation = p_connection_generation
      AND range_start = p_range_start
      AND range_end_exclusive = p_range_end_exclusive
  ) THEN
    RETURN false;
  END IF;

  -- Update sync token and timestamp
  UPDATE private.google_calendar_overlay_windows
  SET sync_token = p_sync_token,
      last_synced_at = now(),
      updated_at = now()
  WHERE owner_id = p_owner_id
    AND connection_generation = p_connection_generation
    AND range_start = p_range_start
    AND range_end_exclusive = p_range_end_exclusive;

  -- Delete removed events
  IF p_deleted_event_ids IS NOT NULL AND array_length(p_deleted_event_ids, 1) > 0 THEN
    FOREACH v_del_id IN ARRAY p_deleted_event_ids
    LOOP
      DELETE FROM private.google_calendar_overlay_events
      WHERE owner_id = p_owner_id
        AND connection_generation = p_connection_generation
        AND range_start = p_range_start
        AND range_end_exclusive = p_range_end_exclusive
        AND provider_event_id = v_del_id;
    END LOOP;
  END IF;

  -- Upsert modified events
  IF p_upsert_events IS NOT NULL AND jsonb_array_length(p_upsert_events) > 0 THEN
    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_upsert_events)
    LOOP
      INSERT INTO private.google_calendar_overlay_events (
        owner_id,
        connection_generation,
        range_start,
        range_end_exclusive,
        provider_event_id,
        title,
        start_at,
        end_at,
        start_date,
        end_date,
        all_day,
        cached_at
      ) VALUES (
        p_owner_id,
        p_connection_generation,
        p_range_start,
        p_range_end_exclusive,
        v_elem->>'provider_event_id',
        v_elem->>'title',
        CASE WHEN v_elem->>'start_at' IS NOT NULL THEN (v_elem->>'start_at')::timestamptz ELSE NULL END,
        CASE WHEN v_elem->>'end_at' IS NOT NULL THEN (v_elem->>'end_at')::timestamptz ELSE NULL END,
        CASE WHEN v_elem->>'start_date' IS NOT NULL THEN (v_elem->>'start_date')::date ELSE NULL END,
        CASE WHEN v_elem->>'end_date' IS NOT NULL THEN (v_elem->>'end_date')::date ELSE NULL END,
        COALESCE((v_elem->>'all_day')::boolean, false),
        now()
      )
      ON CONFLICT (owner_id, connection_generation, range_start, range_end_exclusive, provider_event_id) DO UPDATE SET
        title = EXCLUDED.title,
        start_at = EXCLUDED.start_at,
        end_at = EXCLUDED.end_at,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        all_day = EXCLUDED.all_day,
        cached_at = now();
    END LOOP;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_google_calendar_overlay_delta FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_google_calendar_overlay_delta TO service_role;

-- 4. RPC: Clear overlay state for an owner/generation/range (Service Role Only)
CREATE OR REPLACE FUNCTION public.clear_google_calendar_overlay_state(
  p_owner_id uuid,
  p_connection_generation bigint DEFAULT NULL,
  p_range_start date DEFAULT NULL,
  p_range_end_exclusive date DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_range_start IS NOT NULL AND p_range_end_exclusive IS NOT NULL AND p_connection_generation IS NOT NULL THEN
    DELETE FROM private.google_calendar_overlay_windows
    WHERE owner_id = p_owner_id
      AND connection_generation = p_connection_generation
      AND range_start = p_range_start
      AND range_end_exclusive = p_range_end_exclusive;
  ELSIF p_connection_generation IS NOT NULL THEN
    DELETE FROM private.google_calendar_overlay_windows
    WHERE owner_id = p_owner_id
      AND connection_generation = p_connection_generation;
  ELSE
    DELETE FROM private.google_calendar_overlay_windows
    WHERE owner_id = p_owner_id;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_google_calendar_overlay_state FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_google_calendar_overlay_state TO service_role;

-- 5. Trigger to purge Phase 4 data on connection disconnect or generation bump
CREATE OR REPLACE FUNCTION private.purge_google_calendar_overlay_on_connection_change_func()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'disconnected' OR NEW.connection_generation IS DISTINCT FROM OLD.connection_generation THEN
    PERFORM public.clear_google_calendar_overlay_state(NEW.owner_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purge_google_calendar_overlay_on_connection_change ON public.google_calendar_connections;
CREATE TRIGGER trg_purge_google_calendar_overlay_on_connection_change
  AFTER UPDATE ON public.google_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION private.purge_google_calendar_overlay_on_connection_change_func();
