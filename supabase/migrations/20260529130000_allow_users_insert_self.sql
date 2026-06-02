-- Migration to allow users to insert their own profile in public.users when it is missing
-- Timestamp: 2026-05-29 13:00:00

-- 1. Add insert policy to public.users table
DROP POLICY IF EXISTS users_insert_self ON public.users;
CREATE POLICY users_insert_self ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 2. Redefine set_signup_role to be resilient if the profile row in public.users was manually deleted
CREATE OR REPLACE FUNCTION public.set_signup_role (p_role public.user_role)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_email text;
  v_full_name text;
BEGIN
  IF auth.uid () IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_role = 'admin'::public.user_role THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  -- Check if user row in public.users exists
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid()) THEN
    -- Retrieve metadata from auth.users to construct initial profile row
    SELECT email, coalesce(raw_user_meta_data ->> 'full_name', '')
    INTO v_email, v_full_name
    FROM auth.users
    WHERE id = auth.uid();

    INSERT INTO public.users (id, email, role, full_name, profile_completed)
    VALUES (auth.uid(), coalesce(v_email, ''), p_role, v_full_name, TRUE);
  ELSE
    -- Row exists, perform standard update
    UPDATE
      public.users
    SET
      role = p_role,
      profile_completed = TRUE
    WHERE
      id = auth.uid ()
      AND profile_completed = FALSE;
  END IF;
END;
$$;
