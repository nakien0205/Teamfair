-- Migration: Phase 2 Google Connection and Credential Custody
-- Schema version: 20260722200000

CREATE SCHEMA IF NOT EXISTS private;

-- Public connection status metadata table (browser safe)
CREATE TABLE IF NOT EXISTS public.google_calendar_connections (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('not_connected', 'consent_pending', 'connected', 'attention_needed', 'disconnecting', 'disconnected')),
  opted_in boolean NOT NULL DEFAULT false,
  granted_scopes text[] NOT NULL DEFAULT '{}',
  google_subject_hash text NULL CHECK (google_subject_hash IS NULL OR google_subject_hash ~ '^[0-9a-f]{64}$'),
  connection_generation bigint NOT NULL DEFAULT 0 CHECK (connection_generation >= 0),
  attention_code text NULL CHECK (attention_code IS NULL OR attention_code IN ('entitlement_required', 'reconnect_required', 'scope_missing', 'credential_unreadable', 'revoke_unconfirmed')),
  connected_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_opted_in_requires_connected CHECK (opted_in = false OR status = 'connected')
);

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

-- Revoke direct writes from anon and authenticated
REVOKE ALL ON TABLE public.google_calendar_connections FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.google_calendar_connections TO authenticated;

CREATE POLICY google_calendar_connections_owner_select ON public.google_calendar_connections
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);

