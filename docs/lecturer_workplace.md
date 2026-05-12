See [index.md](index.md) for the docs routing map.

## Lecturer workspace feature map
Primary entry: [src/pages/LecturerDashboard.tsx](src/pages/LecturerDashboard.tsx)
- Group overview and analytics
  - [src/components/ContributionAnalytics.tsx](src/components/ContributionAnalytics.tsx)
- Reports and rubric
  - [src/components/LecturerReports.tsx](src/components/LecturerReports.tsx) - student reports and review actions.
  - [src/components/RubricManager.tsx](src/components/RubricManager.tsx) - rubric upload and grading UI.
- Lecturer student review and badges
  - [src/components/feature-groups/LecturerStudentEvaluationPanel.tsx](src/components/feature-groups/LecturerStudentEvaluationPanel.tsx)
- Export and materials
  - [src/components/ExportReport.tsx](src/components/ExportReport.tsx) - CSV/XLS export demo.
  - [src/components/MaterialsSection.tsx](src/components/MaterialsSection.tsx) - upload and delete materials (lecturer view).