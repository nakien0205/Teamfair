## 1. Applied the CI/CD upgrades

Changed:
- Expanded [ci.yml](d:/Python/Projects/Teamfair/.github/workflows/ci.yml:1) into two jobs:
  - `Frontend Quality`: pnpm install, secret validation, `pnpm typecheck`, lint, tests, build.
  - `Python Agent Smoke Test`: install Python agent deps, compile package, import/check health handler.
- Added [codeql.yml](d:/Python/Projects/Teamfair/.github/workflows/codeql.yml:1) for JS/TS CodeQL scanning.
- Added [dependabot.yml](d:/Python/Projects/Teamfair/.github/dependabot.yml:1) for weekly npm/pnpm and GitHub Actions updates.
- Added `typecheck` script in [package.json](d:/Python/Projects/Teamfair/package.json:10).
- Removed stale `package-lock.json` and `bun.lockb`; added them to [.gitignore](d:/Python/Projects/Teamfair/.gitignore:221).
- Updated [setup-ci-pipeline.md](d:/Python/Projects/Teamfair/docs/tech_stack/setup-ci-pipeline.md:1).


## 2. Integrate PostHog product analytics into the Teamfair React SPA

Added [src/lib/analytics.ts](D:/Python/Projects/Teamfair/src/lib/analytics.ts:1) with production-only PostHog init, SPA pageview capture, guarded `identify`, `capture`, and `reset`. Wired it through [src/main.tsx](D:/Python/Projects/Teamfair/src/main.tsx:1), [src/context/AuthContext.tsx](D:/Python/Projects/Teamfair/src/context/AuthContext.tsx:1), [src/context/TeamContext.tsx](D:/Python/Projects/Teamfair/src/context/TeamContext.tsx:1), and both AI chat surfaces.

Tracked events now include task creation/status changes, report submission, material upload, group creation/join request/join, AI chat sends, and badge awards. Added `posthog-js`, [.env.example](D:/Python/Projects/Teamfair/.env.example:1), guide updates, and the completion log at [docs/tech_stack/setup-analytics.md](D:/Python/Projects/Teamfair/docs/tech_stack/setup-analytics.md:1).


## 3. Implemented the Supabase Realtime

Main changes:
- Added realtime publication migration: [20260604130000_enable_realtime.sql](D:/Python/Projects/Teamfair/supabase/migrations/20260604130000_enable_realtime.sql:1)
- Added reusable hook: [useRealtimeSubscription.ts](D:/Python/Projects/Teamfair/src/hooks/useRealtimeSubscription.ts:36)
- Added duplicate-safe notification state helpers: [notificationState.ts](D:/Python/Projects/Teamfair/src/lib/notificationState.ts:30)
- Wired live notification insert/update/delete handling: [NotificationContext.tsx](D:/Python/Projects/Teamfair/src/context/NotificationContext.tsx:87)
- Wired active-project dashboard realtime invalidation/debounced refreshes: [TeamContext.tsx](D:/Python/Projects/Teamfair/src/context/TeamContext.tsx:567)
- Added tests for hook behavior and notification state merging.


## 4. Implemented the Supabase Storage plan

What changed:
- Added `supabase/migrations/20260604120000_storage_buckets.sql` for private `materials` and `evidence` buckets, limits, MIME rules, storage RLS, and material delete RLS.
- Added `src/lib/storage.ts` for validation, sanitization, uploads, signed URLs, and best-effort deletes.
- Extended `TeamContext`, `teamPersistence`, and `workspaceSnapshot` to carry optional storage metadata while preserving legacy metadata-only rows.
- Updated `MaterialsSection` for real upload/download/delete behavior.
- Updated `KanbanBoard` for real evidence upload/download, with evidence deletion left out as requested.
- Added tests in `src/lib/storage.test.ts` and expanded `teamPersistence.test.ts`.
- Added `docs/tech_stack/setup-supabase-storage.md` and updated the relevant guides.


## 5. Implemented the sensitive API-layer pass.

Key changes:
- Added Supabase Edge Functions under [supabase/functions](D:/Python/Projects/Teamfair/supabase/functions): shared CORS/auth/rate-limit/response helpers, `team-api`, and restored `delete-user-auth`.
- Added [src/lib/teamApi.ts](D:/Python/Projects/Teamfair/src/lib/teamApi.ts) plus tests for API response handling, invite normalization, and contribution scoring.
- Routed sensitive persistence calls in [src/lib/teamPersistence.ts](D:/Python/Projects/Teamfair/src/lib/teamPersistence.ts) through `team-api`: invite management/joining, join request processing, report submission, lecturer evaluation/badge awarding, and task approval.
- Updated [src/context/TeamContext.tsx](D:/Python/Projects/Teamfair/src/context/TeamContext.tsx) so invite join no longer double-inserts members or creates join requests client-side.
- Added [20260604140000_api_layer_invite_security.sql](D:/Python/Projects/Teamfair/supabase/migrations/20260604140000_api_layer_invite_security.sql) to tighten invite visibility and add service-only atomic invite consumption/approval helpers.
- Updated docs in [state_and_data.md](D:/Python/Projects/Teamfair/docs/guides/state_and_data.md), [how_to_run.md](D:/Python/Projects/Teamfair/docs/guides/how_to_run.md), and [setup-api-layer.md](D:/Python/Projects/Teamfair/docs/tech_stack/setup-api-layer.md).
