-- Task-scoped peer review. All student submissions go through the bundle RPC so
-- a reviewer can never persist an incomplete or partially duplicated review set.

CREATE TABLE IF NOT EXISTS public.peer_review_period_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.peer_review_periods(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  reviewee_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  task_title text NOT NULL,
  task_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT peer_review_period_tasks_snapshot_object CHECK (jsonb_typeof(task_snapshot) = 'object'),
  CONSTRAINT peer_review_period_tasks_period_task_uniq UNIQUE (period_id, task_id)
);

CREATE INDEX IF NOT EXISTS peer_review_period_tasks_period_idx
  ON public.peer_review_period_tasks(period_id, reviewee_id);

ALTER TABLE public.peer_reviews
  ADD COLUMN IF NOT EXISTS period_task_id uuid REFERENCES public.peer_review_period_tasks(id) ON DELETE RESTRICT;

ALTER TABLE public.peer_reviews
  DROP CONSTRAINT IF EXISTS peer_reviews_period_task_required;
ALTER TABLE public.peer_reviews
  ADD CONSTRAINT peer_reviews_period_task_required CHECK (period_task_id IS NOT NULL) NOT VALID;

DROP INDEX IF EXISTS public.peer_reviews_period_reviewer_reviewee_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS peer_reviews_period_reviewer_task_uniq
  ON public.peer_reviews(period_id, reviewer_id, period_task_id)
  WHERE period_task_id IS NOT NULL;

