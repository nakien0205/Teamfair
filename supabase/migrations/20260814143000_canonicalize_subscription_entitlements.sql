-- Normalize commercial product SKUs at the entitlement read boundary.
-- This migration changes functions and grants only. It never mutates subscription,
-- order, checkout, activation, pricing, webhook, or payment data.

BEGIN;

CREATE OR REPLACE FUNCTION public.canonical_billing_tier(p_plan_id text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_plan_id IN (
      'pro_group',
      'student_1m',
      'student_3m',
      'student_6m',
      'student_12m',
      'student_30d',
      'student_90d',
      'student_180d',
      'student_360d'
    ) THEN 'pro_group'
    WHEN p_plan_id IN (
      'pro_max',
      'lecturer_1m',
      'lecturer_3m',
      'lecturer_6m',
      'lecturer_12m',
      'lecturer_30d',
      'lecturer_90d',
      'lecturer_180d',
      'lecturer_360d'
    ) THEN 'pro_max'
    ELSE 'free'
  END;
$$;

COMMENT ON FUNCTION public.canonical_billing_tier(text) IS
  'Maps approved subscription product SKUs to free, pro_group, or pro_max. Unknown values fail closed.';

CREATE OR REPLACE FUNCTION public.billing_plan_for_user(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.canonical_billing_tier((
    SELECT s.plan_id
    FROM public.user_subscriptions s
    WHERE s.user_id = p_user_id
      AND s.canceled_at IS NULL
      AND s.expires_at > now()
    LIMIT 1
  ));
$$;

CREATE OR REPLACE FUNCTION public.get_my_entitlements()
RETURNS TABLE(plan_id text, expires_at timestamptz, is_active boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    public.canonical_billing_tier(
      CASE
        WHEN s.canceled_at IS NULL AND s.expires_at > now() THEN s.plan_id
      END
    ) AS plan_id,
    s.expires_at,
    COALESCE(s.canceled_at IS NULL AND s.expires_at > now(), false) AS is_active
  FROM (SELECT auth.uid() AS user_id) auth_context
  LEFT JOIN public.user_subscriptions s ON s.user_id = auth_context.user_id;
$$;

REVOKE ALL ON FUNCTION public.canonical_billing_tier(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.canonical_billing_tier(text) TO service_role;

REVOKE ALL ON FUNCTION public.billing_plan_for_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_plan_for_user(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.user_has_pro_group_features(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_pro_group_features(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.group_leader_has_pro_features(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.group_leader_has_pro_features(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.get_my_entitlements() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_entitlements() TO authenticated, service_role;

COMMIT;
