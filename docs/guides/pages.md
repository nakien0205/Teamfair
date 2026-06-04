See [index.md](index.md) for the docs routing map.

## Pages (top-level views)
- [src/pages/Landing.tsx](src/pages/Landing.tsx) - marketing/hero landing page with language switcher.
- [src/pages/Login.tsx](src/pages/Login.tsx) - Google OAuth and email sign-in / sign-up (Supabase Auth), role-based redirect when authenticated.
- [src/layouts/StudentLayout.tsx](src/layouts/StudentLayout.tsx) - Centralized layout for all student pages (Overview, Workspace, Tasks, Work Logs, etc.).
- [src/pages/StudentDashboard.tsx](src/pages/StudentDashboard.tsx) - student workspace with tasks, calendar, evaluation, materials, badges, and activity log.
- [src/pages/StudentOverview.tsx](src/pages/StudentOverview.tsx) - student overview page.
- [src/pages/StudentMyGroup.tsx](src/pages/StudentMyGroup.tsx) - group management page for students.
- [src/pages/LecturerDashboard.tsx](src/pages/LecturerDashboard.tsx) - lecturer workspace with group overview, reports, rubric, evaluations, exports, materials, and activity log.
- [src/pages/ProjectManagement.tsx](src/pages/ProjectManagement.tsx) - Project dashboard allowing users to list, select, create, and join project workspaces. Joining uses invite codes (`IV-XXXXXX`) instead of raw UUIDs. Leaders see a "Join Requests" management panel to approve/reject applicants. Applicants who used a `requires_approval` invite code see a pending status card with real-time waiting indication. Features a dedicated sidebar-navigable full-page "Notifications" center mapped dynamically to active projects.
- [src/pages/NotFound.tsx](src/pages/NotFound.tsx) - 404 view.