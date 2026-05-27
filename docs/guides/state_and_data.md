See [index.md](index.md) for the docs routing map.

## State, data, auth, and i18n

### Team dashboard data
- [src/context/TeamContext.tsx](../../src/context/TeamContext.tsx) - owns the dashboard-facing shape for groups, tasks, members, activity log, reports, materials, lecturer reviews, and verified badges. It still provides seeded demo data when Supabase is unconfigured, demo mode is active, or a configured database has no groups for the current user.
- [src/lib/teamPersistence.ts](../../src/lib/teamPersistence.ts) - maps between `TeamContext` objects and Supabase rows. For authenticated, non-demo sessions with Supabase configured, `TeamProvider` loads persisted team data and writes mutations back to Supabase after optimistic UI updates.
- [src/context/LanguageContext.tsx](../../src/context/LanguageContext.tsx) - language toggle (`vi` / `en`).
- [src/lib/i18n.ts](../../src/lib/i18n.ts) - dictionary and helpers `t()` / `tr()`.
- [src/hooks/use-toast.ts](../../src/hooks/use-toast.ts) - toast store and `useToast()`.
- [src/hooks/use-mobile.tsx](../../src/hooks/use-mobile.tsx) - breakpoint helper used by the sidebar system.

Persisted dashboard coverage includes groups, members, tasks, task approval/deadlines/priority/evidence metadata, activity logs, student reports, materials, lecturer scores, lecturer-student reviews, and verified badges. Derived member stats such as completed task counts and contribution percentages are recalculated in the frontend from approved tasks.

The `applyAgentSnapshot(snapshot)` method on `TeamContext` replaces all dashboard state from a `WorkspaceSnapshotJson` returned by the Python agent. ISO date strings are deserialized back to `Date` objects via `deserializeSnapshotToTeamState` in [src/lib/workspaceSnapshot.ts](../../src/lib/workspaceSnapshot.ts). In Supabase mode, `loadPersistedState` is called afterward to re-sync.

In plain terms:
- Demo/local mode still uses seeded in-memory data so the dashboards are easy to open while developing.
- Real logged-in Supabase sessions try to read/write dashboard data from Supabase.
- If Supabase is configured but the dashboard persistence migration has not been run, the app falls back to demo data and logs a warning in the browser console.

### AI chat history
- [src/lib/chatHistory.ts](../../src/lib/chatHistory.ts) - thin wrapper (`loadChatHistory`, `insertChatMessage`, `clearChatHistory`) for the `public.chat_messages` Supabase table.
- Chat messages are scoped by `(user_id, group_id)`. Switching groups shows only that group's conversation. RLS ensures users only see their own messages.
- In demo mode or when Supabase is unconfigured, all chat functions are no-ops and chat works in-memory only (messages are lost on sidebar close).
- The "Clear history" button in the sidebar header deletes all rows for the current user + group.

### Mail notifications
- [src/context/NotificationContext.tsx](../../src/context/NotificationContext.tsx) - manages notification states (`notifications`, `unreadCount`) and exposes operations: `sendNotification`, `markAsRead`, `markAllAsRead`.
- **Demo Mode integration:** Seeded with 2 mock notifications (Lecturer performance evaluation, Trần Thị B material upload) which run in-memory and update locally.
- **Supabase Persistence:** Reads and writes to the `public.notifications` table, ensuring users see, update, and manage their own alerts using active RLS policies.
- **Toast alerts:** Integrated with shadcn `useToast` to trigger temporary toast alerts on screen when a new notification is dispatched.


### Supabase Auth and `public.users` profile
- [src/lib/supabaseClient.ts](../../src/lib/supabaseClient.ts) - `createClient` from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; `isSupabaseConfigured` guard. Note: In Vercel deployments, official Supabase Marketplace variables (`SUPABASE_URL` and `SUPABASE_ANON_KEY`) are automatically mapped to Vite's prefixes during build time in `vite.config.ts`.
- [src/context/AuthContext.tsx](../../src/context/AuthContext.tsx) - session (`supabase.auth`), optional row from `public.users` (`id`, `email`, `role`, `full_name`, `profile_completed`), `refreshProfile`, `signOut` (also clears demo session flag).
  - **Stuck-on-Reload Resilience & Deduplication**: To prevent hanging database queries from locking the application (e.g. on invalid keys or network dropouts), a **5-second timeout** (`Promise.race`) fallback is wrapped around `loadProfile()`. Multiple concurrent profile requests (e.g. during double mounts or simultaneous listener firings) are deduplicated using a `loadingProfileUserId` ref. Crucially, the timeout is cleared immediately upon successful loading, preventing lingering timer rejections and console errors.
  - **Missing Profile Fallback**: If a user has a valid active Supabase Auth session but no matching row in `public.users`, a fallback profile is automatically generated using session metadata to keep the app functional.
