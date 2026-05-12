# Project Structure (Teamfair)

See [index.md](index.md) for the docs routing map.

This document is a map of the codebase and the main files you will likely touch first.

## How to run (from package.json)
- `npm run dev` - start Vite dev server (port 8080)
- `npm run build` - production build
- `npm run build:dev` - development build mode
- `npm run preview` - preview production build
- `npm run lint` - ESLint
- `npm run test` - Vitest run once
- `npm run test:watch` - Vitest watch

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

## State, data, and i18n (in-memory demo)
- [src/context/TeamContext.tsx](src/context/TeamContext.tsx) - in-memory demo data for groups, tasks, members, activity log, reports, materials, lecturer reviews, and verified badges. All core mutations live here.
- [src/context/LanguageContext.tsx](src/context/LanguageContext.tsx) - language toggle (`vi` / `en`).
- [src/lib/i18n.ts](src/lib/i18n.ts) - dictionary and helpers `t()` / `tr()`.
- [src/hooks/use-toast.ts](src/hooks/use-toast.ts) - toast store and `useToast()`.
- [src/hooks/use-mobile.tsx](src/hooks/use-mobile.tsx) - breakpoint helper used by the sidebar system.

Notes:
- There is no backend integration yet; data is stored in React context and reset on refresh.
- AI behaviors are simulated with timers (see student and lecturer dashboards, plus the AI chat widget).

## Pages (top-level views)
- [src/pages/Landing.tsx](src/pages/Landing.tsx) - marketing/hero landing page with language switcher.
- [src/pages/RoleSelection.tsx](src/pages/RoleSelection.tsx) - select student vs lecturer.
- [src/pages/Login.tsx](src/pages/Login.tsx) - demo login and role-based redirect.
- [src/pages/StudentDashboard.tsx](src/pages/StudentDashboard.tsx) - student workspace with tasks, calendar, evaluation, materials, badges, and activity log.
- [src/pages/LecturerDashboard.tsx](src/pages/LecturerDashboard.tsx) - lecturer workspace with group overview, reports, rubric, evaluations, exports, materials, and activity log.
- [src/pages/NotFound.tsx](src/pages/NotFound.tsx) - 404 view.

## Core layout and navigation
- [src/components/DashboardShell.tsx](src/components/DashboardShell.tsx) - shared layout with sidebar rail + header + content area.
- [src/components/DashboardSidebar.tsx](src/components/DashboardSidebar.tsx) - left nav, groups items into primary/secondary, handles mobile collapse.
- [src/components/DashboardHeader.tsx](src/components/DashboardHeader.tsx) - top bar, role switcher, language switcher, exit action.
- [src/components/DashboardTabs.tsx](src/components/DashboardTabs.tsx) - tab switcher used for local section navigation.

## Student workspace feature map
Primary entry: [src/pages/StudentDashboard.tsx](src/pages/StudentDashboard.tsx)
- Task work and status flow
  - [src/components/KanbanBoard.tsx](src/components/KanbanBoard.tsx) - drag and drop Kanban, evidence uploads.
- Calendar and timeline
  - [src/components/ProjectCalendar.tsx](src/components/ProjectCalendar.tsx) - month/week views, event creation, task deadline sync.
- Contribution and fairness
  - [src/components/ContributionAnalytics.tsx](src/components/ContributionAnalytics.tsx) - charts, score card, warnings.
  - [src/components/StudentReportModal.tsx](src/components/StudentReportModal.tsx) - report a member to lecturer.
  - [src/components/feature-groups/AIChatWidget.tsx](src/components/feature-groups/AIChatWidget.tsx) - guided help and summaries.
- Materials
  - [src/components/MaterialsSection.tsx](src/components/MaterialsSection.tsx) - upload and list materials (student view).
- Verified badges
  - [src/components/feature-groups/VerifiedBadgesSection.tsx](src/components/feature-groups/VerifiedBadgesSection.tsx) - show awarded badges.

## Lecturer workspace feature map
Primary entry: [src/pages/LecturerDashboard.tsx](src/pages/LecturerDashboard.tsx)
- Group overview and analytics
  - [src/components/ContributionAnalytics.tsx](src/components/ContributionAnalytics.tsx)
- Reports and rubric
  - [src/components/LecturerReports.tsx](src/components/LecturerReports.tsx) - student reports and review actions.
  - [src/components/RubricManager.tsx](src/components/RubricManager.tsx) - rubric upload and grading UI.
- Lecturer student review and badges
  - [src/components/feature-groups/LecturerStudentEvaluationPanel.tsx](src/components/feature-groups/LecturerStudentEvaluationPanel.tsx)
- Export and materials
  - [src/components/ExportReport.tsx](src/components/ExportReport.tsx) - CSV/XLS export demo.
  - [src/components/MaterialsSection.tsx](src/components/MaterialsSection.tsx) - upload and delete materials (lecturer view).

## Shared feature components
- [src/components/LanguageSwitcherButton.tsx](src/components/LanguageSwitcherButton.tsx) - language toggle button used in header and pages.
- [src/components/NavLink.tsx](src/components/NavLink.tsx) - wrapper around `react-router-dom` `NavLink`.

## UI primitives (shadcn + Radix)
- [src/components/ui](src/components/ui) - shared UI primitives and wrappers. Examples include:
  - Buttons, inputs, dialogs, selects, toasts, tabs, sidebar, table, etc.
  - Most app UI is composed from these primitives.

## Styling and themes
- [src/index.css](src/index.css) - Tailwind layers, CSS variables, fonts, gradients, and utility classes.
- [tailwind.config.ts](tailwind.config.ts) - theme tokens and color system.
- [postcss.config.js](postcss.config.js) - Tailwind + autoprefixer.
- [src/App.css](src/App.css) - Vite starter styles (currently not imported by default).

## Tooling and configuration
- [package.json](package.json) - scripts and dependencies.
- [vite.config.ts](vite.config.ts) - Vite config, React SWC plugin, path alias `@` -> `src`, dev server port 8080.
- [eslint.config.js](eslint.config.js) - ESLint setup for TS/React.
- [tsconfig.json](tsconfig.json) - base TS config and path aliases.
- [tsconfig.app.json](tsconfig.app.json) - app TS config.
- [tsconfig.node.json](tsconfig.node.json) - Vite config TS settings.
- [vitest.config.ts](vitest.config.ts) - Vitest setup.
- [components.json](components.json) - shadcn UI configuration.

## Tests
- [src/test/example.test.ts](src/test/example.test.ts) - example test.
- [src/test/setup.ts](src/test/setup.ts) - test setup and `matchMedia` mock.

## Public assets
- [public/robots.txt](public/robots.txt) - crawler rules.

## Generated output
- `dist/` - build output (generated by Vite).
- `node_modules/` - dependencies.
