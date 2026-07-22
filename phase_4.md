# Phase 4 — Private Google Calendar Read Overlay

**TL;DR:** Add a server-authorized, owner-private, read-only Google Calendar overlay to Teamfair Global Calendar. Cursor/cache state stays server-only, provider failures preserve local Teamfair calendar data, and no live Google call is used as automated proof in this phase.

**Program**: `google-calendar-integration`
**Umbrella plan**: `process/features/project_management/active/google-calendar-integration_22-07-26/google-calendar-integration-umbrella_PLAN_22-07-26.md`
**Frozen SPEC**: `process/features/project_management/active/google-calendar-integration_22-07-26/google-calendar-integration_SPEC_22-07-26.md`
**Date**: 22-07-26
**Complexity**: COMPLEX phase inside a five-phase program
**Status**: ⏳ PLANNED — fresh Phase 4 RESEARCH and PVL pending
**Report destination**: `process/features/project_management/active/google-calendar-integration_22-07-26/phase-04-private-google-read-overlay_REPORT_22-07-26.md`

## Context Envelope

| Field | Value |
|---|---|
| `feature` | `project_management` |
| `phase` | `PLAN` |
| `session-goal` | Specify Phase 4 private owner-only Google read overlay without implementing it. |
| `branch` | `feature_blocking` |
| `worktree` | `D:/Python/Projects/Teamfair` |
| `context-group` | `planning`, `tests`, `database`, `auth`, `uxui` |
| `blast-radius-packages` | `src/pages`, `src/components`, `src/lib`, `supabase/functions`, `supabase/migrations` |
| `active-plan` | `process/features/project_management/active/google-calendar-integration_22-07-26/phase-04-private-google-read-overlay_PLAN_22-07-26.md` |
| `test-runner` | `pnpm test | pnpm typecheck | pnpm lint | pnpm build` |
| `validate-contract` | `none — outer PVL pending` |

## Overview

Phase 4 adds Google-owned events beside existing viewer-filtered Teamfair tasks in Global Calendar. The browser requests only a bounded visible date range. The signed-in owner identity, current account-scoped Pro Group entitlement, active Google connection, connection generation, credentials, provider pagination, sync token, cache writes, and retry decisions remain server-side.

The overlay is not a second shared Teamfair calendar. It never reads from, writes to, or joins `public.calendar_events`. It uses private, owner-keyed cache rows and returns only the minimal read projection needed to render the current calendar range.

## Phase Completion Rules

A phase is not complete until:

1. Integration tests show server, cache, client wrapper, component, and Global Calendar compose correctly.
2. Manual tests show the owner can open, refresh, understand stale/error states, and use keyboard/screen-reader controls.
3. Data verification confirms cache/cursor isolation, generation cleanup, minimal stored fields, and no shared `calendar_events` coupling.
4. Error tests confirm 401/403 denial, entitlement/connection failure, page failure, rate limit, timeout, HTTP 410 recovery, disconnect races, and stale cache behavior.
5. User confirmation records that the read-only overlay and unchanged local calendar behavior match expectations.

Status meanings:

- ⏳ PLANNED — not started.
- 🔨 CODE DONE — written but not independently verified.
- 🧪 TESTING — gates are running.
- ✅ VERIFIED — phase gates, regression gates, evidence pack, and user confirmation are recorded.
- 🚧 BLOCKED — a real prerequisite or proof gap prevents safe progress.

## Purpose

- Show the signed-in connected owner's Google events in Global Calendar on open, visible-month navigation, and manual refresh.
- Keep imported events private and read-only.
- Preserve the existing Teamfair task visibility rule exactly.
- Prevent a Teamfair-owned Google task copy from appearing beside the same Teamfair task.
- Preserve local Teamfair calendars for free users and during all Google failures.
- Make disconnect/reconnect, invalid sync token, pagination, partial provider failure, and stale cache behavior deterministic.

## Goals and Success Metrics

- Zero response fields outside the approved minimal event projection and sanitized overlay status.
- Zero accepted request fields that select an owner, connection generation, credential, or sync token.
- Zero reads/writes/joins between private Google overlay storage and `public.calendar_events`.
- One bounded full retry after HTTP 410; no recursive resync.
- No partial page-chain commit and no cursor advance on failed provider or database work.
- No Teamfair edit/delete control attached to an imported Google event.
- All carried SPEC criteria AC4, AC6, AC12–AC14, and AC16–AC20 have bidirectional named proof.

## Scope

### In scope

- Private owner/range/generation cache and sync-cursor persistence.
- Service-role-only atomic cache replace/delta/clear database functions.
- Disconnect/generation-change purge trigger for Phase 4 data.
- Authenticated Edge Function read/refresh handler.
- Dependency-injected Google `events.list` adapter using `primary`, pagination, incremental sync, and HTTP 410 recovery.
- Minimal typed browser client.
- Read-only accessible Google event rendering in Global Calendar.
- Open, navigation, and manual refresh; loading, refreshing, empty, stale, retryable, upgrade, and reconnect states.
- Server-side filtering of Phase 3 Teamfair-owned task copies.
- Deterministic unit/component/security-contract tests with mocked provider transport.
- High-risk evidence pack under `harness/phase-04/`.

### Out of scope

- OAuth consent, token encryption, token rotation, owner connection controls, or provider revocation; Phase 2 owns them.
- Task-to-Google create/update/delete or marker ownership; Phase 3 owns them.
- Any browser edit/delete of Google-owned events.
- Multiple Google accounts, non-primary calendars, or shared access to Google events.
- Changes to `public.calendar_events` or existing Teamfair task visibility semantics.
- Live Google provider calls, production deployment, secret mutation, real billing, or destructive live migration.
- Release claims based on real Google pagination, revocation, quota, or HTTP 410; controlled proof belongs to Phase 5.

## Entry Gate and Dependencies

- Phase 1 is VERIFIED and supplies `supabase/functions/_shared/billing.ts`, including server-authoritative `hasProGroupFeatures(plan)` and corrected Pro Group price `79_000`.
- Phase 2 is VERIFIED and supplies:
  - `public.google_calendar_connections` with `owner_id`, safe state, `opted_in`, and `connection_generation`;
  - encrypted credentials in `private.google_calendar_credentials`;
  - `supabase/functions/_shared/google-calendar/credentials.ts` for server-only credential access;
  - disconnect behavior that retains the connection row, increments generation, disables opt-in, and deletes credentials.
