-- Leader-pays-all: Google Calendar is available to any user who belongs to
-- at least one group whose owner (leader) has an active pro_group or pro_max
-- subscription.  This follows the same billing_plan_for_user() pattern used
-- by the existing billing_*_limit_for_group() family of functions.

CREATE OR REPLACE FUNCTION public.user_has_pro_group_features(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Check groups the user owns
    SELECT 1
    FROM public.groups g
    WHERE g.owner_id = p_user_id
      AND public.billing_plan_for_user(g.owner_id) IN ('pro_group', 'pro_max')

    UNION ALL

    -- Check groups the user is a member of (but doesn't own)
    SELECT 1
    FROM public.group_members gm
    JOIN public.groups g ON g.id = gm.group_id
    WHERE gm.student_id = p_user_id
      AND public.billing_plan_for_user(g.owner_id) IN ('pro_group', 'pro_max')
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_has_pro_group_features(uuid) TO authenticated, service_role;
