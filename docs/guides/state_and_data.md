See [index.md](index.md) for the docs routing map.

## State, data, auth, and i18n

### In-memory demo (dashboard UI)
- [src/context/TeamContext.tsx](../../src/context/TeamContext.tsx) - in-memory demo data for groups, tasks, members, activity log, reports, materials, lecturer reviews, and verified badges. All core mutations for the current UI still live here.
- [src/context/LanguageContext.tsx](../../src/context/LanguageContext.tsx) - language toggle (`vi` / `en`).
- [src/lib/i18n.ts](../../src/lib/i18n.ts) - dictionary and helpers `t()` / `tr()`.
- [src/hooks/use-toast.ts](../../src/hooks/use-toast.ts) - toast store and `useToast()`.
- [src/hooks/use-mobile.tsx](../../src/hooks/use-mobile.tsx) - breakpoint helper used by the sidebar system.

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
Policies are defined in SQL migrations under [supabase/migrations](../../supabase/migrations/). Lecturers are scoped to groups they own; students have read access to tasks/logs in their groups and can insert/update their own `contribution_logs` rows. Admins retain broad access where defined in SQL.

### Notes
- Dashboard business data (tasks, groups, etc.) is still **in-memory** in `TeamContext`; wiring CRUD to Supabase tables is future work.
- AI behaviors in the UI remain simulated with timers (student and lecturer dashboards, AI chat widget).