-- Private encrypted credentials table
CREATE TABLE IF NOT EXISTS private.google_calendar_credentials (
  owner_id uuid PRIMARY KEY REFERENCES public.google_calendar_connections(owner_id) ON DELETE CASCADE,
  encrypted_refresh_token text NOT NULL,
  nonce text NOT NULL,
  key_version integer NOT NULL CHECK (key_version > 0),
  credential_generation bigint NOT NULL CHECK (credential_generation >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Private OAuth state table (one-time short-lived)
CREATE TABLE IF NOT EXISTS private.google_calendar_oauth_states (
  state_digest text PRIMARY KEY CHECK (state_digest ~ '^[0-9a-f]{64}$'),
  owner_id uuid NOT NULL REFERENCES public.google_calendar_connections(owner_id) ON DELETE CASCADE,
  encrypted_pkce_verifier text NOT NULL,
  pkce_nonce text NOT NULL,
  key_version integer NOT NULL CHECK (key_version > 0),
  oidc_nonce_digest text NOT NULL CHECK (oidc_nonce_digest ~ '^[0-9a-f]{64}$'),
  redirect_uri text NOT NULL,
  scope_set_version integer NOT NULL DEFAULT 1 CHECK (scope_set_version = 1),
  connection_generation bigint NOT NULL CHECK (connection_generation >= 0),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Private operation leases table
CREATE TABLE IF NOT EXISTS private.google_calendar_operation_leases (
  owner_id uuid NOT NULL REFERENCES public.google_calendar_connections(owner_id) ON DELETE CASCADE,
  operation_id uuid NOT NULL,
  connection_generation bigint NOT NULL CHECK (connection_generation >= 0),
  purpose text NOT NULL CHECK (purpose IN ('task_event_write', 'personal_event_read', 'credential_validation')),
  acquired_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  released_at timestamptz NULL,
  PRIMARY KEY (owner_id, operation_id)
);

-- Secure private schema permissions
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA private TO service_role;

-- Security Definer RPCs

-- 1. Get browser-safe connection view for current authenticated user
CREATE OR REPLACE FUNCTION public.get_my_google_calendar_connection()
RETURNS TABLE (
  status text,
  opted_in boolean,
  granted_scopes text[],
  connection_generation bigint,
  attention_code text,
  connected_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.status,
    c.opted_in,
    c.granted_scopes,
    c.connection_generation,
    c.attention_code,
    c.connected_at,
    c.updated_at
  FROM public.google_calendar_connections c
  WHERE c.owner_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_google_calendar_connection() TO authenticated;

-- 2. Create OAuth State (Service Role Only)
CREATE OR REPLACE FUNCTION public.create_google_calendar_oauth_state(
  p_owner_id uuid,
  p_state_digest text,
  p_encrypted_pkce_verifier text,
  p_pkce_nonce text,
  p_key_version integer,
  p_oidc_nonce_digest text,
  p_redirect_uri text,
  p_scope_set_version integer,
  p_connection_generation bigint,
  p_expires_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_gen bigint;
BEGIN
  -- Upsert connection status to consent_pending if not currently connected
  INSERT INTO public.google_calendar_connections (owner_id, status, connection_generation, updated_at)
  VALUES (p_owner_id, 'consent_pending', p_connection_generation, now())
  ON CONFLICT (owner_id) DO UPDATE
  SET status = CASE 
        WHEN public.google_calendar_connections.status = 'connected' THEN public.google_calendar_connections.status
        ELSE 'consent_pending'
      END,
      updated_at = now()
  RETURNING connection_generation INTO v_current_gen;

  -- Delete previous unconsumed states for this owner
  DELETE FROM private.google_calendar_oauth_states
  WHERE owner_id = p_owner_id AND consumed_at IS NULL;

  -- Insert new state
  INSERT INTO private.google_calendar_oauth_states (
    state_digest,
    owner_id,
    encrypted_pkce_verifier,
    pkce_nonce,
    key_version,
    oidc_nonce_digest,
    redirect_uri,
    scope_set_version,
    connection_generation,
    expires_at
  ) VALUES (
    p_state_digest,
    p_owner_id,
    p_encrypted_pkce_verifier,
    p_pkce_nonce,
    p_key_version,
    p_oidc_nonce_digest,
    p_redirect_uri,
    p_scope_set_version,
    v_current_gen,
    p_expires_at
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.create_google_calendar_oauth_state FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_google_calendar_oauth_state TO service_role;

-- 3. Consume OAuth State Atomically
CREATE OR REPLACE FUNCTION public.consume_google_calendar_oauth_state(
  p_state_digest text
)
RETURNS TABLE (
  owner_id uuid,
  encrypted_pkce_verifier text,
  pkce_nonce text,
  key_version integer,
  oidc_nonce_digest text,
  redirect_uri text,
  scope_set_version integer,
  connection_generation bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  UPDATE private.google_calendar_oauth_states s
  SET consumed_at = now()
  WHERE s.state_digest = p_state_digest
    AND s.consumed_at IS NULL
    AND s.expires_at > now()
  RETURNING 
    s.owner_id,
    s.encrypted_pkce_verifier,
    s.pkce_nonce,
    s.key_version,
    s.oidc_nonce_digest,
    s.redirect_uri,
    s.scope_set_version,
    s.connection_generation;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_google_calendar_oauth_state FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_google_calendar_oauth_state TO service_role;

-- 4. Store Credential (Service Role Only)
CREATE OR REPLACE FUNCTION public.store_google_calendar_credential(
  p_owner_id uuid,
  p_expected_generation bigint,
  p_credential_generation bigint,
  p_encrypted_refresh_token text,
  p_credential_nonce text,
  p_key_version integer,
  p_google_subject_hash text,
  p_granted_scopes text[],
  p_connected_at timestamptz
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Upsert private credential
  INSERT INTO private.google_calendar_credentials (
    owner_id,
    encrypted_refresh_token,
    nonce,
    key_version,
    credential_generation,
    updated_at
  ) VALUES (
    p_owner_id,
    p_encrypted_refresh_token,
    p_credential_nonce,
    p_key_version,
    p_credential_generation,
    now()
  )
  ON CONFLICT (owner_id) DO UPDATE SET
    encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
    nonce = EXCLUDED.nonce,
    key_version = EXCLUDED.key_version,
    credential_generation = EXCLUDED.credential_generation,
    updated_at = now();

  -- Update public metadata
  UPDATE public.google_calendar_connections
  SET status = 'connected',
      opted_in = false,
      granted_scopes = p_granted_scopes,
      google_subject_hash = p_google_subject_hash,
      connection_generation = p_credential_generation,
      attention_code = NULL,
      connected_at = p_connected_at,
      updated_at = now()
  WHERE owner_id = p_owner_id;

  RETURN p_credential_generation;
END;
$$;

REVOKE ALL ON FUNCTION public.store_google_calendar_credential FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_google_calendar_credential TO service_role;

-- 5. Acquire Operation Lease
CREATE OR REPLACE FUNCTION public.acquire_google_calendar_operation_lease(
  p_owner_id uuid,
  p_expected_generation bigint,
  p_operation_id uuid,
  p_purpose text,
  p_requested_ttl_seconds integer
)
RETURNS TABLE (
  lease_acquired boolean,
  denial_code text,
  authorized_generation bigint,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_conn public.google_calendar_connections%ROWTYPE;
  v_ttl integer;
  v_expires timestamptz;
BEGIN
  SELECT * INTO v_conn FROM public.google_calendar_connections WHERE owner_id = p_owner_id;

  IF NOT FOUND OR v_conn.status != 'connected' THEN
    RETURN QUERY SELECT false, 'not_connected'::text, 0::bigint, NULL::timestamptz;
    RETURN;
  END IF;

  IF NOT v_conn.opted_in THEN
    RETURN QUERY SELECT false, 'not_opted_in'::text, v_conn.connection_generation, NULL::timestamptz;
    RETURN;
  END IF;

  IF v_conn.connection_generation != p_expected_generation THEN
    RETURN QUERY SELECT false, 'generation_mismatch'::text, v_conn.connection_generation, NULL::timestamptz;
    RETURN;
  END IF;

  -- Cap TTL between 20 and 30 seconds
  v_ttl := LEAST(GREATEST(p_requested_ttl_seconds, 20), 30);
  v_expires := now() + (v_ttl || ' seconds')::interval;

  INSERT INTO private.google_calendar_operation_leases (
    owner_id,
    operation_id,
    connection_generation,
    purpose,
    acquired_at,
    expires_at
  ) VALUES (
    p_owner_id,
    p_operation_id,
    p_expected_generation,
    p_purpose,
    now(),
    v_expires
  );

  RETURN QUERY SELECT true, NULL::text, v_conn.connection_generation, v_expires;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_google_calendar_operation_lease FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_google_calendar_operation_lease TO service_role;

-- 6. Release Operation Lease
CREATE OR REPLACE FUNCTION public.release_google_calendar_operation_lease(
  p_owner_id uuid,
  p_operation_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE private.google_calendar_operation_leases
  SET released_at = now()
  WHERE owner_id = p_owner_id AND operation_id = p_operation_id AND released_at IS NULL;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.release_google_calendar_operation_lease FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_google_calendar_operation_lease TO service_role;

-- 7. Begin Disconnect
CREATE OR REPLACE FUNCTION public.begin_google_calendar_disconnect(
  p_owner_id uuid
)
RETURNS TABLE (
  fenced_generation bigint,
  active_leases_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_new_gen bigint;
  v_active_count integer;
BEGIN
  UPDATE public.google_calendar_connections
  SET status = 'disconnecting',
      opted_in = false,
      connection_generation = connection_generation + 1,
      updated_at = now()
  WHERE owner_id = p_owner_id
  RETURNING connection_generation INTO v_new_gen;

  IF v_new_gen IS NULL THEN
    -- If no row existed, insert disconnected row with generation 1
    v_new_gen := 1;
    INSERT INTO public.google_calendar_connections (owner_id, status, opted_in, connection_generation)
    VALUES (p_owner_id, 'disconnecting', false, v_new_gen);
  END IF;

  -- Delete pending unconsumed states
  DELETE FROM private.google_calendar_oauth_states WHERE owner_id = p_owner_id;

  -- Count remaining active unexpired leases
  SELECT COUNT(*)::integer INTO v_active_count
  FROM private.google_calendar_operation_leases
  WHERE owner_id = p_owner_id AND released_at IS NULL AND expires_at > now();

  RETURN QUERY SELECT v_new_gen, v_active_count;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_google_calendar_disconnect FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_google_calendar_disconnect TO service_role;

-- 8. Finalize Disconnect
CREATE OR REPLACE FUNCTION public.finalize_google_calendar_disconnect(
  p_owner_id uuid,
  p_fenced_generation bigint
)
RETURNS TABLE (
  status text,
  active_leases_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_active_count integer;
BEGIN
  SELECT COUNT(*)::integer INTO v_active_count
  FROM private.google_calendar_operation_leases
  WHERE owner_id = p_owner_id AND released_at IS NULL AND expires_at > now();

  IF v_active_count = 0 THEN
    -- Delete private credential
    DELETE FROM private.google_calendar_credentials WHERE owner_id = p_owner_id;

    UPDATE public.google_calendar_connections
    SET status = 'disconnected',
        opted_in = false,
        granted_scopes = '{}',
        google_subject_hash = NULL,
        attention_code = NULL,
        connected_at = NULL,
        updated_at = now()
    WHERE owner_id = p_owner_id AND connection_generation = p_fenced_generation;

    RETURN QUERY SELECT 'disconnected'::text, 0::integer;
  ELSE
    RETURN QUERY SELECT 'disconnecting'::text, v_active_count;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_google_calendar_disconnect FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_google_calendar_disconnect TO service_role;

-- 9. Set Opt-In
CREATE OR REPLACE FUNCTION public.set_google_calendar_opt_in_for_service(
  p_owner_id uuid,
  p_enabled boolean
)
RETURNS TABLE (
  status text,
  opted_in boolean,
  granted_scopes text[],
  connection_generation bigint,
  attention_code text,
  connected_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_conn public.google_calendar_connections%ROWTYPE;
BEGIN
  SELECT * INTO v_conn FROM public.google_calendar_connections WHERE owner_id = p_owner_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Connection not found';
  END IF;

  IF p_enabled AND v_conn.status != 'connected' THEN
    RAISE EXCEPTION 'Cannot enable opt-in when connection status is %', v_conn.status;
  END IF;

  UPDATE public.google_calendar_connections
  SET opted_in = p_enabled,
      updated_at = now()
  WHERE owner_id = p_owner_id;

  RETURN QUERY
  SELECT 
    c.status,
    c.opted_in,
    c.granted_scopes,
    c.connection_generation,
    c.attention_code,
    c.connected_at,
    c.updated_at
  FROM public.google_calendar_connections c
  WHERE c.owner_id = p_owner_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_google_calendar_opt_in_for_service FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_google_calendar_opt_in_for_service TO service_role;
