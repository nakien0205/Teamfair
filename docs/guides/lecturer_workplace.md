See [index.md](index.md) for the docs routing map.

## Lecturer workspace feature map
Primary entry: [src/layouts/LecturerLayout.tsx](../../src/layouts/LecturerLayout.tsx) (behind [ProtectedRoute](../../src/components/ProtectedRoute.tsx)). This layout acts as the central navigation shell for all lecturer pages, replacing the old monolithic `LecturerDashboard.tsx`.

- Workspace Overview
  - [src/pages/LecturerDashboard.tsx](../../src/pages/LecturerDashboard.tsx) - renders group members table, AI analysis, and links to evaluation metrics.
  - [src/pages/LecturerGroupsPage.tsx](../../src/pages/LecturerGroupsPage.tsx) - lecturer page to manage classes, projects, groups, and score grading. Features client-side pagination for group listing.
- Group overview and analytics
  - [src/pages/LecturerContributionPage.tsx](../../src/pages/LecturerContributionPage.tsx) -> renders [src/components/ContributionAnalytics.tsx](src/components/ContributionAnalytics.tsx)
- Reports and rubric
  - [src/pages/LecturerReportsPage.tsx](../../src/pages/LecturerReportsPage.tsx) -> renders [src/components/LecturerReports.tsx](src/components/LecturerReports.tsx) - student reports and review actions.
    - **Incoming Alerts**: Receives real-time mail notifications from `StudentReportModal.tsx` when a student submits a peer review complaint.
  - [src/components/RubricManager.tsx](src/components/RubricManager.tsx) - old mock rubric upload and grading UI.
  - **Spreadsheet Rubric Import and Group Evaluation**:
    - Database Tables: `rubrics`, `rubric_templates`, `rubric_grades` (with `selected_cells_json` for tracking ratings), and `rubric_audit_logs` (defined in `supabase/migrations/20260604150000_rubric_import_and_grading.sql`).
    - Pages:
      - [src/pages/LecturerRubricsList.tsx](../../src/pages/LecturerRubricsList.tsx): List of saved templates and grading selector modal.
      - [src/pages/LecturerRubricUpload.tsx](../../src/pages/LecturerRubricUpload.tsx): Drag & drop interface validating file sizes (<10MB) and formats (.xlsx, .csv).
      - [src/pages/LecturerRubricPreview.tsx](../../src/pages/LecturerRubricPreview.tsx): Interactive spreadsheet-like editor to rename columns, add/delete rows/columns, map criteria and rating levels, set the max score criteria, and save templates.
      - [src/pages/LecturerRubricGrade.tsx](../../src/pages/LecturerRubricGrade.tsx): A 45/55 split-screen grader sheet. 
        - **Left Panel (Evidence Viewer)**: `LecturerGradingEvidenceView.tsx` serves as a document/evidence viewer with filtering, dropdown selection, and embedded previews for PDF, images, videos, code, tasks, contribution summaries, and AI summaries.
        - **Right Panel (Rubric Table)**: Interactive checkmark rating cells, overall group feedback input (saved to `__overall_feedback` in `selected_cells_json`), score summing, validation, drafts, locking, and final score cascading. Header is sticky.
    - Parsing Utility: Uses `src/lib/rubricParser.ts` (with custom CSV parser and dynamic import of SheetJS `xlsx` via CDN) and `src/lib/rubricPersistence.ts` for database operations.
- Lecturer student review and badges
  - [src/components/feature-groups/LecturerStudentEvaluationPanel.tsx](src/components/feature-groups/LecturerStudentEvaluationPanel.tsx)
    - **Evaluation Notifications**: Publishing a student's performance review (rating/comments/badges) automatically dispatches a target-student notification. If the review awards a "Verified contribution badge", the notification specifically highlights this reward.
- Export and materials
  - [src/components/ExportReport.tsx](src/components/ExportReport.tsx) - CSV/XLS export utility.
  - [src/components/MaterialsSection.tsx](src/components/MaterialsSection.tsx) - upload and delete materials (lecturer view).