See [index.md](index.md) for the docs routing map.

## Lecturer workspace feature map
Primary entry: [src/pages/LecturerDashboard.tsx](../../src/pages/LecturerDashboard.tsx) (behind [ProtectedRoute](../../src/components/ProtectedRoute.tsx) when Supabase is configured; see [state_and_data.md](state_and_data.md)).
- Group overview and analytics
  - [src/components/ContributionAnalytics.tsx](src/components/ContributionAnalytics.tsx)
- Reports and rubric
  - [src/components/LecturerReports.tsx](src/components/LecturerReports.tsx) - student reports and review actions.
    - **Incoming Alerts**: Receives real-time mail notifications from `StudentReportModal.tsx` when a student submits a peer review complaint.
  - [src/components/RubricManager.tsx](src/components/RubricManager.tsx) - rubric upload and grading UI.
- Lecturer student review and badges
  - [src/components/feature-groups/LecturerStudentEvaluationPanel.tsx](src/components/feature-groups/LecturerStudentEvaluationPanel.tsx)
    - **Evaluation Notifications**: Publishing a student's performance review (rating/comments/badges) automatically dispatches a target-student notification. If the review awards a "Verified contribution badge", the notification specifically highlights this reward.
- Export and materials
  - [src/components/ExportReport.tsx](src/components/ExportReport.tsx) - CSV/XLS export demo.
  - [src/components/MaterialsSection.tsx](src/components/MaterialsSection.tsx) - upload and delete materials (lecturer view).