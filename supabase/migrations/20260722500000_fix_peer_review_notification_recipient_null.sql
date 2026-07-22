-- Fix notify_peer_review_event to ignore NULL recipient_id (e.g. student-created groups without lecturer_id)
CREATE OR REPLACE FUNCTION public.notify_peer_review_event(p_period_id uuid, p_event_key text, p_content text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.peer_review_notification_events(period_id, event_key)
  VALUES (p_period_id, p_event_key) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN; END IF;

  INSERT INTO public.notifications(recipient_id, sender_name, content, is_read, group_id)
  SELECT DISTINCT recipient_id, 'Teamfair', p_content, false, p.group_id
  FROM public.peer_review_periods p
  CROSS JOIN LATERAL (
    SELECT p_group.lecturer_id AS recipient_id FROM public.groups p_group WHERE p_group.id = p.group_id
    UNION
    SELECT gm.student_id FROM public.group_members gm
    WHERE gm.group_id = p.group_id AND COALESCE(gm.role, 'Member') = 'Leader'
  ) recipients
  WHERE p.id = p_period_id AND recipient_id IS NOT NULL;
END;
$$;
