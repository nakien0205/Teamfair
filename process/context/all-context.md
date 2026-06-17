# Teamfair - All Context

Last updated: 2026-06-17

This file is the root context entrypoint for the repo.

Use it for two things:
1. quick routing to the right context pack or root file
2. broad architecture and repository understanding

Start here before loading deeper context files.

---

## Quick Start

For most substantial tasks:
1. read this file first
2. choose the smallest relevant root file or context group from the tables below
3. only then load deeper files

---

## Current Root Entry Points

| File | Read when |
|---|---|
| `process/context/all-context.md` | any substantial planning, research, review, or implementation task |
| `process/context/tests/all-tests.md` | testing, verification, debugging test failures, execution planning |
| `process/context/planning/all-planning.md` | plan-shape calibration, planning examples, SIMPLE vs COMPLEX reference docs |
| `process/context/uxui/all-uxui.md` | UI/UX styling, shadcn components, Tailwind config, GSAP animations |
| `process/context/database/all-database.md` | Supabase DB tables, schemas, migrations, RLS policies, query patterns |
| `process/context/auth/all-auth.md` | authentication flows, protected routes, session handling |

## Current Context Groups

| Group | Entry point | Scope |
|---|---|---|
| `planning/` | `process/context/planning/all-planning.md` | plan-shape calibration, planning examples, SIMPLE vs COMPLEX reference docs |
| `tests/` | `process/context/tests/all-tests.md` | test runners, commands, debugging, gaps |
| `uxui/` | `process/context/uxui/all-uxui.md` | UI component library, design tokens, styling approach, durable design conventions |
| `database/` | `process/context/database/all-database.md` | Supabase Postgres schema, migration workflow, RLS rules, and onboarding RPCs |
| `auth/` | `process/context/auth/all-auth.md` | Supabase session client, AuthContext, role mapping, role-based onboarding |

## Task Routing Table

| If the task involves... | Start with | Then load |
|---|---|---|
| general repo research | `all-context.md` | the relevant group or feature guide |
| implementation planning | `all-context.md`, `planning/all-planning.md` | the relevant PRD example or feature active plan |
| testing or verification | `all-context.md`, `tests/all-tests.md` | the specific testing files |
| UI/UX work | `all-context.md`, `uxui/all-uxui.md` | canonical UI references plus feature guide |
| database work | `all-context.md`, `database/all-database.md` | migration files or schemas in `supabase/migrations/` |
| auth work | `all-context.md`, `auth/all-auth.md` | `src/context/AuthContext.tsx` or RLS triggers |
| context maintenance | `all-context.md` | run `audit-context` after edits |

## Context Group Lifecycle

Context groups are durable knowledge domains, not feature folders.

Create a group when:
- a topic has 3+ durable docs
- a single doc exceeds roughly 800 lines with separable subtopics
- multiple agents repeatedly need only one slice of a large context file
- the topic maps to a stable operational domain (tests, infra, database, auth, UI, workflows, etc.)

Do not create a group when:
- the content is a temporary report
- the content is a plan or execution artifact
- the topic is feature-specific and belongs in `process/features/...`

Move or split one group at a time. Use `all-{group}.md` entrypoints. Run the `audit-context` skill after every context organization change.

## Naming Convention

There are no `README.md` files inside `process/context/`.

Canonical entrypoints use `all-*.md`:
- root: `process/context/all-context.md`
- group: `process/context/{group}/all-{group}.md`

Each `all-{group}.md` file should act as the attachable quick router for that domain:
- tell the agent what the group covers
- give quick procedures and decision rules
- route to smaller deeper files

## Context Update Protocol

When durable project knowledge changes:
1. update the smallest relevant context file
2. update this file if routing, ownership, naming, or groups changed
3. update the owning `all-{group}.md` entrypoint when a group exists
4. run `audit-context`

---

## Repository Structure

```
Teamfair/
  .claude/          -- Claude Code config, hooks, and local skills
  .codex/           -- Codex agent configs and hooks
  backend/          -- Optional backend service stub
  docs/             -- EdTech platform documentation and guides
  public/           -- Static assets for the frontend
  python/           -- Dockerized AI student workspace agent (FastAPI server + OpenRouter tools)
  src/              -- Frontend React application
    components/     -- UI components (including Kanban, Calendar, Analytics)
    context/        -- Auth, Team, Notification React Contexts
    hooks/          -- Custom React hooks
    layouts/        -- StudentLayout, LecturerLayout shells
    lib/            -- Client logic (Supabase, persistence, parser)
    pages/          -- Top-level routes/pages (student, lecturer, landing, login)
    test/           -- Vitest unit tests and setup configs
  supabase/         -- Supabase migrations, RLS rules, functions, and config
  process/          -- Implementation plans, feature backlog, context docs, and development protocols
```

## Technology Stack

- **Frontend Framework:** React 18.3 (with Vite 7.3 bundler)
- **Client Routing:** React Router Dom 6.30
- **Language:** TypeScript 5.8
- **Styling:** Tailwind CSS 3.4 + shadcn/ui (Radix UI primitives)
- **Animations:** GSAP 3.15 + `@gsap/react` 2.1
- **State Management:** Zustand 5.0 + React Query 5.8
- **Backend Platform:** Supabase BaaS (Postgres DB, RLS policies, Auth client, storage buckets)
- **AI Agent Integration:** OpenRouter + FastAPI/Python web server (agent server)
- **Testing:** Vitest 3.2 + jsdom 29.1
- **Error/Metrics Tracking:** Sentry 10.55 + PostHog 1.38

## Key Patterns and Conventions

- **Naming case:** `PascalCase` for classes (e.g., `class MyClass`) and `snake_case` for functions (e.g., `function get_user_data()`).
- **Coding convention:** `PEP 8` for Python code, and `Airbnb Style Guide` / `StandardJS` for JS/TS code.
- **Architectural guidelines:**
  - **Frontend:** Single-page app (SPA) modular layered architecture. Components are built on top of shadcn-ui primitives. State is managed locally/globally via Zustand and React Context.
  - **Backend:** Layered/N-Tier (frontend client calling PostgreSQL via Supabase SDK + Dockerized python service running an independent AI agent server communicating via APIs).
  - **Database Security:** Strict Row-Level Security (RLS) policies on all tables under Supabase, with onboarding guarded by database triggers/RPCs.
- **Import aliases:** `@/` maps to `src/` directory.

## Environment and Configuration

- **Supabase credentials:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `connection_string` (Postgres pooled connection string).
- **AI Agent integration:** `OPENROUTER_API_KEY` (OpenRouter API credentials).
- **Sentry DSN/Auth:** `VITE_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.
- **PostHog metrics:** `PERSONAL_API_KEY`, `VITE_POSTHOG_KEY`.

---

## Scan Metadata

- Generated: 2026-06-17T10:15:00Z
- Mode: fresh
- Package manager: pnpm
