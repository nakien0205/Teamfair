# Auth Context

This file is the canonical Auth context entrypoint for Teamfair.

Use it after `process/context/all-context.md` when the task needs user authentication, sessions, or role management.

---

## Scope

This group covers:
- Supabase session management, login, signup, and Google OAuth setup.
- React AuthContext (`src/context/AuthContext.tsx`) and user profile retrieval.
- Role-based redirect logic (Student vs Lecturer dashboards).
- Protected route gating.

It does not cover:
- Database RLS setup (belongs in database/ group).
- Feature access permission within workspaces.

## Read When

Read this entrypoint when:
- Editing auth context, login scripts, or provider configurations.
- Modifying protected dashboard route gating or redirection logic.
- Debugging user profile loading or session timeouts.

## Source Paths

- `src/context/AuthContext.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/lib/dashboardPath.ts`

## Update Triggers

Update this group when:
- Login authentication providers change.
- User profile columns or onboarding flows are updated.
