BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT * FROM no_plan();

SELECT is(
  (
    SELECT count(*)
    FROM (
      VALUES
        ('pro_group', 'pro_group'),
        ('student_1m', 'pro_group'),
        ('student_3m', 'pro_group'),
        ('student_6m', 'pro_group'),
        ('student_12m', 'pro_group'),
        ('student_30d', 'pro_group'),
        ('student_90d', 'pro_group'),
        ('student_180d', 'pro_group'),
        ('student_360d', 'pro_group'),
        ('pro_max', 'pro_max'),
        ('lecturer_1m', 'pro_max'),
        ('lecturer_3m', 'pro_max'),
        ('lecturer_6m', 'pro_max'),
        ('lecturer_12m', 'pro_max'),
        ('lecturer_30d', 'pro_max'),
        ('lecturer_90d', 'pro_max'),
        ('lecturer_180d', 'pro_max'),
        ('lecturer_360d', 'pro_max')
    ) AS expected(plan_id, tier)
    WHERE public.canonical_billing_tier(plan_id) IS DISTINCT FROM tier
  ),
  0::bigint,
  'every approved product SKU maps to its canonical entitlement tier'
);

SELECT is(
  (
    SELECT count(*)
    FROM (
      VALUES
        (NULL::text),
        (''),
        ('student_enterprise'),
        ('student_1m_extra'),
        ('lecturer_1m '),
        ('LECTURER_1M')
    ) AS unknown(plan_id)
    WHERE public.canonical_billing_tier(plan_id) IS DISTINCT FROM 'free'
  ),
  0::bigint,
  'unknown and malformed plan identifiers fail closed'
);