- Phase 3 ownership-marker contract is available through read-only `supabase/functions/_shared/googleCalendarEventOwnership.ts`.
- Phase 3 marker helper recognizes `extendedProperties.private.teamfair_source === "task"`; Phase 4 imports the helper and does not duplicate marker literals.
- Phase 3 provider-ID feasibility result is available before Phase 4 treats the helper as stable.
- `process/context/all-context.md`, `process/context/tests/all-tests.md`, auth/database/UX routers, prior phase reports, umbrella, frozen SPEC, and registry are re-read during Phase 4 RESEARCH.
- Outer or inner PVL writes a non-placeholder validate-contract before EXECUTE.

## Coordination Strategy

### Seven-signal score

| Signal | Result | Evidence |
|---|---|---|
| S1 — 3+ workspace packages | No | Two runtime roots: React `src/` and Supabase `supabase/`; process artifacts are coordination, not a runtime package. |
| S2 — schema/API/auth surface | Yes | New private storage, server endpoint, JWT owner derivation, entitlement, and connection-generation gates. |
| S3 — 3+ viable work directions | Yes | DB/cache, provider adapter, request handler, UI/accessibility, and tests must converge. |
| S4 — phase program | Yes | Phase 4 of five. |
| S5 — user requests depth | Yes | Full complex plan, privacy invariants, state machine, evidence pack, and test tiers required. |
| S6 — high-risk class | Yes | Auth, billing entitlement, private data, public server contract, external provider. |
| S7 — 5+ files | Yes | Eleven source/test files plus plan/report/evidence. |

**Score:** 6/7 — HIGH.

| Strategy | Agent count / cost | Assessment |
|---|---|---|
| Sequential | 1 phase agent | Cheap, but DB/API/UI privacy assumptions can drift before integration. |
| Parallel subagents | 4–5 isolated agents | Fast, but independent agents cannot negotiate handler/cache/UI contract changes while working. |
| Workflow | 1 deterministic pipeline | Strong for ordered gates after contracts are fixed; weak for cross-specialist design negotiation. |
| Agent team | 4 named specialists + coordinator | Selected. Private API/cache/auth/UI/accessibility need shared contracts and mid-task coordination. |

**Selected execution strategy:** agent team. During EXECUTE, name API/cache, authorization/security, UI/accessibility, and test/evidence roles. Coordinator owns contract consistency. Cost guard: one four-member round; no recursive fan-out without a new strategy check.

## Architecture Decisions

### AD-04-01 — Dedicated server endpoint and private storage

- Use `google-calendar-overlay` as a dedicated Edge Function.
- Store cache/cursor rows in `private` schema, separate from `public.calendar_events`.
- Browser never accesses overlay tables directly.
- Public security-definer database functions are executable only by `service_role`; `PUBLIC`, `anon`, and `authenticated` receive no execute grant.

Reason: shared group-calendar tables have broader visibility and write semantics incompatible with owner-private Google data.

### AD-04-02 — Server-owned cursor and visible-range windows

- Request accepts only `rangeStart`, `rangeEndExclusive`, and `reason` (`open`, `navigate`, `manual`).
- Handler validates ISO dates, `end > start`, and range length at most 42 days.
- Owner ID comes from the session JWT. Client cannot submit `userId`, `ownerId`, `connectionGeneration`, `syncToken`, `pageToken`, or `forceFull`.
- Cursor is keyed by `(owner_id, connection_generation, range_start, range_end_exclusive)`.
- Browser never receives `syncToken` or `nextSyncToken`.

Reason: visible-month windows bound recurrence expansion and payload size while preserving incremental refresh for each visited calendar grid.

### AD-04-03 — Bounded provider pagination and HTTP 410 recovery

- Provider adapter calls Calendar API v3 `events.list` for `calendarId=primary`.
- Initial full request uses visible range, `singleEvents=true`, and `showDeleted=false`.
- Incremental request uses stored server sync token and processes cancelled/deleted entries as removals.
- Each page follows `nextPageToken`; only final page supplies the stored `nextSyncToken`.
- Fixed guardrails: 250 events/page, 20 pages, 5,000 processed records, and 10-second timeout per page request.
- Limit/timeout/page failure aborts the refresh without cursor advance or partial cache commit.
- HTTP 410 clears only that owner's current generation/range cache and cursor, then retries one full sync once. A second failure becomes retryable; no recursion.

Verified documentation basis: Google documents page-token iteration, final-page `nextSyncToken`, deleted entries in incremental results, and HTTP 410 as the signal to clear the local event store and perform full sync.

### AD-04-04 — Atomic compare-and-swap cache updates

- Full results replace one owner/generation/range atomically.
- Incremental results apply upserts/deletions and cursor change atomically.
- Apply functions receive the expected prior sync-token digest or row version.
- A concurrent refresh that advances first causes stale apply to return conflict; handler reloads the current owner cache rather than overwriting it.
- Entitlement, connection status, opt-in, and generation are checked before provider access and again before commit/response.

Reason: provider fetch happens outside a DB transaction; compare-and-swap prevents stale or post-disconnect data from being committed.

### AD-04-05 — Minimal cache and response

Stored event fields:

- `owner_id`, `connection_generation`, range key;
- `provider_event_id`;
- `title`;
- timed `start_at`/`end_at` or all-day `start_date`/`end_date`;
- `all_day`;
- `cached_at`.

Never store or return attendees, attendee email, description, location, conference data, organizer, HTML link, refresh token, access token, sync token, provider error body, or Phase 3 task marker. Teamfair-owned task copies are filtered before persistence.

### AD-04-06 — Stale cache is explicit and generation-safe

- Successful provider refresh returns `ready`.
- Temporary provider failure may return same-generation cached events as `stale` only when last successful refresh is at most 30 days old.
- Older cache is pruned and not shown; response becomes `retryable_error` with no Google events.
- Stale state always shows `refreshedAt` and an accessible retry action.
- Disconnect/status-generation trigger deletes all Phase 4 window/event rows for the owner.
- Reconnect uses the new generation, so old cache/cursor cannot reappear.

### AD-04-07 — Overlay rendering stays separate from Teamfair task rendering

- Existing `isTaskVisibleToViewer` filtering runs unchanged before local Teamfair task rendering.
- Google events use a distinct read-only view model and never open Teamfair task detail/edit/delete UI.
- Provider events marked by Phase 3 helper as Teamfair task copies are omitted server-side.
- Local Teamfair task cards render regardless of Google entitlement, connection, loading, or failure state.

## Data Flow

