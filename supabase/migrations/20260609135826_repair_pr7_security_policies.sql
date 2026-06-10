-- Repair PR 7 security policy regressions.
-- Scope: student appeal storage, task submissions, peer reviews, student feedback,
-- student appeal staff updates, and missing rubric grade policies.

UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg',
    'application/zip',
    'application/x-zip-compressed'
  ]
WHERE id = 'student-appeals';

DROP POLICY IF EXISTS "student_appeals_read" ON storage.objects;
DROP POLICY IF EXISTS "student_appeals_upload" ON storage.objects;
DROP POLICY IF EXISTS "student_appeals_delete" ON storage.objects;

CREATE POLICY "student_appeals_read"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'student-appeals'
  AND auth.uid() IS NOT NULL
  AND (
    public.is_admin()
    OR (storage.foldername(name))[2] = auth.uid()::text
    OR public.is_lecturer_of_group((storage.foldername(name))[1]::uuid)
    OR public.is_student_leader_of_group((storage.foldername(name))[1]::uuid)
  )
);

CREATE POLICY "student_appeals_upload"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'student-appeals'
  AND auth.uid() IS NOT NULL
  AND public.current_user_role() = 'student'::public.user_role
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = (storage.foldername(name))[1]::uuid
      AND gm.student_id = auth.uid()
  )
);

CREATE POLICY "student_appeals_delete"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'student-appeals'
  AND auth.uid() IS NOT NULL
  AND (
    public.is_admin()
    OR (storage.foldername(name))[2] = auth.uid()::text
  )
);

DROP POLICY IF EXISTS task_submissions_insert_student ON public.task_submissions;
DROP POLICY IF EXISTS task_submissions_update_student ON public.task_submissions;

CREATE POLICY task_submissions_insert_student ON public.task_submissions
  FOR INSERT
  WITH CHECK (
    public.current_user_role() = 'student'::public.user_role
    AND student_id = auth.uid()
    AND submission_status = 'pending_review'
    AND public.is_student_member_of_group(group_id)
    AND EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE t.id = task_submissions.task_id
        AND t.group_id = task_submissions.group_id
        AND t.assignee_id = auth.uid()
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
      AND gm.student_id = peer_reviews.reviewer_id
  )
  AND EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = peer_reviews.group_id
      AND gm.student_id = peer_reviews.reviewee_id
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
      AND existing_reviews.reviewer_id = peer_reviews.reviewer_id
      AND existing_reviews.reviewee_id = peer_reviews.reviewee_id
  )
);

DROP POLICY IF EXISTS student_feedback_insert ON public.student_feedback;

CREATE POLICY student_feedback_insert ON public.student_feedback
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.group_members recipient_member
    WHERE recipient_member.group_id = student_feedback.group_id
      AND recipient_member.student_id = student_feedback.recipient_id
  )
  AND (
    related_task_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE t.id = student_feedback.related_task_id
        AND t.group_id = student_feedback.group_id
    )
  )
  AND (
    public.is_admin()
    OR (
      sender_role = 'lecturer'
      AND EXISTS (
        SELECT 1
        FROM public.groups g
        WHERE g.id = student_feedback.group_id
          AND g.lecturer_id = auth.uid()
      )
    )
    OR (
      sender_role = 'leader'
      AND EXISTS (
        SELECT 1
        FROM public.group_members sender_member
        WHERE sender_member.group_id = student_feedback.group_id
          AND sender_member.student_id = auth.uid()
          AND sender_member.role = 'Leader'
      )
    )
  )
);

DROP POLICY IF EXISTS student_appeals_update_staff ON public.student_appeals;
DROP POLICY IF EXISTS student_appeals_update_student ON public.student_appeals;

CREATE POLICY student_appeals_update_student ON public.student_appeals
FOR UPDATE
USING (
  student_id = auth.uid()
  AND status = 'draft'
)
WITH CHECK (
  student_id = auth.uid()
  AND status IN ('draft', 'submitted')
);

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
  OR public.is_admin()
)
WITH CHECK (
  status IN ('under_review', 'resolved', 'rejected')
  AND EXISTS (
    SELECT 1
    FROM public.group_members member
    WHERE member.group_id = student_appeals.group_id
      AND member.student_id = student_appeals.student_id
  )
  AND (
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
  OR public.is_admin()
  )
);

