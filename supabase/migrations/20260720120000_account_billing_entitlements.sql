-- Account-scoped billing. A paid user never grants premium access to other members.

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_reference text NOT NULL UNIQUE CHECK (order_reference ~ '^TF[A-Z0-9]{8,32}$'),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_id text NOT NULL CHECK (plan_id IN ('pro_group', 'pro_max')),
  amount_vnd integer NOT NULL CHECK (amount_vnd > 0),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'CANCELLED', 'EXPIRED')),
  provider_transaction_id text UNIQUE,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- A legacy orders table may have been created manually by the old Checkout page.
-- Keep its rows untouched; add a separate secure shape for new orders.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS order_reference text,
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS plan_id text,
  ADD COLUMN IF NOT EXISTS amount_vnd integer,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS provider_transaction_id text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.orders SET id = gen_random_uuid() WHERE id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_id_unique_idx ON public.orders(id);
CREATE UNIQUE INDEX IF NOT EXISTS orders_reference_unique_idx ON public.orders(order_reference) WHERE order_reference IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_provider_transaction_unique_idx ON public.orders(provider_transaction_id) WHERE provider_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_user_created_idx ON public.orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_pending_reference_idx ON public.orders(order_reference) WHERE status = 'PENDING';

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  plan_id text NOT NULL CHECK (plan_id IN ('pro_group', 'pro_max')),
  source_order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  started_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  canceled_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > started_at)
);

CREATE INDEX IF NOT EXISTS user_subscriptions_active_idx ON public.user_subscriptions(expires_at) WHERE canceled_at IS NULL;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orders_select_own ON public.orders;
CREATE POLICY orders_select_own ON public.orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_subscriptions_select_own ON public.user_subscriptions;
CREATE POLICY user_subscriptions_select_own ON public.user_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

UPDATE public.groups g
SET owner_id = COALESCE(
  g.owner_id,
  g.lecturer_id,
  (
    SELECT gm.student_id
    FROM public.group_members gm
    WHERE gm.group_id = g.id AND gm.role = 'Leader'
    ORDER BY gm.student_id
    LIMIT 1
  )
)
WHERE g.owner_id IS NULL;

CREATE INDEX IF NOT EXISTS groups_owner_id_idx ON public.groups(owner_id);

CREATE OR REPLACE FUNCTION public.billing_plan_for_user(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT plan_id
    FROM public.user_subscriptions
    WHERE user_id = p_user_id
      AND canceled_at IS NULL
      AND expires_at > now()
    LIMIT 1
  ), 'free');
$$;

