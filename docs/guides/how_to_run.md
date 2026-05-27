See [index.md](index.md) for the docs routing map.

## How to run (from package.json)
- `npm run dev` - start Vite dev server (**port 8080**; see [vite.config.ts](../../vite.config.ts)). The script invokes Vite via `node ./node_modules/vite/bin/vite.js` so Windows shells that do not resolve `node_modules/.bin` still work.
- If you use **pnpm** (see `packageManager` in [package.json](../../package.json)), prefer `pnpm dev` — pnpm wires local binaries reliably.
- `npm run build` - production build
- `npm run build:dev` - development build mode
- `npm run preview` - preview production build
- `npm run lint` - ESLint
- `npm run test` - Vitest run once
- `npm run test:watch` - Vitest watch

## Environment variables (Supabase + Vite)
The app reads Supabase from **Vite** env vars (must be prefixed with `VITE_` to reach the browser):

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Project URL, e.g. `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase **anon** public key (Dashboard → Settings → API) |
| `VITE_STUDENT_AGENT_URL` | Optional. Base URL of the **Python FastAPI** student agent (no trailing slash). Leave unset in local dev to use the Vite proxy to `127.0.0.1:8010`. **Required for production** on Vercel if the sidebar should call a hosted agent (see [student_workspace_agent.md](student_workspace_agent.md)). |

Copy [.env.example](../../.env.example) to `.env` and fill in the values. If these are missing, auth UI shows a configuration message and dashboards still work via **demo mode** (see [state_and_data.md](state_and_data.md)).

**Do not** put the Google OAuth **client secret** in any `VITE_*` variable (it would be exposed in the client bundle). Configure Google under **Supabase Dashboard → Authentication → Providers → Google**.

## Google Cloud Console (Web OAuth client)
Use these when creating or editing the OAuth 2.0 **Web application** client that you attach to Supabase Google provider.

**Authorized JavaScript origins** (match the Vite dev port **8080**):
- `http://localhost:8080`
- `http://127.0.0.1:8080`
- `https://<your-production-domain>` (when deployed)
- `https://teamfair.vercel.app` (current production site)

**Authorized redirect URIs** (OAuth code returns to **Supabase**, not your app origin):
- `https://<project-ref>.supabase.co/auth/v1/callback`  
  Use the same host as `VITE_SUPABASE_URL`.

**Supabase Dashboard → Authentication → URL configuration**
- **Site URL:** e.g. `http://localhost:8080` for local dev.
- **Redirect URLs:** include `http://localhost:8080/**` (and production URLs) so OAuth can return to paths such as `/login?role=...`.

## Supabase database migrations
SQL migrations live under [supabase/migrations](../../supabase/migrations/). Apply them to your hosted (or local) Postgres via the Supabase SQL editor, `supabase db push`, or your team’s migration workflow.

Order matters; examples in this repo:
1. `20260512120000_teamfair_core.sql` - enums, `public.users` (extends `auth.users`), groups, members, tasks, logs, AI evaluations, auth sync triggers, RLS enabled, grants.
2. `20260515100000_teamfair_rls.sql` - RLS policies (lecturer / student / admin scoping).
3. `20260516100000_users_profile_completed_and_signup_role.sql` - `profile_completed`, updated `handle_new_user`, `set_signup_role` RPC for Google sign-up role selection.
4. `20260517120000_persist_dashboard_state.sql` - persisted dashboard metadata and UI tables for task approval/deadline/priority/evidence, activity logs, student reports, materials, lecturer scores, lecturer-student reviews, and verified badges.
5. `20260519120000_chat_messages.sql` - chat history table for the AI assistant sidebar, scoped by `(user_id, group_id)` with RLS so users only read/write their own messages.
6. `20260520120000_security_hardening.sql` - database trigger and check constraints to reinforce role validation.
7. `20260522120000_persistent_calendar.sql` - calendar_events table to persist student calendar scheduling.
8. `20260522130000_notifications_schema.sql` - notifications table with RLS to support the custom Mail notification system.
9. `20260523120000_project_management_rls.sql` - relaxed RLS policies for groups insertion/selection/modification and joining project groups.
10. `20260525120000_security_rls_fixes.sql` - security hardening RLS migration containing fixes for calendar access, notifications forge vulnerabilities, and lecturer project view/escalation bugs.


Enable **Email** and **Google** under **Authentication → Providers** in Supabase to match the login UI.

### Simple deploy checklist
1. Run every SQL migration above in Supabase, in order, if the database does not already have them.
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to Vercel project environment variables.
3. Push the code to GitHub.
4. Let Vercel redeploy from GitHub.

If the SQL migration is skipped, Vercel can still render the app, but real logged-in dashboard data may fail to load/save because the database tables/columns are missing.

## Verification History

### 2026-05-27 Automated Verification & Quality Assurance Run
- **Type**: Verification / QA Audit
- **Files Modified**: None (verification check)
- **Summary of Changes**:
  - Executed Vitest test suite (`npm run test -- --run`) against local codebase.
  - Ran production build (`npm run build`) to ensure clean compilation and verify zero bundling or TypeScript errors.
  - Performed project lint check (`npm run lint`) to audit code style and quality.
- **Manual Verification Details**:
  - **Vitest Run**: 7 out of 7 tests passed successfully (duration 1.86s).
    - `src/test/example.test.ts` (1 test passed)
    - `src/test/session4.test.ts` (3 tests passed)
    - `src/lib/teamPersistence.test.ts` (3 tests passed)
  - **Vite Build**: Compiled client environment for production cleanly with zero errors in 4.82 seconds.
    - Generated `dist/index.html` (2.02 kB)
    - Generated `dist/assets/index-DT4GjIDL.css` (90.84 kB)
    - Generated `dist/assets/index-Baobqgqi.js` (1,207.20 kB)
  - **ESLint**: Completed successfully with 0 errors and 16 React Fast Refresh/useMemo warnings on Shadcn UI components.