1. User opens Global Calendar or changes visible month; page computes a canonical grid range of at most 42 days.
2. `src/lib/googleCalendarOverlay.ts` invokes `google-calendar-overlay` through the existing signed-in Supabase client.
3. Edge Function derives owner from JWT; request cannot choose another user.
4. Handler checks current server-side Pro Group benefit, connection status, opt-in, and generation.
5. Handler reads only that owner/generation/range cursor and cache through service-role-only RPC.
6. Phase 2 credential helper supplies provider access server-side after the caller rechecks entitlement and generation.
7. Provider adapter calls `primary`, follows all pages, maps all-day/timed boundaries, applies cancelled deletions, and filters Phase 3 Teamfair task markers.
8. HTTP 410 clears only the current owner/generation/range and triggers one full retry. Any other provider failure preserves current cache/cursor.
9. Before commit, handler rechecks entitlement, connection, opt-in, and generation. Changed state discards fetched data.
10. Atomic RPC replaces or applies delta rows and advances cursor only after the full page chain succeeds.
11. Handler returns only minimal events plus sanitized refresh state.
12. UI merges local Teamfair task cards and read-only Google cards by date for display only. No DB join occurs.

## Public Contracts

### Edge Function request

`POST /functions/v1/google-calendar-overlay`

| Field | Type | Rule |
|---|---|---|
| `rangeStart` | `YYYY-MM-DD` string | Inclusive visible-grid start. |
| `rangeEndExclusive` | `YYYY-MM-DD` string | Exclusive end; after start; maximum 42 days. |
| `reason` | `open \| navigate \| manual` | Telemetry-safe enum; no private data. |

Unknown fields are rejected. Owner identity and cursor state are never accepted from body/query parameters.

### Minimal browser event

| Field | Type | Rule |
|---|---|---|
| `providerEventId` | string | Opaque Google event ID used only as React/data key. |
| `title` | string | Empty/missing summary maps to localized `Untitled event`; length capped server-side. |
| `start` | `{ date: string } \| { dateTime: string }` | Exactly one variant. |
| `end` | `{ date: string } \| { dateTime: string }` | Same variant as `start`; all-day end remains exclusive. |
| `allDay` | boolean | Derived server-side. |
| `readOnly` | literal `true` | Cannot be overridden. |
| `source` | literal `google` | Distinguishes overlay card from Teamfair task. |

### Response union

| State | Events | Metadata | UI meaning |
|---|---|---|---|
| `ready` | Current minimal events | `refreshedAt`, `stale:false` | Provider refresh committed. |
| `stale` | Same-generation cache only | `refreshedAt`, `stale:true`, optional bounded `retryAfterSeconds` | Provider failed; data is explicitly old and retryable. |
| `upgrade_required` | Empty | `refreshedAt:null`, `stale:false` | Signed-in owner lacks active benefit; local calendar stays available. |
| `reconnect_required` | Empty | `refreshedAt:null`, `stale:false` | Own connection/credential/opt-in is unavailable; no detailed state disclosed. |
| `retryable_error` | Empty | `refreshedAt:null`, `stale:false`, optional bounded `retryAfterSeconds` | No valid cache; local calendar stays available. |

Missing/invalid session uses the shared non-sensitive 401 error. No endpoint accepts an assignee/task-creator target or reveals whether another user is connected/subscribed.

### Database contracts

- `private.google_calendar_overlay_windows` — one cursor/version row per owner, connection generation, and range.
- `private.google_calendar_overlay_events` — minimal cached projection keyed by owner, generation, range, and provider event ID.
- `public.read_google_calendar_overlay_window(...)` — service-role-only read.
- `public.replace_google_calendar_overlay_window(...)` — atomic full replace and cursor write.
- `public.apply_google_calendar_overlay_delta(...)` — atomic upsert/delete and cursor compare-and-swap.
- `public.clear_google_calendar_overlay_state(...)` — service-role-only owner/generation/range clear.
- `private.purge_google_calendar_overlay_on_connection_change()` — trigger function that deletes all Phase 4 rows when Phase 2 connection status becomes inactive or generation changes.

Names and signatures above are fixed for EXECUTE. PVL may reject them only if an already-landed prerequisite uses a conflicting name; any replacement must preserve semantics and be written into the validate-contract before code work.

## Privacy and Security Invariants

1. Owner ID is derived from verified JWT and is never caller-selectable.
2. Entitlement is checked server-side from current account subscription truth; client `PremiumGate` is display-only.
3. Connection, opt-in, credential, generation, and cache rows must all match the same owner.
4. Credential and sync token never cross the server boundary.
5. Provider response is filtered and minimized before storage and response.
6. Shared `public.calendar_events` is never read, joined, or written by Phase 4.
7. Task creator cannot query, infer, or force assignee connection/subscription/overlay state.
8. Disconnect or generation change invalidates in-flight work before commit and response.
9. Stale cache is restricted to current connection generation and 30-day freshness.
10. Logs contain correlation ID, safe state/error code, page count, duration, and event count only; no title, event ID, token, sync token, provider body, or Google account identity.
11. Rate limit, page limit, record limit, and timeout prevent unbounded provider/DB work.
12. Imported Google events expose no Teamfair mutation action.

## Refresh State Machine

| Current state | Event | Guard/action | Next state |
|---|---|---|---|
| `idle` | Calendar opens/navigates | Keep local tasks visible; call owner endpoint. | `loading` |
| `idle` | Manual refresh | Same as open; focus stays on button. | `loading` |
| `ready` | Manual/open/navigation refresh | Keep current Google cards visible; mark controls busy. | `refreshing` |
| `loading/refreshing` | Duplicate trigger | Reuse latest request ID; disable manual button; stale completion cannot win. | unchanged |
| `loading/refreshing` | Provider success + commit | Replace visible Google events atomically. | `ready` |
| `loading/refreshing` | HTTP 410 | Clear only current owner/generation/range; one full retry. | `loading/refreshing` |
| `loading/refreshing` | Retry succeeds | Commit full cache/cursor. | `ready` |
| `loading/refreshing` | Temporary failure + valid cache | Preserve local tasks and same-generation cache; announce timestamp/retry. | `stale` |
| `loading/refreshing` | Temporary failure + no valid cache | Preserve local tasks; show retry action. | `retryable_error` |
| any | Entitlement absent/expired | Drop Google UI data only; no provider fetch. | `upgrade_required` |
| any | Disconnected/revoked/no credential | Drop Google UI data only; no provider fetch. | `reconnect_required` |
| any | Owner/generation changes during request | Discard result; purge server state; clear client overlay. | `reconnect_required` |
| any | Component unmount/user leaves tab | Abort/ignore result; local calendar state remains. | `idle` |

## UI and Accessibility States

