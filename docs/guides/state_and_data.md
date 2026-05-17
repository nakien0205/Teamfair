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

In plain terms:
- Demo/local mode still uses seeded in-memory data so the dashboards are easy to open while developing.
- Real logged-in Supabase sessions try to read/write dashboard data from Supabase.
- If Supabase is configured but the dashboard persistence migration has not been run, the app falls back to demo data and logs a warning in the browser console.

### Supabase Auth and `public.users` profile
- [src/lib/supabaseClient.ts](../../src/lib/supabaseClient.ts) - `createClient` from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; `isSupabaseConfigured` guard.
- [src/context/AuthContext.tsx](../../src/context/AuthContext.tsx) - session (`supabase.auth`), optional row from `public.users` (`id`, `email`, `role`, `full_name`, `profile_completed`), `refreshProfile`, `signOut` (also clears demo session flag).
- **Email login** - [src/pages/Login.tsx](../../src/pages/Login.tsx) uses `signInWithPassword` / `signUp`. Passwords are stored only in **Supabase Auth** (`auth.users`), not in `public.users`.
- **Google login** - `signInWithOAuth({ provider: 'google' })` with `redirectTo` back to `/login?role=...`. Before redirect, the chosen role is stored in `sessionStorage`; after return, the app calls RPC `set_signup_role` when `profile_completed` is still false (see migration `20260516100000_users_profile_completed_and_signup_role.sql`).
- **Email sign-up role** - `signUp` passes `app_role` and `full_name` in `options.data`; trigger `handle_new_user` on `auth.users` inserts into `public.users` with that role when valid (`student` | `lecturer`).

### Demo mode vs real auth
- [src/lib/demoSession.ts](../../src/lib/demoSession.ts) - `sessionStorage` flag so **Demo student / Demo lecturer** buttons on the login page still open dashboards without a Supabase session when the app is configured.
- [src/components/ProtectedRoute.tsx](../../src/components/ProtectedRoute.tsx) - if Supabase env is missing, dashboards render without login. If Supabase is configured, routes require either a valid session **or** demo session; otherwise redirect to `/login`.

### Row-level security (database)
Policies are defined in SQL migrations under [supabase/migrations](../../supabase/migrations/). Lecturers are scoped to groups they own; students have read access to dashboard data in their groups and can insert/update their own `contribution_logs` rows. Student reports are visible to lecturers/admins, not group peers. Admins retain broad access where defined in SQL.

### Notes
- Demo-mode behavior is intentionally preserved. Do not remove the local seeded fallback unless the login/demo flow is redesigned.
- AI behaviors in the UI remain simulated with timers (student and lecturer dashboards, AI chat widget).