ALTER TABLE public.peer_review_period_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_review_period_tasks FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS peer_review_period_tasks_select ON public.peer_review_period_tasks;
CREATE POLICY peer_review_period_tasks_select ON public.peer_review_period_tasks
  FOR SELECT USING (
    public.is_admin()
    OR public.is_lecturer_of_group(group_id)
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = peer_review_period_tasks.group_id
        AND gm.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS peer_review_period_tasks_write ON public.peer_review_period_tasks;
CREATE POLICY peer_review_period_tasks_write ON public.peer_review_period_tasks
  FOR ALL USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.can_manage_peer_review_period(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
    OR public.is_lecturer_of_group(p_group_id)
    OR public.is_student_leader_of_group(p_group_id);
$$;

CREATE OR REPLACE FUNCTION public.guard_peer_review_period_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_peer_review_period(NEW.group_id) THEN
    RAISE EXCEPTION 'Only the owning lecturer or group leader can manage peer review periods';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by <> auth.uid() OR NEW.status <> 'open' THEN
      RAISE EXCEPTION 'Peer review periods must be opened by their manager';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.group_id <> OLD.group_id OR NEW.created_by <> OLD.created_by THEN
    RAISE EXCEPTION 'Peer review ownership cannot be changed';
  END IF;

  IF NEW.status = OLD.status THEN
    RAISE EXCEPTION 'Peer review status must change through close or reopen';
  END IF;

  IF NOT (
    (OLD.status IN ('open', 'reopened') AND NEW.status = 'closed')
    OR (OLD.status = 'closed' AND NEW.status = 'reopened' AND NEW.end_at > now())
  ) THEN
    RAISE EXCEPTION 'Invalid peer review status transition';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS peer_review_period_transition_guard ON public.peer_review_periods;
CREATE TRIGGER peer_review_period_transition_guard
  BEFORE INSERT OR UPDATE ON public.peer_review_periods
  FOR EACH ROW EXECUTE FUNCTION public.guard_peer_review_period_transition();

DROP POLICY IF EXISTS peer_review_periods_manage ON public.peer_review_periods;
CREATE POLICY peer_review_periods_manage ON public.peer_review_periods
  FOR UPDATE
  USING (public.can_manage_peer_review_period(group_id))
  WITH CHECK (public.can_manage_peer_review_period(group_id));

CREATE OR REPLACE FUNCTION public.create_peer_review_period(
  p_group_id uuid,
  p_title text,
  p_milestone_label text,
  p_end_at timestamptz,
  p_task_ids uuid[]
)
RETURNS public.peer_review_periods
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period public.peer_review_periods;
  v_task_count integer;
BEGIN
  IF NOT public.can_manage_peer_review_period(p_group_id) THEN
    RAISE EXCEPTION 'Only the owning lecturer or group leader can open peer review periods';
  END IF;
  IF length(btrim(COALESCE(p_title, ''))) = 0 OR p_end_at <= now() THEN
    RAISE EXCEPTION 'A title and future end time are required';
  END IF;
  IF COALESCE(cardinality(p_task_ids), 0) = 0 THEN
    RAISE EXCEPTION 'Select at least one group task';
  END IF;
  IF cardinality(p_task_ids) <> cardinality(ARRAY(SELECT DISTINCT unnest(p_task_ids))) THEN
    RAISE EXCEPTION 'Task selection contains duplicates';
  END IF;

  SELECT count(*) INTO v_task_count
  FROM public.tasks t
  JOIN public.group_members gm ON gm.group_id = t.group_id AND gm.student_id = t.assignee_id
  WHERE t.group_id = p_group_id AND t.id = ANY(p_task_ids);
  IF v_task_count <> cardinality(p_task_ids) THEN
    RAISE EXCEPTION 'Every selected task must belong to the group and have a current group-member assignee';
  END IF;

  INSERT INTO public.peer_review_periods (
    group_id, title, milestone_label, status, start_at, end_at, allow_leader_summary, created_by
  ) VALUES (
    p_group_id, btrim(p_title), NULLIF(btrim(COALESCE(p_milestone_label, '')), ''),
    'open', now(), p_end_at, true, auth.uid()
  ) RETURNING * INTO v_period;

  INSERT INTO public.peer_review_period_tasks (
    period_id, group_id, task_id, reviewee_id, task_title, task_snapshot
  )
  SELECT v_period.id, t.group_id, t.id, t.assignee_id, t.title,
    jsonb_build_object(
      'title', t.title,
      'description', t.description,
      'assignee_id', t.assignee_id,
      'status', t.status,
      'weight', t.weight,
      'proof_url', t.proof_url
    )
  FROM public.tasks t
  WHERE t.id = ANY(p_task_ids) AND t.group_id = p_group_id;

  RETURN v_period;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_peer_review_bundle(
  p_period_id uuid,
  p_reviews jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period public.peer_review_periods;
  v_expected_count integer;
  v_received_count integer;
  v_inserted_count integer;
BEGIN
  SELECT * INTO v_period FROM public.peer_review_periods WHERE id = p_period_id;
  IF NOT FOUND OR v_period.status NOT IN ('open', 'reopened') OR v_period.end_at < now() THEN
    RAISE EXCEPTION 'Peer review period is not open';
  END IF;
  IF public.current_user_role() <> 'student'::public.user_role
     OR NOT EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = v_period.group_id AND gm.student_id = auth.uid()) THEN
    RAISE EXCEPTION 'Only current group members can submit peer review bundles';
  END IF;
  IF jsonb_typeof(p_reviews) <> 'array' THEN
    RAISE EXCEPTION 'Peer review bundle must be an array';
  END IF;
  IF EXISTS (SELECT 1 FROM public.peer_reviews r WHERE r.period_id = p_period_id AND r.reviewer_id = auth.uid()) THEN
    RAISE EXCEPTION 'Peer review bundle already submitted';
  END IF;

  SELECT count(*) INTO v_expected_count
  FROM public.peer_review_period_tasks pt
  WHERE pt.period_id = p_period_id AND pt.reviewee_id <> auth.uid();
  SELECT count(*) INTO v_received_count FROM jsonb_array_elements(p_reviews);
  IF v_expected_count = 0 OR v_received_count <> v_expected_count THEN
    RAISE EXCEPTION 'A complete review for every selected task is required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_reviews) AS x(
      period_task_id uuid, completion_score integer, deadline_score integer,
      collaboration_score integer, responsiveness_score integer, overall_score integer,
      comment text, honesty_confirmed boolean
    )
    LEFT JOIN public.peer_review_period_tasks pt ON pt.id = x.period_task_id
    WHERE pt.id IS NULL OR pt.period_id <> p_period_id OR pt.reviewee_id = auth.uid()
      OR x.honesty_confirmed IS DISTINCT FROM true
      OR x.completion_score NOT BETWEEN 1 AND 5
      OR x.deadline_score NOT BETWEEN 1 AND 5
      OR x.collaboration_score NOT BETWEEN 1 AND 5
      OR x.responsiveness_score NOT BETWEEN 1 AND 5
      OR x.overall_score NOT BETWEEN 1 AND 5
      OR (LEAST(x.completion_score, x.deadline_score, x.collaboration_score, x.responsiveness_score, x.overall_score) <= 2
          AND length(btrim(COALESCE(x.comment, ''))) < 20)
  ) OR (
    SELECT count(DISTINCT (value->>'period_task_id')::uuid) FROM jsonb_array_elements(p_reviews)
  ) <> v_received_count THEN
    RAISE EXCEPTION 'Peer review bundle contains invalid, duplicate, self-review, or incomplete task entries';
  END IF;

  INSERT INTO public.peer_reviews (
    group_id, period_id, period_task_id, reviewer_id, reviewee_id,
    completion_score, deadline_score, collaboration_score, responsiveness_score, overall_score,
    comment, honesty_confirmed, conflict_flag
  )
  SELECT v_period.group_id, p_period_id, x.period_task_id, auth.uid(), pt.reviewee_id,
    x.completion_score, x.deadline_score, x.collaboration_score, x.responsiveness_score, x.overall_score,
    NULLIF(btrim(x.comment), ''), true, false
  FROM jsonb_to_recordset(p_reviews) AS x(
    period_task_id uuid, completion_score integer, deadline_score integer,
    collaboration_score integer, responsiveness_score integer, overall_score integer,
    comment text, honesty_confirmed boolean
  )
  JOIN public.peer_review_period_tasks pt ON pt.id = x.period_task_id;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  IF v_inserted_count <> v_expected_count THEN
    RAISE EXCEPTION 'Peer review bundle did not persist every expected task review';
  END IF;