- Google overlay section has a visible heading and `aria-labelledby` relationship.
- Manual button accessible name: `Refresh Google Calendar`; disabled only while active request is current.
- Loading/refreshing container sets `aria-busy=true` without hiding local Teamfair task cards.
- Success/empty/stale update uses `role=status` and `aria-live=polite`.
- Retryable, upgrade, and reconnect messages use concise copy; actionable errors use `role=alert` without provider details.
- Stale state names last successful refresh time and keeps a keyboard-operable retry button.
- Google cards include visible and screen-reader `Google Calendar · Read-only` source text.
- Google cards are non-interactive content; no edit/delete button, task modal, click mutation, context menu, or drag behavior.
- Timed events render using browser locale from server RFC3339 offset. All-day events preserve Google exclusive end-date semantics.
- Month navigation triggers a new bounded range refresh; local Teamfair tasks render first and remain stable.
- Upgrade state does not wrap or disable the existing local calendar. It gates only the Google overlay panel.

## Touchpoints

### Phase 4 owned source and tests

- `supabase/migrations/20260722400000_google_calendar_read_overlay.sql`
- `supabase/functions/google-calendar-overlay/index.ts`
- `supabase/functions/google-calendar-overlay/handler.ts`
- `supabase/functions/google-calendar-overlay/provider.ts`
- `src/lib/googleCalendarOverlay.ts`
- `src/lib/googleCalendarOverlay.test.ts`
- `src/lib/googleCalendarOverlaySecurity.test.ts`
- `src/components/GoogleCalendarOverlay.tsx`
- `src/components/GoogleCalendarOverlay.test.tsx`
- `src/pages/ProjectManagement.tsx`
- `src/pages/ProjectManagement.test.tsx`

### Read-only prerequisite and regression inputs

- `supabase/functions/_shared/billing.ts` — Phase 1 owner.
- `supabase/migrations/20260722200000_google_calendar_connection_credentials.sql` — Phase 2 owner.
- `supabase/functions/_shared/google-calendar/credentials.ts` — Phase 2 owner.
- `supabase/functions/_shared/googleCalendarEventOwnership.ts` — Phase 3 owner.
- `src/lib/taskVisibility.ts`
- `src/lib/taskVisibility.test.ts`
- `src/context/EntitlementContext.tsx`
- `src/components/PremiumGate.tsx`
- `src/lib/billing.ts`
- `src/lib/supabaseClient.ts`
- `supabase/functions/_shared/auth.ts`
- `supabase/functions/_shared/responses.ts`
- `supabase/migrations/20260522120000_persistent_calendar.sql`

If an earlier prerequisite legitimately owns a required write to `ProjectManagement.tsx` or its test, earliest prerequisite ownership wins. Phase 4 must rebase its integration on that contract and must not overwrite it.

## Blast Radius

**Risk class:** HIGH.

- Auth/identity — JWT-derived owner and missing-session denial.
- Billing entitlement — current account-scoped Pro Group gate.
- Schema/private data — cached private titles and server-only cursor.
- Public API/external contract — new browser-to-Edge-Function response union and Google API mapping.
- Permission/secret/trust boundary — service-role functions, encrypted credential helper, no browser tokens.
- UI privacy/accessibility — private read-only rendering beside shared Teamfair tasks.

No Phase 4 write is authorized outside the owned list. No source edit begins before PVL and explicit EXECUTE consent.

## Security Review — STRIDE

| Threat | Severity | Locked mitigation | Proving gate |
|---|---|---|---|
| Spoof owner through request body | Critical | Reject unknown/owner fields; derive owner only from `requireAuthUser`. | `calendar-server-authorization-denial-matrix` |
| Reuse cache after disconnect/reconnect | Critical | Generation-keyed cache, purge trigger, pre/post-fetch generation recheck. | `disconnect-revokes-access-and-clears-state` |
| Read another user's cached event | Critical | Server-only tables/RPCs; owner from JWT; no target owner API. | `google-calendar-cross-user-isolation` |
| Leak refresh/sync token or private provider body | Critical | Minimal response type, static exposure audit, sanitized logging. | `refresh-token-browser-exposure-audit` |
| Partial pagination corrupts cache/cursor | High | Buffer full page chain; atomic compare-and-swap apply; no cursor advance on failure. | `google-temporary-failure-recovery` |
| Retry/StrictMode storm | High | Endpoint rate limit, request dedupe, bounded pages/timeout, disabled refresh. | provider and UI concurrency cases |
| Phase 3 task copy shown twice | High | Import Phase 3 marker type guard and filter before storage. | `global-calendar-private-read-only-refresh` |
| Entitlement ends during fetch | High | Recheck entitlement before commit/response; discard result. | entitlement matrix |
| Logs reveal private title/account | High | Safe counters/codes only; static log audit. | browser-exposure audit |

## Risk Predictions

**vc-predict verdict:** CAUTION — viable only with owner derivation, generation recheck, atomic page-chain apply, and explicit stale semantics.

| Persona | Main concern | Resolution locked in plan |
|---|---|---|
| Architect | Provider fetch is outside DB transaction; concurrent refresh can overwrite newer cursor. | Compare-and-swap apply RPC and reload-on-conflict. |
| Security | Service role could turn a client owner field into cross-user disclosure. | No owner field in request; handler dependency receives verified user ID only. |
| Performance | Recurring expansion/full history can be unbounded. | Canonical 42-day window, page/record/time caps, per-window cursor. |
| UX/accessibility | Error/upgrade overlay could hide free local calendar or leave stale data looking fresh. | Separate overlay panel, local tasks always render, stale timestamp and live-region status. |
| Devil's advocate | Shared `calendar_events` reuse is simpler but breaks privacy and read-only semantics. | Dedicated private cache; no shared-table join. |

Historical constraints from current repo:

- `ProjectManagement.tsx` is actively modified in the dirty worktree; preserve and integrate around current changes.
- Existing Global Calendar tests prove current month/today and stable assignee-ID filtering for student, leader, admin, and lecturer.
- Current billing code still contains 69,000 VND and must not be treated as Phase 4 truth; Phase 1 owns the 79,000 correction.
- Existing `billing_plan_for_user(uuid)` is caller-targetable and MUST NOT authorize the overlay. Phase 4 may call only the Phase 1 helper that resolves the authenticated owner internally; it never submits an arbitrary user UUID.
- Existing CORS permits a missing `Origin`, so CORS is transport policy, not identity proof. The pure handler authorization matrix must prove verified JWT ownership independently of CORS.
- Existing shared auth has no dedicated unit test, and the Redis rate limiter fails closed with HTTP 429 when unconfigured. Phase 4 handler tests must inject auth/rate-limit outcomes and distinguish authorization denial from safe retry/rate-limit behavior.
- Current test infrastructure is Vitest/jsdom only. It proves rendered/contract behavior, not a live Google or deployed Supabase boundary.

