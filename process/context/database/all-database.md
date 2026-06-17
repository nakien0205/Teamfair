# Database Context

This file is the canonical Database context entrypoint for Teamfair.

Use it after `process/context/all-context.md` when the task needs database schema definitions, queries, or migrations.

---

## Scope

This group covers:
- PostgreSQL schemas, RLS (Row Level Security) policies, triggers, and onboarding functions under `supabase/migrations/`.
- Supabase BaaS connection config and API library integrations.
- Key data entities (Users, Project/Groups, Tasks, Calendar Events, Rubrics, Grades, Messages).

It does not cover:
- Client-side application state (Zundstand stores).
- Auth UI screens (belongs in auth/ group).

## Read When

Read this entrypoint when:
- Creating or editing PostgreSQL schemas or migration scripts.
- Debugging RLS policy issues or database access restrictions.
- Fetching data using the Supabase Client SDK in React pages.

## Source Paths

- `supabase/migrations/`
- `src/lib/supabaseClient.ts`
- `src/lib/rubricPersistence.ts`

## Update Triggers

Update this group when:
- New database tables or columns are introduced.
- RLS policies or DB functions are revised.
