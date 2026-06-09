# Diabolical 98 file merged review

## Reviewer agent found real blockers in the merged PR diff b57b973^1..b57b973:

- supabase/migrations/20260604141000_student_appeal_storage.sql: appeal attachments are readable and deletable by any authenticated user.
- supabase/migrations/20260604110000_task_submissions.sql: students can insert submissions for tasks in their group without verifying task ownership/assignment.
- supabase/migrations/20260604140000_student_module_core.sql: peer review insert policy likely blocks later submissions due to an unqualified reviewer_id.
- src/components/rubrics/LecturerGradingEvidenceView.tsx: uploaded evidence may not be openable because stored evidence has storagePath but the viewer expects publicUrl.
- src/lib/rubricParser.ts: loads SheetJS from CDN at runtime via dynamic import.
- student_feedback_insert: permits sender impersonation and arbitrary recipient targeting inside feedback rows.

## Tester agent wrote focused Vitest files:

- src/lib/rubricParser.test.ts
- src/lib/studentFeedback.test.ts

## Fix

- Added the PR 7 security repair migration at 20260609135826_repair_pr7_security_policies.sql (line 24), covering appeal storage policies, task submission insert hardening, peer review duplicate predicate, feedback insert checks, staff appeal update checks, and rubric_grades policies.
- Replaced runtime CDN SheetJS with local xlsx import in rubricParser.ts (line 85), and added xlsx to package locks.
Added private task-evidence signed URL support in taskSubmissions.ts (line 197) and wired lecturer evidence preview/download through it in LecturerGradingEvidenceView.tsx (line 159).
- Cleaned duplicateRubric unreachable code/mojibake in rubricPersistence.ts (line 482).
Added/expanded tests for local XLSX parsing and signed evidence URLs.