## High-Risk Evidence Pack

Before Phase 4 can be finalized or handed off as VERIFIED, EXECUTE/EVL must create and validate:

- `harness/phase-04/risk-gate.json`
- `harness/phase-04/context-snippets.json`
- `harness/phase-04/verification.json`
- `harness/phase-04/review-decision.json`
- `harness/phase-04/adversarial-validation.json`

Pack requirements:

- Risk classes: auth/identity, billing entitlement, schema/private data, public API, external provider, permission/secret boundary.
- Context snippets cover every owned source file and the consumed Phase 1–3 contracts with exact line citations.
- Verification contains happy path plus missing auth, free owner, wrong/stale generation, provider page failure, 410, disconnect race, token exposure, duplicate filter, and local-calendar regression results.
- Reviewer records explicit APPROVE or REJECT with rationale.
- Adversarial scenarios include forged owner, stale cache replay, service-role misuse, response over-fetch, and post-disconnect in-flight commit.
- Missing pack or missing explicit approval blocks VERIFIED status.

## High-Risk Scenarios

| # | Dimension | Scenario | Severity | Required behavior |
|---|---|---|---|---|
| 1 | Authorization | Caller adds another `userId`, owner ID, or connection generation to request. | Critical | Reject unknown field; never query target user. |
| 2 | State transition | Disconnect increments generation while provider page 2 is in flight. | Critical | Post-fetch recheck discards data; purge remains authoritative. |
| 3 | Data integrity | Provider page 3 times out after pages 1–2 succeeded. | Critical | No partial event/cache/cursor commit. |
| 4 | Integration | Incremental token returns HTTP 410. | High | Clear only current owner/generation/range; one bounded full retry. |
| 5 | Timing | Open effect and rapid manual refresh overlap. | High | Latest request wins; atomic server apply remains idempotent. |
| 6 | Scale | More than 20 pages or 5,000 records. | High | Abort as retryable; retain valid same-generation cache. |
| 7 | Privacy | Same provider event exists in User A and User B caches. | Critical | Composite owner key and JWT scoping prevent cross-read. |
| 8 | Business logic | Free creator's task copy appears in eligible assignee provider feed. | High | Phase 3 marker filters copy; creator state remains unknown. |
| 9 | Environment | All-day event crosses DST or timed event has explicit offset. | High | Preserve date/exclusive end or RFC3339 instant; no midnight coercion. |
| 10 | Error cascade | DB apply fails after provider success. | High | Return stale/retryable, keep prior cursor/cache, no success claim. |
| 11 | Compliance | Provider error body includes event/account/token data. | Critical | Sanitize response and logs to safe code/counters only. |
| 12 | Accessibility | Screen reader user refreshes while local tasks remain visible. | Medium | Busy/live status announces result; focus stays usable; local tasks remain. |

## Acceptance Criteria

- **AC4 — Account-scoped entitlement:** Owner overlay works only with current server-authoritative Pro Group/Pro Max feature entitlement; ineligible owner sees upgrade state and local calendar.
  - proven by: `calendar-owner-pro-group-entitlement-matrix`
  - strategy: Fully-Automated
- **AC6 — Local calendars remain free:** Free owner can open/navigate Global Calendar and view filtered Teamfair tasks without Google connection.
  - proven by: `free-user-local-calendar-access`
  - strategy: Fully-Automated
- **AC12 — Private read-only display:** Owner open/navigation/manual refresh renders only that owner's Google events as read-only.
  - proven by: `global-calendar-private-read-only-refresh`
  - strategy: Fully-Automated
- **AC13 — No Teamfair editing of imported events:** Imported Google card has no edit/delete/task-modal mutation path.
  - proven by: `imported-google-event-has-no-write-actions`
  - strategy: Fully-Automated
- **AC14 — Disconnect cleanup:** Phase 2 disconnect generation/status change clears Phase 4 cursor/cache, stops reads, and clears client overlay. Provider revocation/token deletion remain Phase 2 proof.
  - proven by: `disconnect-revokes-access-and-clears-state`
  - strategy: Hybrid
- **AC16 — Server-enforced authorization:** Missing auth, inactive owner entitlement, inactive connection, stale generation, malformed range, and client owner override are rejected or safely gated server-side.
  - proven by: `calendar-server-authorization-denial-matrix`
  - strategy: Fully-Automated
- **AC17 — Refresh-token isolation:** Browser request/response/storage/error/log contracts contain no refresh/access/sync token.
  - proven by: `refresh-token-browser-exposure-audit`
  - strategy: Fully-Automated
- **AC18 — Credential failure:** Revoked/expired credential produces reconnect guidance while local calendar remains usable.
  - proven by: `google-consent-credential-failure-matrix`
  - strategy: Hybrid
- **AC19 — Temporary failure recovery:** Timeout, rate limit, provider error, page failure, DB failure, and HTTP 410 preserve local data; retry converges without partial/duplicate overlay rows.
  - proven by: `google-temporary-failure-recovery`
  - strategy: Fully-Automated
- **AC20 — Cross-user privacy:** Cross-user event/cache/status/credential access has no request surface and is denied without existence disclosure.
  - proven by: `google-calendar-cross-user-isolation`
  - strategy: Fully-Automated

## Test Coverage Plan

Test context source: `process/context/tests/all-tests.md`. It has no deeper downstream docs. Existing blast-radius tests discovered: `src/pages/ProjectManagement.test.tsx`, `src/lib/taskVisibility.test.ts`, `src/lib/billing.test.ts`, `src/lib/teamApi.test.ts`, and `src/lib/supabaseMigrationIntegrity.test.ts`. Exact runner: Vitest through `pnpm test`.

### Area — provider adapter and cache transition logic

| Tier | Scenario | Command / Steps | What it proves | What it does NOT prove |
|---|---|---|---|---|
| Fully-Automated | `provider-pagination-incremental-and-410` | `pnpm test src/lib/googleCalendarOverlay.test.ts` | All pages consumed, final token used, cancelled entries delete, Teamfair marker omitted, 410 performs one full retry, caps/timeouts fail safely. | Real Google payload/quota/revocation behavior. |
| Fully-Automated | `google-temporary-failure-recovery` | `pnpm test src/lib/googleCalendarOverlay.test.ts src/pages/ProjectManagement.test.tsx` | Page/timeout/429/5xx/apply failure preserves prior state and local tasks; retry converges. | Live provider recovery latency. |

