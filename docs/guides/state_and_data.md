See [index.md](index.md) for the docs routing map.

## State, data, auth, and i18n

### Team dashboard data

- [src/context/TeamContext.tsx](../../src/context/TeamContext.tsx) - owns the dashboard-facing shape for groups, tasks, members, activity log, reports, materials, lecturer reviews, and verified badges. Supabase is configured.
- [src/lib/teamPersistence.ts](../../src/lib/teamPersistence.ts) - maps between `TeamContext` objects and Supabase rows. For authenticated, all sessions is Supabase configured, `TeamProvider` loads persisted team data and writes mutations back to Supabase after optimistic UI updates.
- **Project Sharing, Invites, and Join Requests:** Project sharing permits group members to invite peers using random 6-character alphanumeric code strings prefixed with `IV-` (e.g. `IV-XXXXXX`). Under [src/lib/teamPersistence.ts](../../src/lib/teamPersistence.ts), functions are implemented to generate invites, revoke invites, validate invite codes (validating expiry and max uses), create join requests, fetch requests, and approve/reject requests (inserting approved applicants into `group_members`). The `TeamProvider` coordinates this state (`activeInvites` and `pendingJoinRequests`) and wraps `joinProject` to support invite code validation and automatic notification dispatches to project leaders and lecturers.
- [src/context/LanguageContext.tsx](../../src/context/LanguageContext.tsx) - language toggle (`vi` / `en`).
- [src/lib/i18n.ts](../../src/lib/i18n.ts) - dictionary and helpers `t()` / `tr()`.
- [src/hooks/use-toast.ts](../../src/hooks/use-toast.ts) - toast store and `useToast()`.
- [src/hooks/use-mobile.tsx](../../src/hooks/use-mobile.tsx) - breakpoint helper used by the sidebar system.

Persisted dashboard coverage includes groups, members, tasks, task approval/deadlines/priority/evidence metadata, activity logs, student reports, materials, lecturer scores, lecturer-student reviews, and verified badges. Derived member stats such as completed task counts and contribution percentages are recalculated in the frontend from approved tasks.

The `applyAgentSnapshot(snapshot)` method on `TeamContext` replaces all dashboard state from a `WorkspaceSnapshotJson` returned by the Python agent. ISO date strings are deserialized back to `Date` objects via `deserializeSnapshotToTeamState` in [src/lib/workspaceSnapshot.ts](../../src/lib/workspaceSnapshot.ts). In Supabase mode, `loadPersistedState` is called afterward to re-sync.

In plain terms:

- Real logged-in Supabase sessions read/write dashboard data from Supabase.

### AI chat history

- [src/lib/chatHistory.ts](../../src/lib/chatHistory.ts) - thin wrapper (`loadChatHistory`, `insertChatMessage`, `clearChatHistory`) for the `public.chat_messages` Supabase table.
- Chat messages are scoped by `(user_id, group_id)`. Switching groups shows only that group's conversation. RLS ensures users only see their own messages.
- The "Clear history" button in the sidebar header deletes all rows for the current user + group.

### Mail notifications

- [src/context/NotificationContext.tsx](../../src/context/NotificationContext.tsx) - manages notification states (`notifications`, `unreadCount`) and exposes operations: `sendNotification`, `markAsRead`, `markAllAsRead`.
- **Database Persistence:** Reads and writes to the `public.notifications` table, ensuring users see, update, and manage their own alerts using active RLS policies.
- **Toast alerts:** Integrated with shadcn `useToast` to trigger temporary toast alerts on screen when a new notification is dispatched.
- **Dashboard Panel:** A dedicated, spacious "Notifications" tab has been added below "Activity Logs" in `src/pages/ProjectManagement.tsx`. It pulls alerts from `NotificationContext` and renders them with full-page controls:
  - Supports filter toggling between "All Notifications" and "Unread" notifications.
  - Reuses the visual mail styling from `NotificationMailIcon.tsx` with responsive, hover-animated cards.
  - Dynamically associates notifications with their source projects/groups on the client side using a member-name and task-name lookup.
  - Custom dynamic gradient avatars are rendered for each sender based on their name.
  - Clicking any card marks the notification as read locally and in the database, with no routing redirection (as configured per user specifications).

### Supabase Auth and `public.users` profile

- [src/lib/supabaseClient.ts](../../src/lib/supabaseClient.ts) - `createClient` from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; `isSupabaseConfigured` guard. Note: In Vercel deployments, official Supabase Marketplace variables (`SUPABASE_URL` and `SUPABASE_ANON_KEY`) are automatically mapped to Vite's prefixes during build time in `vite.config.ts`.
- [src/context/AuthContext.tsx](../../src/context/AuthContext.tsx) - session (`supabase.auth`), optional row from `public.users` (`id`, `email`, `role`, `full_name`, `profile_completed`), `refreshProfile`, `signOut`.
  - **Stuck-on-Reload Resilience & Deduplication**: To prevent hanging database queries from locking the application (e.g. on invalid keys or network dropouts), a **5-second timeout** (`Promise.race`) fallback is wrapped around `loadProfile()`. Multiple concurrent profile requests (e.g. during double mounts or simultaneous listener firings) are deduplicated using a `loadingProfileUserId` ref. Crucially, the timeout is cleared immediately upon successful loading, preventing lingering timer rejections and console errors.
  - **Missing Profile Fallback**: If a user has a valid active Supabase Auth session but no matching row in `public.users`, a fallback profile is automatically generated using session metadata to keep the app functional.
- **Email login** - [src/pages/Login.tsx](../../src/pages/Login.tsx) uses `signInWithPassword` / `signUp`. Passwords are stored only in **Supabase Auth** (`auth.users`), not in `public.users`.
- **Google login** - `signInWithOAuth({ provider: 'google' })` with `redirectTo` back to `/login?role=...`. Before redirect, the chosen role is stored in `sessionStorage`; after return, the app calls RPC `set_signup_role` when `profile_completed` is still false (see migration `20260516100000_users_profile_completed_and_signup_role.sql`).
  - **Google Auth Error Handling**: Re-routes and parses technical redirect errors (e.g. account exists with other provider, unconfigured provider) from `window.location.hash` / `window.location.search`, presenting beautiful translated toast notifications. Parameters are automatically wiped from history using `window.history.replaceState` to prevent toast display loops on page reload.
- **Email sign-up role** - `signUp` passes `app_role` and `full_name` in `options.data`; trigger `handle_new_user` on `auth.users` inserts into `public.users` with that role when valid (`student` | `lecturer`).

### Row-level security (database)

Policies are defined in SQL migrations under [supabase/migrations](../../supabase/migrations/). Lecturers are scoped to groups they own; students have read access to dashboard data in their groups and can insert/update their own `contribution_logs` rows. Student reports are visible to lecturers/admins, not group peers. Admins retain broad access where defined in SQL.
