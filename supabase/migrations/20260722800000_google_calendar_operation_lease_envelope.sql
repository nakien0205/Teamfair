-- Phase 2 credential-custody repair: atomically return a private encrypted envelope
-- only to service_role after the operation lease has been granted.

DROP FUNCTION IF EXISTS public.acquire_google_calendar_operation_lease(uuid, bigint, uuid, text, integer);

CREATE FUNCTION public.acquire_google_calendar_operation_lease(
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
  expires_at timestamptz,
  encrypted_refresh_token text,
  credential_nonce text,
  credential_key_version integer,
  credential_generation bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_connection public.google_calendar_connections%ROWTYPE;
  v_credential private.google_calendar_credentials%ROWTYPE;
  v_ttl integer;
  v_expires timestamptz;
BEGIN
  SELECT * INTO v_connection
  FROM public.google_calendar_connections
  WHERE owner_id = p_owner_id
  FOR UPDATE;

  IF NOT FOUND OR v_connection.status <> 'connected' THEN
    RETURN QUERY SELECT false, 'not_connected'::text, 0::bigint, NULL::timestamptz,
      NULL::text, NULL::text, NULL::integer, NULL::bigint;
    RETURN;
  END IF;

  IF NOT v_connection.opted_in THEN
    RETURN QUERY SELECT false, 'not_opted_in'::text, v_connection.connection_generation, NULL::timestamptz,
      NULL::text, NULL::text, NULL::integer, NULL::bigint;
    RETURN;
  END IF;

  IF v_connection.connection_generation <> p_expected_generation THEN
    RETURN QUERY SELECT false, 'generation_mismatch'::text, v_connection.connection_generation, NULL::timestamptz,
      NULL::text, NULL::text, NULL::integer, NULL::bigint;
    RETURN;
  END IF;

  IF NOT public.user_has_pro_group_features(p_owner_id) THEN
    RETURN QUERY SELECT false, 'entitlement_required'::text, v_connection.connection_generation, NULL::timestamptz,
      NULL::text, NULL::text, NULL::integer, NULL::bigint;
    RETURN;
  END IF;

  SELECT * INTO v_credential
  FROM private.google_calendar_credentials
  WHERE owner_id = p_owner_id
    AND credential_generation = v_connection.connection_generation;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'credential_unreadable'::text, v_connection.connection_generation, NULL::timestamptz,
      NULL::text, NULL::text, NULL::integer, NULL::bigint;
    RETURN;
  END IF;

  v_ttl := LEAST(GREATEST(p_requested_ttl_seconds, 20), 30);
  v_expires := now() + make_interval(secs => v_ttl);

  INSERT INTO private.google_calendar_operation_leases (
    owner_id, operation_id, connection_generation, purpose, acquired_at, expires_at
  ) VALUES (
    p_owner_id, p_operation_id, p_expected_generation, p_purpose, now(), v_expires
  );

  RETURN QUERY SELECT true, NULL::text, v_connection.connection_generation, v_expires,
    v_credential.encrypted_refresh_token, v_credential.nonce, v_credential.key_version,
    v_credential.credential_generation;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_google_calendar_operation_lease(uuid, bigint, uuid, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_google_calendar_operation_lease(uuid, bigint, uuid, text, integer)
  TO service_role;
