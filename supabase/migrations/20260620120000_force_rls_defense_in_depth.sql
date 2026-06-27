-- ============================================================================
-- CRIT-3: FORCE ROW LEVEL SECURITY — Defense-in-Depth
-- ============================================================================
--
-- WHY:
--   Edge Functions authenticate via SUPABASE_SERVICE_ROLE_KEY, which by default
--   bypasses ALL Row Level Security. Without FORCE ROW LEVEL SECURITY, if any
--   new handler is added without proper application-layer auth checks, the
--   table is immediately exploitable — any query runs unrestricted.
--
--   FORCE ROW LEVEL SECURITY makes RLS apply even to table owners (including
--   service_role). We then add an explicit permissive policy granting
--   service_role full access, so Edge Functions continue working exactly as
--   before. The net effect:
--
--     • service_role  → allowed (explicit policy)
--     • anon / authenticated → governed by existing per-table RLS policies
--     • Any NEW role without a policy → blocked by default (defense-in-depth)
--
-- IDEMPOTENCY:
--   DROP POLICY IF EXISTS runs before each CREATE POLICY, so this migration
--   is safe to re-run.
-- ============================================================================

-- 1. users
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON public.users;
CREATE POLICY "service_role_bypass" ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. groups
ALTER TABLE public.groups FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON public.groups;
CREATE POLICY "service_role_bypass" ON public.groups FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. group_members
ALTER TABLE public.group_members FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON public.group_members;
CREATE POLICY "service_role_bypass" ON public.group_members FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. tasks
ALTER TABLE public.tasks FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON public.tasks;
CREATE POLICY "service_role_bypass" ON public.tasks FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. contribution_logs
ALTER TABLE public.contribution_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON public.contribution_logs;
CREATE POLICY "service_role_bypass" ON public.contribution_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. ai_evaluations
ALTER TABLE public.ai_evaluations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON public.ai_evaluations;
CREATE POLICY "service_role_bypass" ON public.ai_evaluations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 7. activity_logs
ALTER TABLE public.activity_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON public.activity_logs;
CREATE POLICY "service_role_bypass" ON public.activity_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 8. student_reports
ALTER TABLE public.student_reports FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON public.student_reports;
CREATE POLICY "service_role_bypass" ON public.student_reports FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 9. materials
ALTER TABLE public.materials FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON public.materials;
CREATE POLICY "service_role_bypass" ON public.materials FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 10. lecturer_student_reviews
ALTER TABLE public.lecturer_student_reviews FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON public.lecturer_student_reviews;
CREATE POLICY "service_role_bypass" ON public.lecturer_student_reviews FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 11. verified_badges
ALTER TABLE public.verified_badges FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON public.verified_badges;
CREATE POLICY "service_role_bypass" ON public.verified_badges FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 12. lecturer_scores
ALTER TABLE public.lecturer_scores FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON public.lecturer_scores;
CREATE POLICY "service_role_bypass" ON public.lecturer_scores FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 13. chat_messages
ALTER TABLE public.chat_messages FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON public.chat_messages;
CREATE POLICY "service_role_bypass" ON public.chat_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 14. calendar_events
ALTER TABLE public.calendar_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON public.calendar_events;
CREATE POLICY "service_role_bypass" ON public.calendar_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 15. notifications
ALTER TABLE public.notifications FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON public.notifications;
CREATE POLICY "service_role_bypass" ON public.notifications FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 16. project_invites
ALTER TABLE public.project_invites FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON public.project_invites;
CREATE POLICY "service_role_bypass" ON public.project_invites FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 17. join_requests
ALTER TABLE public.join_requests FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON public.join_requests;
CREATE POLICY "service_role_bypass" ON public.join_requests FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 18. task_submissions
ALTER TABLE public.task_submissions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON public.task_submissions;
CREATE POLICY "service_role_bypass" ON public.task_submissions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 19. peer_review_periods
ALTER TABLE public.peer_review_periods FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON public.peer_review_periods;
CREATE POLICY "service_role_bypass" ON public.peer_review_periods FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 20. peer_reviews
ALTER TABLE public.peer_reviews FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON public.peer_reviews;
CREATE POLICY "service_role_bypass" ON public.peer_reviews FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 21. student_feedback
ALTER TABLE public.student_feedback FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON public.student_feedback;
CREATE POLICY "service_role_bypass" ON public.student_feedback FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 22. student_appeals
ALTER TABLE public.student_appeals FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON public.student_appeals;
CREATE POLICY "service_role_bypass" ON public.student_appeals FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 23. rubrics
ALTER TABLE public.rubrics FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON public.rubrics;
CREATE POLICY "service_role_bypass" ON public.rubrics FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 24. rubric_templates
ALTER TABLE public.rubric_templates FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON public.rubric_templates;
CREATE POLICY "service_role_bypass" ON public.rubric_templates FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 25. rubric_grades
ALTER TABLE public.rubric_grades FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON public.rubric_grades;
CREATE POLICY "service_role_bypass" ON public.rubric_grades FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 26. rubric_audit_logs
ALTER TABLE public.rubric_audit_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON public.rubric_audit_logs;
CREATE POLICY "service_role_bypass" ON public.rubric_audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 27. group_email_invites
ALTER TABLE public.group_email_invites FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON public.group_email_invites;
CREATE POLICY "service_role_bypass" ON public.group_email_invites FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 28. contribution_ai_analysis
ALTER TABLE public.contribution_ai_analysis FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass" ON public.contribution_ai_analysis;
CREATE POLICY "service_role_bypass" ON public.contribution_ai_analysis FOR ALL TO service_role USING (true) WITH CHECK (true);
