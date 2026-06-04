CREATE TABLE IF NOT EXISTS public.peer_review_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  title text NOT NULL,
  milestone_label text,
  status text NOT NULL DEFAULT 'open',
  start_at timestamptz NOT NULL DEFAULT now(),
  end_at timestamptz NOT NULL,
  allow_leader_summary boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT peer_review_periods_status_chk CHECK (status IN ('open', 'closed', 'reopened'))
);

CREATE INDEX IF NOT EXISTS peer_review_periods_group_id_idx ON public.peer_review_periods(group_id);
CREATE INDEX IF NOT EXISTS peer_review_periods_status_idx ON public.peer_review_periods(status, end_at DESC);

CREATE TABLE IF NOT EXISTS public.peer_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES public.peer_review_periods(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reviewee_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  completion_score int NOT NULL CHECK (completion_score BETWEEN 1 AND 5),
  deadline_score int NOT NULL CHECK (deadline_score BETWEEN 1 AND 5),
  collaboration_score int NOT NULL CHECK (collaboration_score BETWEEN 1 AND 5),
  responsiveness_score int NOT NULL CHECK (responsiveness_score BETWEEN 1 AND 5),
  overall_score int NOT NULL CHECK (overall_score BETWEEN 1 AND 5),
  comment text,
  honesty_confirmed boolean NOT NULL DEFAULT false,
  conflict_flag boolean NOT NULL DEFAULT false,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT peer_reviews_self_review_chk CHECK (reviewer_id <> reviewee_id),
  CONSTRAINT peer_reviews_comment_low_score_chk CHECK (
    (
      LEAST(completion_score, deadline_score, collaboration_score, responsiveness_score, overall_score) > 2
    ) OR (comment IS NOT NULL AND length(btrim(comment)) >= 20)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS peer_reviews_period_reviewer_reviewee_uniq
  ON public.peer_reviews(period_id, reviewer_id, reviewee_id);
CREATE INDEX IF NOT EXISTS peer_reviews_reviewee_idx ON public.peer_reviews(reviewee_id, period_id);
CREATE INDEX IF NOT EXISTS peer_reviews_reviewer_idx ON public.peer_reviews(reviewer_id, period_id);

CREATE TABLE IF NOT EXISTS public.student_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  sender_name text NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('leader', 'lecturer')),
  related_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  related_task_title text,
  feedback_type text NOT NULL CHECK (
    feedback_type IN ('task_review', 'contribution', 'warning', 'general_comment', 'lecturer_note', 'revision_request')
  ),
  content text NOT NULL,
  suggested_action text,
  evidence_link text,
  allows_reply boolean NOT NULL DEFAULT false,
  reply_text text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  replied_at timestamptz
);

CREATE INDEX IF NOT EXISTS student_feedback_recipient_idx ON public.student_feedback(recipient_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS student_feedback_group_idx ON public.student_feedback(group_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.student_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  appeal_type text NOT NULL CHECK (
    appeal_type IN ('risk_flag', 'low_contribution', 'rejected_task', 'missing_contribution', 'other')
  ),
  related_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  related_feedback_id uuid REFERENCES public.student_feedback(id) ON DELETE SET NULL,
  related_period_id uuid REFERENCES public.peer_review_periods(id) ON DELETE SET NULL,
  related_milestone text,
  explanation_content text NOT NULL CHECK (length(btrim(explanation_content)) BETWEEN 50 AND 2000),
  evidence_links jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence_links) = 'array'),
  attachment_files jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(attachment_files) = 'array'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'resolved', 'rejected')),
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS student_appeals_student_idx ON public.student_appeals(student_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS student_appeals_group_idx ON public.student_appeals(group_id, status, updated_at DESC);

CREATE OR REPLACE FUNCTION public.touch_student_appeals_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS student_appeals_touch_updated_at ON public.student_appeals;
CREATE TRIGGER student_appeals_touch_updated_at
BEFORE UPDATE ON public.student_appeals
FOR EACH ROW
EXECUTE FUNCTION public.touch_student_appeals_updated_at();

CREATE OR REPLACE FUNCTION public.get_peer_review_average(p_period_id uuid, p_reviewee_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
  v_average numeric;
BEGIN
  SELECT group_id INTO v_group_id
  FROM public.peer_review_periods
  WHERE id = p_period_id;

  IF v_group_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF auth.uid() <> p_reviewee_id
     AND NOT EXISTS (
       SELECT 1
       FROM public.groups g
       WHERE g.id = v_group_id
         AND g.lecturer_id = auth.uid()
     )
     AND NOT EXISTS (
       SELECT 1
       FROM public.users u
       WHERE u.id = auth.uid()
         AND u.role = 'admin'
     ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT ROUND(AVG(overall_score)::numeric, 1)
  INTO v_average
  FROM public.peer_reviews
  WHERE period_id = p_period_id
    AND reviewee_id = p_reviewee_id;

  RETURN v_average;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_peer_review_average(uuid, uuid) TO authenticated;

ALTER TABLE public.peer_review_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peer_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_appeals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS peer_review_periods_select ON public.peer_review_periods;
CREATE POLICY peer_review_periods_select ON public.peer_review_periods
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = peer_review_periods.group_id
      AND gm.student_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = peer_review_periods.group_id
      AND g.lecturer_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin'
  )
);

DROP POLICY IF EXISTS peer_review_periods_manage ON public.peer_review_periods;
CREATE POLICY peer_review_periods_manage ON public.peer_review_periods
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = peer_review_periods.group_id
      AND g.lecturer_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = peer_review_periods.group_id
      AND g.lecturer_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin'
  )
);