Red-first requirement: create named failing tests `provider-pagination-incremental-and-410` and `google-temporary-failure-recovery` before provider implementation. Each test must fail because its asserted behavior is absent, not because of a syntax/import/configuration error.

### Area — server authorization, private storage, and response minimization

| Tier | Scenario | Command / Steps | What it proves | What it does NOT prove |
|---|---|---|---|---|
| Fully-Automated | `calendar-owner-pro-group-entitlement-matrix` | `pnpm test src/lib/googleCalendarOverlaySecurity.test.ts` | Server handler admits only current paid owner; client state cannot grant access. | Deployed subscription freshness. |
| Fully-Automated | `calendar-server-authorization-denial-matrix` | `pnpm test src/lib/googleCalendarOverlaySecurity.test.ts` | Missing auth, malformed/owner override input, inactive connection, stale generation, and entitlement denial fail closed. | Gateway/runtime configuration after deployment. |
| Fully-Automated | `refresh-token-browser-exposure-audit` | `pnpm test src/lib/googleCalendarOverlaySecurity.test.ts` | Source/response/log/schema contracts exclude credential and sync-token exposure; no shared table join. | Runtime packet capture against deployment. |
| Fully-Automated | `google-calendar-cross-user-isolation` | `pnpm test src/lib/googleCalendarOverlaySecurity.test.ts` | Handler/RPC source always scopes by verified owner and returns non-enumerating denial. | Live DB role grants until Phase 5 environment proof. |
| Hybrid | `disconnect-revokes-access-and-clears-state` | Precondition: Phase 2 VERIFIED artifacts. Run `pnpm test src/lib/googleCalendarOverlaySecurity.test.ts src/components/GoogleCalendarOverlay.test.tsx`; inspect Phase 2 report and Phase 4 migration trigger together. | Phase 2 disconnect generation/state contract causes Phase 4 purge and client clear. | Live Google revocation, which Phase 2/5 own. |
| Hybrid | `google-consent-credential-failure-matrix` | Precondition: Phase 2 credential helper contract landed. Run focused security/component tests with controlled revoked/expired dependency results. | Safe reconnect state and unchanged local calendar. | Actual provider revocation timing. |

Red-first requirement: create named failing tests `calendar-owner-pro-group-entitlement-matrix`, `calendar-server-authorization-denial-matrix`, `refresh-token-browser-exposure-audit`, and `google-calendar-cross-user-isolation` before server/storage implementation. Each must fail on the missing contract behavior while its test harness itself remains valid.

### Area — browser client, Global Calendar UI, and accessibility

| Tier | Scenario | Command / Steps | What it proves | What it does NOT prove |
|---|---|---|---|---|
| Fully-Automated | `global-calendar-private-read-only-refresh` | `pnpm test src/lib/googleCalendarOverlay.test.ts src/components/GoogleCalendarOverlay.test.tsx src/pages/ProjectManagement.test.tsx` | Open/navigation/manual refresh, owner event rendering, marker filtering, stale state, and minimal response mapping. | Real browser layout or provider data. |
| Fully-Automated | `imported-google-event-has-no-write-actions` | `pnpm test src/components/GoogleCalendarOverlay.test.tsx src/pages/ProjectManagement.test.tsx` | No edit/delete/task-modal/mutation action exists for Google cards. | Visual affordance quality in a real browser. |
| Fully-Automated | `free-user-local-calendar-access` | `pnpm test src/pages/ProjectManagement.test.tsx src/lib/taskVisibility.test.ts` | Free/reconnect/error states preserve existing local task visibility and month navigation. | Production account entitlement state. |
| Agent-Probe | `global-calendar-overlay-a11y-probe` | Open Global Calendar at desktop/mobile widths; keyboard through month controls and refresh; inspect screen-reader announcements for loading, stale, retry, upgrade, reconnect, and empty. | Human-visible clarity, focus behavior, responsive layout, and source/read-only affordance. | Server authorization or provider semantics. |

Red-first requirement: create named failing tests `global-calendar-private-read-only-refresh`, `imported-google-event-has-no-write-actions`, and `free-user-local-calendar-access` before browser/UI implementation. They must fail only on absent behavior and must preserve the existing task-visibility fixtures.

### Missing test areas

| Area | Why untestable in this phase | Resolution chosen |
|---|---|---|
| Real Google pagination, sync token, 410, rate limit, revocation | Requires controlled provider account and external calls; explicitly prohibited in Phase 4 automated tests. | Phase 5 controlled-provider Hybrid gate; Phase 4 uses deterministic injected transport and makes no live claim. |
| Deployed Supabase gateway/JWT/service-role grants | Local repo has no routed container/DB test command in `all-tests.md`. | Phase 5 deployment-fidelity evidence; Phase 4 static and handler gates remain required, not replaced. |
| Visual browser layout and screen-reader output | jsdom does not prove browser layout or assistive-technology behavior. | Required Agent-Probe before Phase 4 VERIFIED. |

No developed Phase 4 behavior is allowed to PASS on `Known-Gap`. External/deployment evidence above is a named program residual owned by Phase 5; Phase 4 green explicitly excludes those claims.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `calendar-owner-pro-group-entitlement-matrix` | Fully-Automated | AC4 |
| `free-user-local-calendar-access` | Fully-Automated | AC6 |
| `global-calendar-private-read-only-refresh` | Fully-Automated | AC12 |
| `imported-google-event-has-no-write-actions` | Fully-Automated | AC13 |
| `disconnect-revokes-access-and-clears-state` | Hybrid | AC14 |
| `calendar-server-authorization-denial-matrix` | Fully-Automated | AC16 |
| `refresh-token-browser-exposure-audit` | Fully-Automated | AC17 |
| `google-consent-credential-failure-matrix` | Hybrid | AC18 |
| `google-temporary-failure-recovery` | Fully-Automated | AC19 |
| `google-calendar-cross-user-isolation` | Fully-Automated | AC20 |
| `global-calendar-overlay-a11y-probe` | Agent-Probe | Supplemental AC12, AC13, AC18, AC19 UX evidence |
| Focused Phase 4 Vitest gate | Fully-Automated | AC4, AC6, AC12, AC13, AC16, AC17, AC19, AC20 |
| Full `pnpm test` regression | Fully-Automated | Existing Teamfair behavior plus Phase 4 automated scenarios |
| `pnpm typecheck`, `pnpm lint`, `pnpm build`, `git diff --check` | Fully-Automated | Typed/static/build integration; not provider or auth-runtime proof |

## Implementation Checklist

### A — Re-research and contract lock