- **Email login** - [src/pages/Login.tsx](../../src/pages/Login.tsx) uses `signInWithPassword` / `signUp`. Passwords are stored only in **Supabase Auth** (`auth.users`), not in `public.users`.
- **Google login** - `signInWithOAuth({ provider: 'google' })` with `redirectTo` back to `/login?role=...`. Before redirect, the chosen role is stored in `sessionStorage`; after return, the app calls RPC `set_signup_role` when `profile_completed` is still false (see migration `20260516100000_users_profile_completed_and_signup_role.sql`).
  - **Google Auth Error Handling**: Re-routes and parses technical redirect errors (e.g. account exists with other provider, unconfigured provider) from `window.location.hash` / `window.location.search`, presenting beautiful translated toast notifications. Parameters are automatically wiped from history using `window.history.replaceState` to prevent toast display loops on page reload.
- **Email sign-up role** - `signUp` passes `app_role` and `full_name` in `options.data`; trigger `handle_new_user` on `auth.users` inserts into `public.users` with that role when valid (`student` | `lecturer`).

### Demo mode vs real auth
- [src/lib/demoSession.ts](../../src/lib/demoSession.ts) - `sessionStorage` flag so **Demo student / Demo lecturer** buttons on the login page still open dashboards without a Supabase session when the app is configured.
- [src/components/ProtectedRoute.tsx](../../src/components/ProtectedRoute.tsx) - if Supabase env is missing, dashboards render without login. If Supabase is configured, routes require either a valid session **or** demo session; otherwise redirect to `/login`.

### Row-level security (database)
Policies are defined in SQL migrations under [supabase/migrations](../../supabase/migrations/). Lecturers are scoped to groups they own; students have read access to dashboard data in their groups and can insert/update their own `contribution_logs` rows. Student reports are visible to lecturers/admins, not group peers. Admins retain broad access where defined in SQL.

### Notes
- Demo-mode behavior is intentionally preserved. Do not remove the local seeded fallback unless the login/demo flow is redesigned.
- AI behaviors in the UI remain simulated with timers (student and lecturer dashboards, AI chat widget).

### Task Logs
- **Project Creation & Join Support (2026-05-23):** Implemented `createProject` and `joinProject` methods on `TeamContext` with integrated real Supabase database insertion (`createPersistedGroup`, `joinPersistedGroup` in `teamPersistence.ts`) and mock in-memory fallback behavior for the dashboard demo mode.
- **Production Project Management & Dynamic Redirection (2026-05-23):** Integrated sandbox layouts into the new `ProjectManagement.tsx` production page. Connected it to the real `useTeam`, `useAuth`, and `useLanguage` contexts to support creating and joining actual project groups and launching workspaces with dynamic student vs lecturer redirects. Added a "Switch Projects" item to both `StudentDashboard` and `LecturerDashboard` sidebars to support switching back to the project list easily. Deleted the sandbox page and cleaned up references.
- **Security Audit & RLS Hardening (2026-05-25):** Audited persistent calendar, notifications schema, and project management RLS migrations. Fixed a critical vulnerability in `notifications` INSERT policy that allowed fake notification spoofing/spamming. Patched `group_members` INSERT policy to prevent unauthorized role escalation to `'Leader'`. Redefined `is_lecturer_of_group` and updated `groups` RLS policies to solve the structural bug where student-created projects (which assign student ID as `lecturer_id`) were invisible and ungradeable by real lecturers.
- **Session 4 Validation & Lint Hardening (2026-05-25):** Acted as the tester and validator for Session 4 features. Verified nearest project redirection logic, display name onboarding modals, settings renaming, 3-option project onboarding with real-time UID validation, and connection error handling. Successfully ran all Vitest tests and fixed several pre-existing typescript `@typescript-eslint/no-explicit-any` errors in `OnboardingNameModal.tsx`, `SettingsModal.tsx`, `NotificationContext.tsx`, `teamPersistence.ts`, and `ProjectManagement.tsx` to achieve a 100% clean production build.
- **Session 4: Onboarding, Settings Rename, and Redirection Hardening (2026-05-25):**
  - **Type**: Feature / Security
  - **Files Modified**:
    - `src/context/AuthContext.tsx` (exposed `updateProfileName`)
    - `src/context/TeamContext.tsx` (safe variables mapping, `connectionError` tracking, `localStorage` redirection)
    - `src/components/OnboardingNameModal.tsx` (new username setup modal)
    - `src/components/SettingsModal.tsx` (new settings/general profile renaming modal)
    - `src/pages/ProjectManagement.tsx` (3-option onboarding layout, real-time UID validation for member updates)
    - `src/pages/StudentDashboard.tsx` & `src/pages/LecturerDashboard.tsx` (sidebar Settings trigger)
    - `src/test/session4.test.ts` (vitest unit test suite)
  - **Summary of Changes**:
    - Completely removed seeded fallback data for authenticated users, defaulting to empty arrays and tracking a connection error state if loading fails.
    - Implemented Name Onboarding screen intercepting unregistered logins, with account profile updates directly stored inside the `public.users` Supabase table.
    - Added Settings Modal under General Settings allowing users to rename their account or retrieve their Supabase UID with zero delay.
    - Designed 3-Option Onboarding Dashboard for newly logged-in accounts, prompting for team joining, project creation (with real-time member searches of Supabase by UID), or Freestyle exploration.
    - Maintained nearest project tracking utilizing per-user local storage schemas to route returning users exactly where they left off.
  - **Manual Verification Details**:
    - Created unit tests confirming security access limits, localStorage keys mapping, and role redirection logic. Running vitest returns 100% passes.


