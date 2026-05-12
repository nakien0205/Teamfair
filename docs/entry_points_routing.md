See [index.md](index.md) for the docs routing map.

## Entry points and routing
- [index.html](index.html) - root HTML, mounts `#root` and loads the main bundle.
- [src/main.tsx](src/main.tsx) - React root with `createRoot`.
- [src/App.tsx](src/App.tsx) - app providers + routing.
- [src/pages/Index.tsx](src/pages/Index.tsx) - redirect to `/` (utility page).

Routes defined in [src/App.tsx](src/App.tsx):
- `/` -> [src/pages/Landing.tsx](src/pages/Landing.tsx)
- `/start` -> [src/pages/RoleSelection.tsx](src/pages/RoleSelection.tsx)
- `/login` -> [src/pages/Login.tsx](src/pages/Login.tsx)
- `/dashboard-student` -> [src/pages/StudentDashboard.tsx](src/pages/StudentDashboard.tsx)
- `/dashboard-lecturer` -> [src/pages/LecturerDashboard.tsx](src/pages/LecturerDashboard.tsx)
- `*` -> [src/pages/NotFound.tsx](src/pages/NotFound.tsx)