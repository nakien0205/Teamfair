See [index.md](index.md) for the docs routing map.

## Student workspace feature map
Primary entry: [src/pages/StudentDashboard.tsx](../../src/pages/StudentDashboard.tsx) (behind [ProtectedRoute](../../src/components/ProtectedRoute.tsx) when Supabase is configured; see [state_and_data.md](state_and_data.md)).
- Task work and status flow
  - [src/components/KanbanBoard.tsx](src/components/KanbanBoard.tsx) - drag and drop Kanban, evidence uploads.
- Calendar and timeline
  - [src/components/ProjectCalendar.tsx](src/components/ProjectCalendar.tsx) - month/week views, event creation, task deadline sync.
- Contribution and fairness
  - [src/components/ContributionAnalytics.tsx](src/components/ContributionAnalytics.tsx) - charts, score card, warnings.
  - [src/components/StudentReportModal.tsx](src/components/StudentReportModal.tsx) - report a member to lecturer.
  - [src/components/feature-groups/StudentAgentSidebar.tsx](src/components/feature-groups/StudentAgentSidebar.tsx) - floating assistant (OpenRouter agent server); see [student_workspace_agent.md](student_workspace_agent.md).
- Materials
  - [src/components/MaterialsSection.tsx](src/components/MaterialsSection.tsx) - upload and list materials (student view).
- Verified badges
  - [src/components/feature-groups/VerifiedBadgesSection.tsx](src/components/feature-groups/VerifiedBadgesSection.tsx) - show awarded badges.