END;
$$;

DROP POLICY IF EXISTS peer_reviews_insert ON public.peer_reviews;
CREATE POLICY peer_reviews_insert ON public.peer_reviews FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS peer_reviews_manage ON public.peer_reviews;
CREATE POLICY peer_reviews_manage ON public.peer_reviews FOR UPDATE
  USING (public.is_admin() OR public.is_lecturer_of_group(group_id))
  WITH CHECK (public.is_admin() OR public.is_lecturer_of_group(group_id));

CREATE TABLE IF NOT EXISTS public.peer_review_notification_events (
  period_id uuid NOT NULL REFERENCES public.peer_review_periods(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (period_id, event_key)
);
ALTER TABLE public.peer_review_notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_review_notification_events FORCE ROW LEVEL SECURITY;

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
  WHERE p.id = p_period_id;
END;
$$;

-- This is a trigger-only helper. SECURITY DEFINER does not make it a client API.
REVOKE EXECUTE ON FUNCTION public.notify_peer_review_event(uuid, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_peer_review_period_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_event text;
BEGIN
  IF TG_OP = 'INSERT' THEN v_event := 'opened';
  ELSIF NEW.status = 'closed' THEN v_event := 'closed';
  ELSE v_event := 'reopened'; END IF;
  PERFORM public.notify_peer_review_event(
    NEW.id,
    v_event || ':' || txid_current()::text,
    format('Peer review "%s" was %s.', NEW.title, v_event)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS peer_review_period_notification ON public.peer_review_periods;
CREATE TRIGGER peer_review_period_notification
  AFTER INSERT OR UPDATE OF status ON public.peer_review_periods
  FOR EACH ROW EXECUTE FUNCTION public.notify_peer_review_period_change();

CREATE OR REPLACE FUNCTION public.notify_peer_review_bundle_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_period_id uuid;
DECLARE v_reviewer_id uuid;
BEGIN
  FOR v_period_id, v_reviewer_id IN
    SELECT DISTINCT period_id, reviewer_id FROM new_rows
  LOOP
    PERFORM public.notify_peer_review_event(v_period_id, 'submitted:' || v_reviewer_id::text, 'A member submitted a peer review bundle.');
    IF NOT EXISTS (
      SELECT 1 FROM public.group_members gm
      JOIN public.peer_review_periods p ON p.id = v_period_id AND p.group_id = gm.group_id
      WHERE EXISTS (SELECT 1 FROM public.peer_review_period_tasks pt WHERE pt.period_id = v_period_id AND pt.reviewee_id <> gm.student_id)
        AND (SELECT count(*) FROM public.peer_reviews r WHERE r.period_id = v_period_id AND r.reviewer_id = gm.student_id)
            <> (SELECT count(*) FROM public.peer_review_period_tasks pt WHERE pt.period_id = v_period_id AND pt.reviewee_id <> gm.student_id)
    ) THEN
      PERFORM public.notify_peer_review_event(v_period_id, 'all-submitted', 'All required peer review bundles have been submitted.');
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS peer_review_bundle_notification ON public.peer_reviews;
CREATE TRIGGER peer_review_bundle_notification
  AFTER INSERT ON public.peer_reviews
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.notify_peer_review_bundle_submission();

CREATE OR REPLACE FUNCTION public.get_peer_review_leader_summary(p_period_id uuid)
RETURNS TABLE(reviewee_id uuid, selected_task_count bigint, review_count bigint, average_score numeric, submitted_bundle_count bigint, required_bundle_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_group_id uuid;
BEGIN
  SELECT group_id INTO v_group_id FROM public.peer_review_periods WHERE id = p_period_id;
  IF v_group_id IS NULL OR NOT (public.is_student_leader_of_group(v_group_id) OR public.is_lecturer_of_group(v_group_id) OR public.is_admin()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY
  WITH eligible AS (
    SELECT gm.student_id FROM public.group_members gm
    WHERE gm.group_id = v_group_id
      AND EXISTS (SELECT 1 FROM public.peer_review_period_tasks pt WHERE pt.period_id = p_period_id AND pt.reviewee_id <> gm.student_id)
  ), bundles AS (
    SELECT r.reviewer_id FROM public.peer_reviews r
    WHERE r.period_id = p_period_id GROUP BY r.reviewer_id
  )
  SELECT pt.reviewee_id, count(*)::bigint, count(r.id)::bigint, round(avg(r.overall_score)::numeric, 1),
    (SELECT count(*) FROM bundles), (SELECT count(*) FROM eligible)
  FROM public.peer_review_period_tasks pt
  LEFT JOIN public.peer_reviews r ON r.period_task_id = pt.id
  WHERE pt.period_id = p_period_id
  GROUP BY pt.reviewee_id;
END;
$$;

GRANT SELECT, UPDATE ON public.peer_review_periods TO authenticated;
GRANT SELECT ON public.peer_review_period_tasks TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_peer_review_period(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_peer_review_period(uuid, text, text, timestamptz, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_peer_review_bundle(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_peer_review_leader_summary(uuid) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