- [ ] A1. Re-read frozen SPEC, umbrella, registry, Phase 1–3 plans/reports, and current dirty diffs for every owned/shared path; write any drift into an Inner Loop Refresh Note before PVL.
- [ ] A2. Confirm Phase 1 exact `hasProGroupFeatures` server helper, Phase 2 connection/credential/generation names, and Phase 3 marker helper exports; update imports only in this plan if prerequisite names changed.
- [ ] A3. Confirm `src/pages/ProjectManagement.tsx` and its test remain Phase 4-owned in registry; if earlier prerequisite ownership won, consume its contract without reverting it.

### B — Red-first provider and authorization seams

- [ ] B1. Add failing `provider-pagination-incremental-and-410` and `google-temporary-failure-recovery` scenarios to `src/lib/googleCalendarOverlay.test.ts` before provider code.
- [ ] B2. Add failing entitlement, authorization-denial, browser-exposure, cross-user, and disconnect-generation scenarios to `src/lib/googleCalendarOverlaySecurity.test.ts` before server/storage code.
- [ ] B3. Add failing open/manual/navigation, state, read-only, a11y, free-local-calendar, and duplicate-filter scenarios to component/page tests before UI code.

### C — Private persistence

- [ ] C1. Create `supabase/migrations/20260722400000_google_calendar_read_overlay.sql` with the two private owner/generation/range tables and only the minimal fields specified in AD-04-05.
- [ ] C2. Add fixed-search-path service-role-only read, full-replace, delta-apply, and clear functions with cursor/version compare-and-swap and no `anon`/`authenticated` grants.
- [ ] C3. Add connection status/generation trigger that purges Phase 4 rows on disconnect or generation change while leaving Phase 2 connection metadata intact.
- [ ] C4. Add 30-day stale-data pruning scoped to the same owner, plus indexes for owner/generation/range and provider event key.
- [ ] C5. Extend `src/lib/googleCalendarOverlaySecurity.test.ts` static checks to prove no `calendar_events` reference, no client grants, no credential columns, trigger cleanup, fixed search path, and service-role-only RPC grants.

### D — Provider adapter and handler

- [ ] D1. Implement `provider.ts` as a dependency-injected `fetch` adapter for `primary`, fixed range/full parameters, incremental token mode, page iteration, event/cancel mapping, Phase 3 marker filtering, caps, timeout, and sanitized typed errors.
- [ ] D2. Implement `handler.ts` as a pure dependency-injected request handler that rejects unknown fields, derives owner from verified auth dependency, validates range, checks entitlement/connection/opt-in/generation before provider access, and returns the fixed response union.
- [ ] D3. Implement handler HTTP 410 path as clear-current-window then one full retry; any second/provider/apply failure returns valid stale cache or retryable error without cursor advance.
- [ ] D4. Recheck entitlement/status/opt-in/generation after provider fetch and before atomic apply/response; discard any result from an invalidated connection.
- [ ] D5. Wire `index.ts` to existing CORS/auth/response helpers, Phase 1 billing helper, Phase 2 credential helper, Phase 3 marker helper, rate limiting, admin RPCs, and handler; log safe counters/codes only.
- [ ] D6. Make every provider/security test in B1–B2 green without network access or live credentials.

### E — Browser client and UI

- [ ] E1. Implement `src/lib/googleCalendarOverlay.ts` request/response types, strict response validation, Supabase `functions.invoke("google-calendar-overlay", { body })`, typed safe state mapping, and no token/cursor/owner fields.
- [ ] E2. Implement `GoogleCalendarOverlay.tsx` with fixed state machine, read-only Google cards, source labels, accessible busy/status/alert regions, manual refresh, stale timestamp, retry, upgrade, reconnect, and empty states.
- [ ] E3. Integrate the component into `ProjectManagement.tsx` Global Calendar, triggering refresh on tab open and visible month change while leaving `isTaskVisibleToViewer` and local task rendering unchanged.
- [ ] E4. Use request sequence/abort cleanup so stale responses cannot replace newer month, disconnect, or manual-refresh state.
- [ ] E5. Keep Teamfair task modal/click handlers attached only to Teamfair task cards; Google cards receive no mutation or task-detail callbacks.
- [ ] E6. Make component/page tests in B3 green, including free owner, provider failure, stale cache, cross-user/non-enumerating fixture, all-day/timed event, and Teamfair-copy omission.

### F — Verification and evidence