SELECT ok(
  (
    SELECT p.provolatile = 'i' AND NOT p.prosecdef
    FROM pg_catalog.pg_proc p
    WHERE p.oid = 'public.canonical_billing_tier(text)'::regprocedure
  ),
  'canonical tier helper is immutable and security invoker'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.canonical_billing_tier(text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.canonical_billing_tier(text)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.canonical_billing_tier(text)', 'EXECUTE'),
  'canonical tier helper is restricted to trusted callers'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.billing_plan_for_user(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.billing_plan_for_user(uuid)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.billing_plan_for_user(uuid)', 'EXECUTE'),
  'arbitrary-user plan lookup is restricted to trusted callers'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.user_has_pro_group_features(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.user_has_pro_group_features(uuid)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.user_has_pro_group_features(uuid)', 'EXECUTE'),
  'arbitrary-user feature lookup is restricted to trusted callers'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.group_leader_has_pro_features(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.group_leader_has_pro_features(uuid)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.group_leader_has_pro_features(uuid)', 'EXECUTE'),
  'arbitrary-group feature lookup is restricted to trusted callers'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.get_my_entitlements()', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.get_my_entitlements()', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.get_my_entitlements()', 'EXECUTE'),
  'self entitlement lookup stays authenticated and service-role only'
);

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'entitlement-group@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"app_role":"student","full_name":"Entitlement Group"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'entitlement-max@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"app_role":"lecturer","full_name":"Entitlement Max"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'entitlement-canceled@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"app_role":"student","full_name":"Entitlement Canceled"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'entitlement-free@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"app_role":"student","full_name":"Entitlement Free"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'entitlement-expired@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{"app_role":"student","full_name":"Entitlement Expired"}', now(), now());

UPDATE public.users
SET role = 'lecturer'::public.user_role
WHERE id = '10000000-0000-4000-8000-000000000002';

INSERT INTO public.orders (
  id, order_reference, user_id, plan_id, amount_vnd, status, created_at, updated_at
)
VALUES
  ('20000000-0000-4000-8000-000000000001', 'TFENTGROUP01', '10000000-0000-4000-8000-000000000001', 'pro_group', 79000, 'PAID', now(), now()),
  ('20000000-0000-4000-8000-000000000002', 'TFENTMAX0001', '10000000-0000-4000-8000-000000000002', 'pro_max', 129000, 'PAID', now(), now()),
  ('20000000-0000-4000-8000-000000000003', 'TFENTCANCEL1', '10000000-0000-4000-8000-000000000003', 'pro_max', 129000, 'PAID', now(), now()),
  ('20000000-0000-4000-8000-000000000004', 'TFENTEXPIRE1', '10000000-0000-4000-8000-000000000005', 'pro_group', 79000, 'PAID', now(), now());

INSERT INTO public.user_subscriptions (
  user_id, plan_id, source_order_id, started_at, expires_at, canceled_at, updated_at
)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'pro_group', '20000000-0000-4000-8000-000000000001', now() - interval '1 day', now() + interval '29 days', NULL, now()),
  ('10000000-0000-4000-8000-000000000002', 'pro_max', '20000000-0000-4000-8000-000000000002', now() - interval '1 day', now() + interval '29 days', NULL, now()),
  ('10000000-0000-4000-8000-000000000003', 'pro_max', '20000000-0000-4000-8000-000000000003', now() - interval '1 day', now() + interval '29 days', now(), now()),
  ('10000000-0000-4000-8000-000000000005', 'pro_group', '20000000-0000-4000-8000-000000000004', now() - interval '1 day', now(), NULL, now());

INSERT INTO public.groups (id, project_name, lecturer_id, owner_id)
VALUES
  ('30000000-0000-4000-8000-000000000001', 'Entitlement Pro Group', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000002', 'Entitlement Pro Max', '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002');

SET LOCAL ROLE service_role;
SELECT is(
  public.billing_plan_for_user('10000000-0000-4000-8000-000000000001'),
  'pro_group'::text,
  'service role receives canonical Pro Group'
);
SELECT is(
  public.billing_plan_for_user('10000000-0000-4000-8000-000000000002'),
  'pro_max'::text,
  'service role receives canonical Pro Max'
);
SELECT is(
  public.billing_plan_for_user('10000000-0000-4000-8000-000000000003'),
  'free'::text,
  'canceled subscription resolves to Free'
);
SELECT is(
  public.billing_plan_for_user('10000000-0000-4000-8000-000000000004'),
  'free'::text,
  'missing subscription resolves to Free'
);
SELECT is(
  public.billing_plan_for_user('10000000-0000-4000-8000-000000000005'),
  'free'::text,
  'subscription expiring exactly now resolves to Free'
);
SELECT is(
  public.billing_group_limit_for_user('10000000-0000-4000-8000-000000000002'),
  2147483647,
  'dependent Pro Max quota receives canonical tier'
);
SELECT is(
  public.user_has_pro_group_features('10000000-0000-4000-8000-000000000001'),
  TRUE,
  'service-role feature helper remains functional'
);
SELECT is(
  public.group_leader_has_pro_features('30000000-0000-4000-8000-000000000001'),
  TRUE,
  'internal group-leader feature helper remains functional'
);
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000001"}', true);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT jsonb_build_array(plan_id, is_active) FROM public.get_my_entitlements()),
  '["pro_group", true]'::jsonb,
  'authenticated user receives active self entitlement'
);
SELECT throws_ok(
  $$SELECT public.billing_plan_for_user('10000000-0000-4000-8000-000000000002')$$,
  '42501',
  NULL,
  'authenticated user cannot probe another account plan'
);
SELECT throws_ok(
  $$SELECT public.user_has_pro_group_features('10000000-0000-4000-8000-000000000002')$$,
  '42501',
  NULL,
  'authenticated user cannot probe another account feature status'
);
SELECT throws_ok(
  $$SELECT public.group_leader_has_pro_features('30000000-0000-4000-8000-000000000002')$$,
  '42501',
  NULL,
  'authenticated user cannot probe another group leader status'
);
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000003"}', true);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT jsonb_build_array(plan_id, is_active) FROM public.get_my_entitlements()),
  '["free", false]'::jsonb,
  'canceled self entitlement returns Free and inactive'
);
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000004"}', true);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT jsonb_build_array(plan_id, expires_at, is_active) FROM public.get_my_entitlements()),
  '["free", null, false]'::jsonb,
  'missing self subscription returns stable Free shape'
);
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000005"}', true);
SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT jsonb_build_array(plan_id, is_active) FROM public.get_my_entitlements()),
  '["free", false]'::jsonb,
  'self subscription expiring exactly now returns Free and inactive'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
