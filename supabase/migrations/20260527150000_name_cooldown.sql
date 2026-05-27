-- Migration to add last_name_change_at to public.users and enforce a 30-day rename cooldown
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_name_change_at timestamptz;

CREATE OR REPLACE FUNCTION public.check_name_change_cooldown()
  RETURNS TRIGGER AS $$
BEGIN
  IF OLD.full_name IS DISTINCT FROM NEW.full_name THEN
    IF OLD.last_name_change_at IS NOT NULL AND OLD.last_name_change_at > now() - INTERVAL '30 days' THEN
      RAISE EXCEPTION 'Name can only be changed once every 30 days.';
    END IF;
    NEW.last_name_change_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_users_name_change_cooldown ON public.users;

CREATE TRIGGER tr_users_name_change_cooldown
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.check_name_change_cooldown();
