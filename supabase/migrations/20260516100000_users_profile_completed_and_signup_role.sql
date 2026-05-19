-- Signup role from email metadata (app_role) or one-time OAuth fixup via set_signup_role.
-- Passwords stay in auth.users only (Supabase Auth); do not duplicate in public.users.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS profile_completed boolean NOT NULL DEFAULT TRUE;

CREATE OR REPLACE FUNCTION public.handle_new_user ()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_meta_role text;
  v_role public.user_role;
  v_completed boolean;
BEGIN
  v_meta_role := NEW.raw_user_meta_data ->> 'app_role';
  IF v_meta_role IN ('student', 'lecturer') THEN
    v_role := v_meta_role::public.user_role;
    v_completed := TRUE;
  ELSE
    v_role := 'student';
    v_completed := FALSE;
  END IF;
  INSERT INTO public.users (id, email, role, full_name, profile_completed)
    VALUES (NEW.id, coalesce(NEW.email, ''), v_role, coalesce(NEW.raw_user_meta_data ->> 'full_name', ''), v_completed)
  ON CONFLICT (id)
    DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_signup_role (p_role public.user_role)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
BEGIN
  IF auth.uid () IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_role = 'admin'::public.user_role THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  UPDATE
    public.users
  SET
    role = p_role,
    profile_completed = TRUE
  WHERE
    id = auth.uid ()
    AND profile_completed = FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.set_signup_role (public.user_role) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.set_signup_role (public.user_role) TO authenticated;
