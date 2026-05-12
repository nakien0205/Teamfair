See [index.md](index.md) for the docs routing map.

## Entry points and routing
- [index.html](../../index.html) - root HTML, mounts `#root` and loads the main bundle.
- [src/main.tsx](../../src/main.tsx) - React root with `createRoot`.
- [src/App.tsx](../../src/App.tsx) - app providers + routing.

Provider nesting in [src/App.tsx](../../src/App.tsx) (outer to inner):
1. `QueryClientProvider`
2. `TooltipProvider`
3. `LanguageProvider`
4. `AuthProvider` ([src/context/AuthContext.tsx](../../src/context/AuthContext.tsx)) - Supabase session + `public.users` profile
5. `TeamProvider` - in-memory demo team data
6. `BrowserRouter` + `Routes`

Routes defined in [src/App.tsx](../../src/App.tsx):
- `/` -> [src/pages/Landing.tsx](../../src/pages/Landing.tsx)
- `/start` -> [src/pages/RoleSelection.tsx](../../src/pages/RoleSelection.tsx)
- `/login` -> [src/pages/Login.tsx](../../src/pages/Login.tsx) - Google OAuth, email sign-in / sign-up, demo shortcuts; query `?role=student` or `?role=lecturer` selects intended app role for new accounts / OAuth flow.
- `/dashboard-student` -> wrapped in [src/components/ProtectedRoute.tsx](../../src/components/ProtectedRoute.tsx) -> [src/pages/StudentDashboard.tsx](../../src/pages/StudentDashboard.tsx)
- `/dashboard-lecturer` -> `ProtectedRoute` -> [src/pages/LecturerDashboard.tsx](../../src/pages/LecturerDashboard.tsx)
- `*` -> [src/pages/NotFound.tsx](../../src/pages/NotFound.tsx)

**Protected dashboards:** When `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set, unauthenticated users (without demo session) hitting dashboard routes are redirected to `/login`. When env vars are absent, dashboards stay accessible for local UI work without a backend.

Utility:
- [src/pages/Index.tsx](../../src/pages/Index.tsx) - redirect helper (not mounted on the main route table above).
