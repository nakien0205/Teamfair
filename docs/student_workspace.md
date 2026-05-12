See [index.md](index.md) for the docs routing map.

## Student workspace feature map
Primary entry: [src/pages/StudentDashboard.tsx](src/pages/StudentDashboard.tsx)
- Task work and status flow
  - [src/components/KanbanBoard.tsx](src/components/KanbanBoard.tsx) - drag and drop Kanban, evidence uploads.
- Calendar and timeline
  - [src/components/ProjectCalendar.tsx](src/components/ProjectCalendar.tsx) - month/week views, event creation, task deadline sync.
- Contribution and fairness
  - [src/components/ContributionAnalytics.tsx](src/components/ContributionAnalytics.tsx) - charts, score card, warnings.
  - [src/components/StudentReportModal.tsx](src/components/StudentReportModal.tsx) - report a member to lecturer.
  - [src/components/feature-groups/AIChatWidget.tsx](src/components/feature-groups/AIChatWidget.tsx) - guided help and summaries.
- Materials
  - [src/components/MaterialsSection.tsx](src/components/MaterialsSection.tsx) - upload and list materials (student view).
- Verified badges
  - [src/components/feature-groups/VerifiedBadgesSection.tsx](src/components/feature-groups/VerifiedBadgesSection.tsx) - show awarded badges.