- [ ] F1. Run `pnpm test src/lib/googleCalendarOverlay.test.ts src/lib/googleCalendarOverlaySecurity.test.ts src/components/GoogleCalendarOverlay.test.tsx src/pages/ProjectManagement.test.tsx src/lib/taskVisibility.test.ts` until green.
- [ ] F2. Run `pnpm test`, then `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `git diff --check`; record exact results in Phase 4 report.
- [ ] F3. Run `global-calendar-overlay-a11y-probe` with keyboard, screen reader, desktop, and mobile viewport; capture redacted screenshots/notes without private event content.
- [ ] F4. Create and validate all five `harness/phase-04/` evidence artifacts; obtain explicit APPROVE/REJECT review decision.
- [ ] F5. Update Phase 4 report with SPEC receipts, failures, deviations, regression results, green boundary, and Phase 5 forward preview.

## Test Procedure

1. Run focused red/green provider, handler/security, component, page, and task-visibility tests.
2. Verify each security test uses injected provider/credential/DB dependencies; no real network call is possible.
3. Run full Vitest suite, typecheck, lint, production build, and diff check.
4. Inspect generated/source contracts for forbidden response fields, shared-table coupling, public grants, and sensitive logs.
5. Run accessibility Agent-Probe with synthetic event titles only; verify focus, live announcements, read-only labels, and local-calendar continuity.
6. Validate risk pack and obtain explicit review decision.
7. Ask user to confirm visible behavior before promoting to VERIFIED.

## Exit Gate

```powershell
pnpm test src/lib/googleCalendarOverlay.test.ts src/lib/googleCalendarOverlaySecurity.test.ts src/components/GoogleCalendarOverlay.test.tsx src/pages/ProjectManagement.test.tsx src/lib/taskVisibility.test.ts
pnpm test
pnpm typecheck
pnpm lint
pnpm build
git diff --check
node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs process/features/project_management/active/google-calendar-integration_22-07-26/phase-04-private-google-read-overlay_PLAN_22-07-26.md
node .claude/skills/vc-generate-phase-program/scripts/validate-phase-stub.mjs process/features/project_management/active/google-calendar-integration_22-07-26/phase-04-private-google-read-overlay_PLAN_22-07-26.md
```

Expected:

- Focused and full tests exit 0.
- Typecheck, lint, build, and diff check exit 0.
- Both plan validators have zero failures.
- Accessibility probe passes or Phase 4 remains TESTING/BLOCKED.
- Risk pack has five complete artifacts and explicit APPROVE.
- Report exists at exact destination.
- User confirms overlay is private/read-only and local calendar remains available.

## What Green Proves

- Browser cannot select owner or see token/cursor fields by contract.
- Server handler gates current owner entitlement, connection, opt-in, generation, and range.
- Mocked provider page chains, incremental deltas, cancelled events, HTTP 410, caps, and failures follow the locked state machine.
- Private storage migration is structurally owner/generation/range scoped, service-role only, purgeable, and separate from `calendar_events`.
- Existing viewer-only Teamfair task filtering remains green.
- Imported cards are read-only, accessible, and do not block free local calendar use.
- Disconnect-generation and stale-cache paths are covered by prerequisite-integrated tests and evidence.

## What Green Does Not Prove

- Real Google OAuth, primary-calendar targeting, quota, pagination volume, nextSyncToken behavior, HTTP 410, revocation, or reconnect.
- Deployed Supabase gateway JWT settings, database grants/RLS, Edge Function secrets, or production billing state.
- Production deployment, real provider latency, or live private event confidentiality.
- Full program AC1–AC20 completion.

Those proofs belong to Phase 5 controlled, explicitly authorized evidence. Phase 4 must not claim them from mocks or static checks.

## Failure Modes and Rollback

| Failure | Safe behavior | Rollback/recovery |
|---|---|---|
| Migration/RPC defect | Do not deploy; local calendar code remains independent. | Revert only Phase 4 migration/source before release; no live destructive action. |
| Provider outage/rate limit/timeout | Keep local tasks; serve valid stale owner cache or retryable empty overlay. | Retry later; cursor remains unchanged. |
| Partial page chain | No commit and no cursor advance. | Retry same stored token. |
| HTTP 410 | Clear current owner/generation/range only; one full retry. | If full retry fails, return retryable/stale; never clear local Teamfair data. |
| DB apply conflict | Reload current owner cache; do not overwrite newer cursor. | Retry from current cursor on next refresh. |
| Disconnect/entitlement change mid-fetch | Discard fetched data and clear overlay. | Reconnect/new generation starts clean. |
| Cross-user/credential/token exposure finding | Stop release and reject evidence pack. | Purge test cache/credentials, fix boundary, rerun all security gates. |
| UI regression | Disable/remove Google overlay integration only. | Existing Teamfair calendar remains available because data/rendering paths stay separate. |

## Phase Loop Progress

Orchestrator reads this before routing. Canonical inner loop skips SPEC because frozen program SPEC already governs the phase.

- [ ] 1. RESEARCH — prior phase reports read; context/test routers loaded; source drift and prerequisite contracts checked.
- [ ] 2. INNOVATE — approach and four-part Decision Summary refreshed for current prerequisite truth.
- [ ] 3. PLAN-SUPPLEMENT — this plan updated with inner-loop findings; Inner Loop Refresh Note written if sections change, or `n/a — research clean` recorded.
- [ ] 4. PVL — full V1–V7 complete; non-placeholder validate-contract written.
- [ ] 5. EXECUTE — all checklist sections complete; per-section gates green.
- [ ] 6. EVL — all independent gates, regression checks, evidence pack, and EVL HANDOFF SUMMARY complete.
- [ ] 7. UPDATE PROCESS — report finalized, durable context updated where warranted, phase archived/handed off; commit only if user explicitly requests it.

**Validate-contract required before execute.** Placeholder, missing, or partial contract blocks EXECUTE.

## Report Stub Contract

Execution writes evidence into the already-created report destination. Minimum report sections:

- status and exact selected plan;
- prerequisite contract versions read;
- commands and results;
- SPEC AC4, AC6, AC12–AC14, AC16–AC20 receipts;
- provider/live proof explicitly not run;
- high-risk evidence-pack decision;
- deviations and rollback status;
- regression result for task visibility/local calendar;
- what green proves/does not prove;
- Phase 5 forward preview.

## Test Infra Improvement Notes

- Vitest includes only `src/**/*.{test,spec}.{ts,tsx}`. Phase 4 server tests therefore import pure dependency-injected modules or statically inspect owned Supabase source from `src/lib/*test.ts`; `index.ts` remains a thin runtime wire-up.
- No routed local Supabase/container test command exists in `process/context/tests/all-tests.md`; do not invent one during EXECUTE. Phase 5 must add/authorize deployment-fidelity proof before release.
- jsdom cannot prove real browser layout, screen-reader behavior, or live provider semantics; required Agent-Probe and Phase 5 Hybrid evidence close those boundaries.
- No Known-Gap may be used as a passing strategy for developed Phase 4 behavior.

## Resume and Execution Handoff

- Primary execute-anchor plan: `process/features/project_management/active/google-calendar-integration_22-07-26/phase-04-private-google-read-overlay_PLAN_22-07-26.md`.
- Supporting phase files: none. Phase 1–3 plans/reports are read-only prerequisites and must be passed explicitly as context, never treated as alternate execute anchors.
- Selected plan file path: `process/features/project_management/active/google-calendar-integration_22-07-26/phase-04-private-google-read-overlay_PLAN_22-07-26.md`.
- Last completed step: outer PLAN artifact drafted; no implementation.
- Validate-contract status: pending outer PVL; placeholder below.
- Supporting context loaded: `process/context/all-context.md`, planning/tests/database/auth/uxui routers, development protocols, phase-program/plan/test skills, frozen SPEC, umbrella, registry, completed calendar personalization report, current Global Calendar/task visibility/billing/Supabase patterns, and Google/Supabase documentation.
- Prerequisite source contracts: Phase 1 billing helper; Phase 2 connection/credential/generation; Phase 3 event ownership helper.
- Fresh agent next step: run Phase 4 RESEARCH after Phases 1–3 are VERIFIED, read their full latest reports, then perform INNOVATE and PLAN-SUPPLEMENT before PVL.
- EXECUTE receives this exact plan path only. Do not hand it the whole program folder.
- No commit, deployment, live provider call, real billing event, secret mutation, or destructive live migration is authorized.
- If `ProjectManagement.tsx` ownership changed, stop and resolve registry ownership before editing.

## Validate Contract

(placeholder — vc-validate-agent writes this section before EXECUTE)

## Next Step

Run outer PVL for this exact phase plan. After program Phase 0 validation, Phase 1 enters RESEARCH first; Phase 4 must wait for Phases 1–3 and then re-run RESEARCH before any EXECUTE handoff.