DROP POLICY IF EXISTS peer_reviews_select ON public.peer_reviews;
CREATE POLICY peer_reviews_select ON public.peer_reviews
FOR SELECT
USING (
  reviewer_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = peer_reviews.group_id
      AND g.lecturer_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin'
  )
);

DROP POLICY IF EXISTS peer_reviews_insert ON public.peer_reviews;
CREATE POLICY peer_reviews_insert ON public.peer_reviews
FOR INSERT
WITH CHECK (
  reviewer_id = auth.uid()
  AND reviewer_id <> reviewee_id
  AND honesty_confirmed = true
  AND EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = peer_reviews.group_id
      AND gm.student_id = reviewer_id
  )
  AND EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = peer_reviews.group_id
      AND gm.student_id = reviewee_id
  )
  AND EXISTS (
    SELECT 1
    FROM public.peer_review_periods prp
    WHERE prp.id = peer_reviews.period_id
      AND prp.group_id = peer_reviews.group_id
      AND prp.status IN ('open', 'reopened')
      AND prp.end_at >= now()
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.peer_reviews existing_reviews
    WHERE existing_reviews.period_id = peer_reviews.period_id
      AND existing_reviews.reviewer_id = reviewer_id
  )
);

DROP POLICY IF EXISTS peer_reviews_manage ON public.peer_reviews;
CREATE POLICY peer_reviews_manage ON public.peer_reviews
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = peer_reviews.group_id
      AND g.lecturer_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = peer_reviews.group_id
      AND g.lecturer_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin'
  )
);

DROP POLICY IF EXISTS student_feedback_select ON public.student_feedback;
CREATE POLICY student_feedback_select ON public.student_feedback
FOR SELECT
USING (
  recipient_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = student_feedback.group_id
      AND g.lecturer_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = student_feedback.group_id
      AND gm.student_id = auth.uid()
      AND gm.role = 'Leader'
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin'
  )
);

DROP POLICY IF EXISTS student_feedback_insert ON public.student_feedback;
CREATE POLICY student_feedback_insert ON public.student_feedback
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = student_feedback.group_id
      AND g.lecturer_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = student_feedback.group_id
      AND gm.student_id = auth.uid()
      AND gm.role = 'Leader'
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin'
  )
);

DROP POLICY IF EXISTS student_feedback_update ON public.student_feedback;
CREATE POLICY student_feedback_update ON public.student_feedback
FOR UPDATE
USING (
  recipient_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = student_feedback.group_id
      AND g.lecturer_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = student_feedback.group_id
      AND gm.student_id = auth.uid()
      AND gm.role = 'Leader'
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin'
  )
)
WITH CHECK (
  recipient_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = student_feedback.group_id
      AND g.lecturer_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = student_feedback.group_id
      AND gm.student_id = auth.uid()
      AND gm.role = 'Leader'
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin'
  )
);

DROP POLICY IF EXISTS student_appeals_select ON public.student_appeals;
CREATE POLICY student_appeals_select ON public.student_appeals
FOR SELECT
USING (
  student_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = student_appeals.group_id
      AND g.lecturer_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = student_appeals.group_id
      AND gm.student_id = auth.uid()
      AND gm.role = 'Leader'
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin'
  )
);

DROP POLICY IF EXISTS student_appeals_insert ON public.student_appeals;
CREATE POLICY student_appeals_insert ON public.student_appeals
FOR INSERT
WITH CHECK (
  student_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = student_appeals.group_id
      AND gm.student_id = auth.uid()
  )
);

DROP POLICY IF EXISTS student_appeals_update_student ON public.student_appeals;
CREATE POLICY student_appeals_update_student ON public.student_appeals
FOR UPDATE
USING (
  student_id = auth.uid()
  AND status = 'draft'
)
WITH CHECK (
  student_id = auth.uid()
);

DROP POLICY IF EXISTS student_appeals_update_staff ON public.student_appeals;
CREATE POLICY student_appeals_update_staff ON public.student_appeals
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = student_appeals.group_id
      AND g.lecturer_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = student_appeals.group_id
      AND gm.student_id = auth.uid()
      AND gm.role = 'Leader'
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin'
  )
)
WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.peer_review_periods TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.peer_reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.student_feedback TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.student_appeals TO authenticated;
