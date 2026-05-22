See [index.md](index.md) for the docs routing map.

## Student workspace feature map
Primary entry: [src/pages/StudentDashboard.tsx](../../src/pages/StudentDashboard.tsx) (behind [ProtectedRoute](../../src/components/ProtectedRoute.tsx) when Supabase is configured; see [state_and_data.md](state_and_data.md)).
- Task work and status flow
  - [src/components/KanbanBoard.tsx](src/components/KanbanBoard.tsx) - drag and drop Kanban, evidence uploads.
  - **Dynamic Identity & Role Mapping**: The dashboard dynamically maps the student's name and role based on their active session. `currentUserName` is bound to the logged-in profile's `full_name` (falling back to demo mocks like `'Trần Thị B'` only when unauthenticated). The active student's role (`Leader` vs `Member`) is fetched directly from their row in the `group_members` table in Supabase.
- Calendar and timeline
  - [src/components/ProjectCalendar.tsx](src/components/ProjectCalendar.tsx) - month/week views, event creation, task deadline sync.
  - **Calendar Persistence**: Calendar events created by students (such as Meetings or Milestones) are persisted in real-time to the `public.calendar_events` database table in Supabase. These manual events merge seamlessly on the calendar view with automatically-generated task deadline events derived from the group's tasks. Access and mutation rights are secured via PostgreSQL Row-Level Security (RLS) policies.
- Contribution and fairness
  - [src/components/ContributionAnalytics.tsx](src/components/ContributionAnalytics.tsx) - charts, score card, warnings.
  - [src/components/StudentReportModal.tsx](src/components/StudentReportModal.tsx) - report a member to lecturer.
  - [src/components/feature-groups/StudentAgentSidebar.tsx](src/components/feature-groups/StudentAgentSidebar.tsx) - AI assistant sidebar (OpenRouter agent server); triggered from the dashboard header Sparkles/AI button (global, visible on all tabs). Chat history persists via Supabase `chat_messages` table (scoped per group). After agent calls, a diff panel shows added/removed/modified tasks with Apply/Discard buttons. An auto-apply toggle (localStorage `agentAutoApply`) skips the panel. While the agent works, the touched section (KanbanBoard or ProjectCalendar) is locked via a `locked` prop with an overlay badge. See [student_workspace_agent.md](student_workspace_agent.md) and [state_and_data.md](state_and_data.md).
- Materials
  - [src/components/MaterialsSection.tsx](src/components/MaterialsSection.tsx) - upload and list materials (student view).
- Verified badges
  - [src/components/feature-groups/VerifiedBadgesSection.tsx](src/components/feature-groups/VerifiedBadgesSection.tsx) - show awarded badges.