CREATE OR REPLACE FUNCTION public.billing_group_limit_for_user(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE public.billing_plan_for_user(p_user_id)
    WHEN 'pro_max' THEN 2147483647
    ELSE 1
  END;
$$;

CREATE OR REPLACE FUNCTION public.billing_member_limit_for_group(p_group_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE public.billing_plan_for_user(g.owner_id)
    WHEN 'pro_group' THEN 30
    WHEN 'pro_max' THEN 30
    ELSE 6
  END
  FROM public.groups g
  WHERE g.id = p_group_id;
$$;

CREATE OR REPLACE FUNCTION public.billing_task_limit_for_group(p_group_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE public.billing_plan_for_user(g.owner_id)
    WHEN 'pro_group' THEN 2147483647
    WHEN 'pro_max' THEN 2147483647
    ELSE 20
  END
  FROM public.groups g
  WHERE g.id = p_group_id;
$$;

CREATE OR REPLACE FUNCTION public.billing_storage_limit_for_group(p_group_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE public.billing_plan_for_user(g.owner_id)
    WHEN 'pro_group' THEN 5::bigint * 1024 * 1024 * 1024
    WHEN 'pro_max' THEN 20::bigint * 1024 * 1024 * 1024
    ELSE 200::bigint * 1024 * 1024
  END
  FROM public.groups g
  WHERE g.id = p_group_id;
$$;

CREATE OR REPLACE FUNCTION public.enforce_group_owner_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_limit integer;
BEGIN
  v_owner_id := COALESCE(NEW.owner_id, auth.uid());
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'group_owner_required';
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> v_owner_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'group_owner_mismatch';
  END IF;
  v_limit := public.billing_group_limit_for_user(v_owner_id);
  IF (SELECT count(*) FROM public.groups WHERE owner_id = v_owner_id) >= v_limit THEN
    RAISE EXCEPTION 'billing_group_limit_reached';
  END IF;
  NEW.owner_id := v_owner_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_group_member_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
BEGIN
  v_limit := public.billing_member_limit_for_group(NEW.group_id);
  IF v_limit IS NULL THEN
    RAISE EXCEPTION 'billing_group_not_found';
  END IF;
  IF (SELECT count(*) FROM public.group_members WHERE group_id = NEW.group_id) >= v_limit THEN
    RAISE EXCEPTION 'billing_member_limit_reached';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_group_task_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
BEGIN
  v_limit := public.billing_task_limit_for_group(NEW.group_id);
  IF v_limit IS NULL THEN
    RAISE EXCEPTION 'billing_group_not_found';
  END IF;
  IF COALESCE(NEW.priority, 'Medium') <> 'Medium'
    AND public.billing_plan_for_user(auth.uid()) = 'free' THEN
    RAISE EXCEPTION 'billing_feature_requires_pro';
  END IF;
  IF (SELECT count(*) FROM public.tasks WHERE group_id = NEW.group_id) >= v_limit THEN
    RAISE EXCEPTION 'billing_task_limit_reached';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS groups_enforce_billing_quota ON public.groups;
CREATE TRIGGER groups_enforce_billing_quota
  BEFORE INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.enforce_group_owner_quota();

DROP TRIGGER IF EXISTS group_members_enforce_billing_quota ON public.group_members;
CREATE TRIGGER group_members_enforce_billing_quota
  BEFORE INSERT ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_group_member_quota();

DROP TRIGGER IF EXISTS tasks_enforce_billing_quota ON public.tasks;
CREATE TRIGGER tasks_enforce_billing_quota
  BEFORE INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_group_task_quota();

CREATE OR REPLACE FUNCTION public.can_store_group_bytes(p_group_id uuid, p_new_bytes bigint)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_used bigint;
  v_limit bigint;
BEGIN
  IF p_new_bytes < 0 THEN RETURN false; END IF;
  v_limit := public.billing_storage_limit_for_group(p_group_id);
  IF v_limit IS NULL THEN RETURN false; END IF;
  SELECT COALESCE(sum(CASE WHEN (metadata ->> 'size') ~ '^[0-9]+$' THEN (metadata ->> 'size')::bigint ELSE 0 END), 0)
    INTO v_used
  FROM storage.objects
  WHERE bucket_id IN ('materials', 'evidence', 'work-log-attachments')
    AND (storage.foldername(name))[1] = p_group_id::text;
  RETURN v_used + p_new_bytes <= v_limit;
END;
$$;

DROP POLICY IF EXISTS storage_materials_insert ON storage.objects;
CREATE POLICY storage_materials_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'materials'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (public.is_student_member_of_group(((storage.foldername(name))[1])::uuid)
      OR public.is_lecturer_of_group(((storage.foldername(name))[1])::uuid))
    AND public.can_store_group_bytes(
      ((storage.foldername(name))[1])::uuid,
      CASE WHEN (metadata ->> 'size') ~ '^[0-9]+$' THEN (metadata ->> 'size')::bigint ELSE 0 END
    )
  );

DROP POLICY IF EXISTS storage_evidence_insert ON storage.objects;
CREATE POLICY storage_evidence_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'evidence'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (public.is_student_member_of_group(((storage.foldername(name))[1])::uuid)
      OR public.is_lecturer_of_group(((storage.foldername(name))[1])::uuid))
    AND public.can_store_group_bytes(
      ((storage.foldername(name))[1])::uuid,
      CASE WHEN (metadata ->> 'size') ~ '^[0-9]+$' THEN (metadata ->> 'size')::bigint ELSE 0 END
    )
  );

DROP POLICY IF EXISTS work_log_attachments_insert ON storage.objects;
CREATE POLICY work_log_attachments_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'work-log-attachments'
    AND auth.uid() IS NOT NULL
    AND public.current_user_role() = 'student'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND public.is_student_member_of_group((storage.foldername(name))[1]::uuid)
    AND public.can_store_group_bytes(
      (storage.foldername(name))[1]::uuid,
      CASE WHEN (metadata ->> 'size') ~ '^[0-9]+$' THEN (metadata ->> 'size')::bigint ELSE 0 END
    )
  );

CREATE OR REPLACE FUNCTION public.get_my_entitlements()
RETURNS TABLE(plan_id text, expires_at timestamptz, is_active boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(CASE WHEN s.canceled_at IS NULL AND s.expires_at > now() THEN s.plan_id END, 'free') AS plan_id,
    s.expires_at,
    COALESCE(s.canceled_at IS NULL AND s.expires_at > now(), false) AS is_active
  FROM (SELECT auth.uid() AS user_id) auth_context
  LEFT JOIN public.user_subscriptions s ON s.user_id = auth_context.user_id;
$$;

CREATE OR REPLACE FUNCTION public.activate_paid_order(
  p_order_id uuid,
  p_provider_transaction_id text,
  p_paid_at timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_start timestamptz;
BEGIN
  UPDATE public.orders
  SET status = 'PAID', provider_transaction_id = p_provider_transaction_id,
      paid_at = p_paid_at, updated_at = now()
  WHERE id = p_order_id
    AND status = 'PENDING'
    AND provider_transaction_id IS NULL
  RETURNING * INTO v_order;

  IF NOT FOUND THEN RETURN false; END IF;

  SELECT GREATEST(COALESCE(expires_at, p_paid_at), p_paid_at)
    INTO v_start
  FROM public.user_subscriptions
  WHERE user_id = v_order.user_id;
  v_start := COALESCE(v_start, p_paid_at);

  INSERT INTO public.user_subscriptions(user_id, plan_id, source_order_id, started_at, expires_at, updated_at)
  VALUES (v_order.user_id, v_order.plan_id, v_order.id, v_start, v_start + interval '30 days', now())
  ON CONFLICT (user_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    source_order_id = EXCLUDED.source_order_id,
    started_at = EXCLUDED.started_at,
    expires_at = EXCLUDED.expires_at,
    canceled_at = NULL,
    updated_at = now();

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_paid_order(uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_paid_order(uuid, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_my_entitlements() TO authenticated;
GRANT EXECUTE ON FUNCTION public.billing_plan_for_user(uuid) TO authenticated, service_role;
