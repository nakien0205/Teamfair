See [index.md](index.md) for the docs routing map.

## How to run (from package.json)
- `npm run dev` - start Vite dev server (**port 8080**; see [vite.config.ts](../../vite.config.ts))
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

Copy [.env.example](../../.env.example) to `.env` and fill in the values. If these are missing, auth UI shows a configuration message and dashboards still work via **demo mode** (see [state_and_data.md](state_and_data.md)).

**Do not** put the Google OAuth **client secret** in any `VITE_*` variable (it would be exposed in the client bundle). Configure Google under **Supabase Dashboard → Authentication → Providers → Google**.

## Google Cloud Console (Web OAuth client)
Use these when creating or editing the OAuth 2.0 **Web application** client that you attach to Supabase Google provider.

**Authorized JavaScript origins** (match the Vite dev port **8080**):
- `http://localhost:8080`
- `http://127.0.0.1:8080`
- `https://<your-production-domain>` (when deployed)

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

Enable **Email** and **Google** under **Authentication → Providers** in Supabase to match the login UI.