CREATE OR REPLACE FUNCTION public.is_lecturer_of_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.groups g
    WHERE g.id = p_project_id
      AND g.lecturer_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS grades_select_admin ON public.rubric_grades;
DROP POLICY IF EXISTS grades_select_lecturer ON public.rubric_grades;
DROP POLICY IF EXISTS grades_select_student ON public.rubric_grades;
DROP POLICY IF EXISTS grades_select_student_submitted_only ON public.rubric_grades;
DROP POLICY IF EXISTS grades_insert ON public.rubric_grades;
DROP POLICY IF EXISTS grades_insert_lecturer_or_admin ON public.rubric_grades;
DROP POLICY IF EXISTS grades_update ON public.rubric_grades;
DROP POLICY IF EXISTS grades_update_lecturer_or_admin ON public.rubric_grades;
DROP POLICY IF EXISTS grades_delete ON public.rubric_grades;
DROP POLICY IF EXISTS grades_delete_lecturer_or_admin ON public.rubric_grades;

CREATE POLICY grades_select_admin ON public.rubric_grades
  FOR SELECT USING (public.is_admin());

CREATE POLICY grades_select_lecturer ON public.rubric_grades
  FOR SELECT USING (
    public.current_user_role() = 'lecturer'::public.user_role
    AND public.is_lecturer_of_project(project_id)
    AND EXISTS (
      SELECT 1
      FROM public.rubrics r
      WHERE r.id = rubric_grades.rubric_id
        AND r.project_id = rubric_grades.project_id
    )
  );

CREATE POLICY grades_select_student_submitted_only ON public.rubric_grades
  FOR SELECT USING (
    public.current_user_role() = 'student'::public.user_role
    AND status IN ('submitted', 'locked')
    AND EXISTS (
      SELECT 1
      FROM public.group_members gm
      WHERE gm.group_id = rubric_grades.group_id
        AND gm.student_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.rubrics r
      WHERE r.id = rubric_grades.rubric_id
        AND r.project_id = rubric_grades.project_id
    )
  );

CREATE POLICY grades_insert_lecturer_or_admin ON public.rubric_grades
  FOR INSERT WITH CHECK (
    (
      public.is_admin()
      OR (
        public.current_user_role() = 'lecturer'::public.user_role
        AND public.is_lecturer_of_project(project_id)
      )
    )
    AND EXISTS (
      SELECT 1
      FROM public.rubrics r
      WHERE r.id = rubric_grades.rubric_id
        AND r.project_id = rubric_grades.project_id
    )
  );

CREATE POLICY grades_update_lecturer_or_admin ON public.rubric_grades
  FOR UPDATE USING (
    (
      public.is_admin()
      OR (
        public.current_user_role() = 'lecturer'::public.user_role
        AND public.is_lecturer_of_project(project_id)
      )
    )
    AND EXISTS (
      SELECT 1
      FROM public.rubrics r
      WHERE r.id = rubric_grades.rubric_id
        AND r.project_id = rubric_grades.project_id
    )
  ) WITH CHECK (
    (
      public.is_admin()
      OR (
        public.current_user_role() = 'lecturer'::public.user_role
        AND public.is_lecturer_of_project(project_id)
      )
    )
    AND EXISTS (
      SELECT 1
      FROM public.rubrics r
      WHERE r.id = rubric_grades.rubric_id
        AND r.project_id = rubric_grades.project_id
    )
  );

CREATE POLICY grades_delete_lecturer_or_admin ON public.rubric_grades
  FOR DELETE USING (
    (
      public.is_admin()
      OR (
        public.current_user_role() = 'lecturer'::public.user_role
        AND public.is_lecturer_of_project(project_id)
      )
    )
    AND EXISTS (
      SELECT 1
      FROM public.rubrics r
      WHERE r.id = rubric_grades.rubric_id
        AND r.project_id = rubric_grades.project_id
    )
  );

GRANT EXECUTE ON FUNCTION public.is_lecturer_of_project(uuid) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
