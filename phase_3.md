# Phase 03 — Task-to-Google Write Sync

**Program:** google-calendar-integration
**Umbrella plan:** `process/features/project_management/active/google-calendar-integration_22-07-26/google-calendar-integration-umbrella_PLAN_22-07-26.md`
**Frozen SPEC:** `process/features/project_management/active/google-calendar-integration_22-07-26/google-calendar-integration_SPEC_22-07-26.md`
**Date**: 22-07-26
**Status**: ✅ VERIFIED
**Complexity**: COMPLEX phase-program phase
**Phase status:** ✅ VERIFIED
**Report destination:** `process/features/project_management/active/google-calendar-integration_22-07-26/phase-03-task-to-google-write-sync_REPORT_22-07-26.md`

## Overview

Build the server-side desired-state queue and worker that mirrors eligible Teamfair tasks into the assigned user's primary Google Calendar. Task writes stay local-first and never wait for Google. The worker proves idempotent create/update/delete behavior, strict owner isolation, entitlement and opt-in gating, bounded recovery, and a safe stop boundary around disconnect. Phase 3 consumes the stable task identity from Phase 1 and the credential/fencing contract from Phase 2; it does not edit either phase's files.

Planning context was routed from `process/context/all-context.md`, `process/context/tests/all-tests.md`, the database/auth context packs, the frozen SPEC, the umbrella plan, and the shared phase blast-radius registry.

## Goals

- Turn authoritative task mutations into coalesced server-side desired state without calling Google in the task transaction.
- Create, update, or remove exactly one Teamfair-owned all-day Google event for each eligible `(task_id, assignee_id)` pair.
- Make repeated delivery, worker concurrency, reconnect, provider timeouts, and ambiguous provider responses safe.
- Ensure free creators can assign tasks to entitled assignees without learning any assignee Google state.
- Preserve local task/calendar behavior when Google is slow, unavailable, disconnected, or temporarily blocked.
- Produce automated, hybrid-stub, and controlled-live evidence without claiming a live deployment from repository checks.

## Scope

### In scope

- Phase-3-owned migration, worker, provider adapter, ownership helper, contract tests, and risk evidence pack.
- Task insert/update/reassignment/deadline-removal/delete reconciliation.
- Opt-in, entitlement, connection-generation, and disconnect cleanup reactions through Phase-3-owned database triggers and worker preflight.
- Primary-calendar all-day events only.
- Provider retry classification, dead lettering, observability, compare-and-swap completion, and operation fencing.

### Out of scope

- OAuth consent, token encryption, token custody, connection UI, or disconnect endpoint implementation (Phase 2).
- Frontend task identity or billing-price changes (Phase 1).
- Reading or displaying arbitrary Google events (Phase 4).
- Multiple Google accounts, secondary calendars, attendee invitations, two-way editing, or Google-to-Teamfair task changes.
- Deleting provider events solely because a user disconnects; credential material is removed, and provider cleanup may no longer be possible.
- Any production migration, function deployment, secret change, or live Google write during normal automated validation.

## Entry Gate

- [ ] Phase 1 is `✅ VERIFIED`: persisted task IDs are database UUIDs end to end, and `billing_plan_for_user` reflects the canonical 79,000 VND Pro Group contract.
- [ ] Phase 2 is `✅ VERIFIED`: connection projection, encrypted credential retrieval, scope validation, retained generation, disconnect cleanup, and operation-fence RPCs are implemented and tested.
- [ ] Phase 2's exact write scope is verified to authorize insert/get/patch/delete on events owned by Teamfair; do not substitute a broader scope without PVL approval.
- [ ] A disposable Supabase/Postgres target and a local fake Google HTTP endpoint are available. If not, the hybrid gate stays CONDITIONAL and Phase 3 cannot become `✅ VERIFIED`.
- [ ] The selected plan has a completed `## Validate Contract`; a placeholder is not permission to execute.

## Locked Architecture

### Data flow

1. A normal Teamfair transaction inserts, updates, reassigns, removes the deadline from, or deletes a task.
2. A Phase-3 trigger computes affected `(task_id, owner_id)` pairs. It writes desired `upsert` or `delete` state in the same database transaction. It never reads credentials and never performs network I/O.
3. Connection/opt-in changes and subscription updates wake or reconcile rows. A 15-minute sweep covers time-based entitlement expiry and missed wakeups.
4. A scheduled worker claims at most 10 due rows with row locking and a 300-second row lease. Workers process claimed rows sequentially.
5. Immediately before any token or Calendar request, the worker rechecks authoritative task state, current assignee, current billing plan, connection status, explicit opt-in, required scopes, connection generation, and desired version.
6. The worker acquires one fresh Phase-2 owner operation lease for each external Google HTTP request. Token refresh and every Events insert/get/patch/delete each require their own single-use 30-second lease and generation recheck. Each request has a maximum 15-second deadline and releases its lease in `finally`; a disconnect between requests blocks the next acquire.
7. The provider adapter uses deterministic event identity and private ownership markers. Update/delete first fetches the event and verifies both source and task markers.
8. The worker completes with compare-and-swap against lease token and claimed desired version. A newer desired version is never acknowledged by an older attempt.
9. The worker releases the owner operation fence in `finally`, then records success, retry, pause, or dead letter through service-role-only RPCs.

### Desired-state table

`private.google_calendar_task_sync_desired` has one row per `(task_id, owner_id)` and no foreign key to `public.tasks`, so a delete tombstone survives task deletion. `owner_id` references the retained Phase-2 owner connection row with cascade only when that row is physically deleted.

| Column | Contract |
|---|---|
| `task_id uuid`, `owner_id uuid` | Composite primary key and isolation key. |
| `desired_operation text` | Check-constrained to `upsert` or `delete`. |
| `desired_version bigint` | Increments on every authoritative reconciliation. |
| `processed_version bigint` | Highest version successfully applied; never greater than desired version. |
| `task_title text`, `task_description text`, `task_deadline date` | Snapshot used only for `upsert`; delete tombstones may keep them null. |
| `available_at timestamptz` | Earliest claim time. |
| `attempt_count integer` | Counts retryable provider attempts only. Pauses do not consume attempts. |
| `last_error_code text`, `blocked_reason text` | Bounded safe codes; never token, provider body, task description, or email. |
| `lease_token uuid`, `leased_version bigint`, `leased_until timestamptz` | Claim/CAS state. A coalescing write does not clear a still-live lease. |
| `dead_lettered_at timestamptz` | Non-null only after permanent failure or exhausted retry budget. |
| `created_at`, `updated_at` | Audit timestamps. |

All table privileges are revoked from `PUBLIC`, `anon`, and `authenticated`. RLS is enabled and forced. Only service-role-owned trigger/RPC paths may mutate or inspect rows.

### Event mapping table

`private.google_calendar_task_event_mappings` is keyed by `(task_id, owner_id)` and has no task foreign key. It records `google_event_id`, `connection_generation`, `last_applied_version`, optional `etag`, and timestamps. It is a recovery index, not proof of ownership: the remote private marker must still match before patch/delete.

### Deterministic event contract

| Field | Exact value |
|---|---|
| Calendar | `primary` |
| Event ID | `tf` plus the lowercase task UUID with hyphens removed; 34 characters total. |
| Summary | Current Teamfair task title. |
| Description | Current Teamfair task description, or empty string when absent. |
| Start | `{ "date": task_deadline }` semantics. |
| End | Exclusive calendar date exactly one day after task deadline. |
| Private marker 1 | `teamfair_source=task` |
| Private marker 2 | `teamfair_task_id=<canonical hyphenated lowercase task UUID>` |
| Private marker 3 | `teamfair_schema=v1` |

No attendee, location, conference, reminder override, assignee email, group data, billing data, or connection state is sent. Phase 4 treats any event carrying `teamfair_source=task` as a local mirror and filters it from the imported overlay.

### Eligibility and lifecycle state machine

A task is eligible only when it exists, has a non-null assignee UUID, and has a non-null deadline. Completion status does not remove the event. The assigned user's current entitlement and opt-in are worker gates, not creator-side task-write gates.

| Input transition | Desired state |
|---|---|
| Eligible task inserted | `upsert` for current assignee. |
| Title, description, or deadline changed while eligible | Coalesce `upsert` for current assignee with incremented version. |
| Reassigned from A to B while eligible | `delete` for A and `upsert` for B in the same task transaction. |
| Assignee removed or deadline removed | `delete` for prior assignee. |
| Task deleted | `delete` for prior assignee; tombstone survives. |
| Assignee becomes opted in/connected/entitled | Reconcile all currently eligible assigned tasks to `upsert`. |
| Assignee opts out | Stop all provider activity and keep the latest desired state paused. Opt-out alone does not delete an already-created provider event. Opt-in later reconciles current state. |
| Entitlement lapses | Stop provider calls, retain desired state/mapping, mark paused, recheck by trigger and sweep. |
| Disconnect begins or completes | Generation fence stops new calls; Phase-3 trigger deletes owner queue/mapping rows after the Phase-2 disconnect transition. Remote events may remain. |
| Clean reconnect | Reconcile current eligible tasks. Deterministic IDs convert provider `409` into verified update, avoiding duplicates. |

### Claim and completion contracts

The migration exposes only service-role RPCs. Exact argument/return types must be validated against generated database types during PVL:

- `claim_google_calendar_task_sync_jobs(worker_id, batch_size, lease_seconds)` returns due rows plus a unique lease token and claimed desired version; it uses `FOR UPDATE SKIP LOCKED`, excludes live leases and dead letters, and caps batch size at 10.
- `complete_google_calendar_task_sync_job(task_id, owner_id, lease_token, claimed_version, google_event_id, etag)` advances processed version only when lease and version still match.
- `reschedule_google_calendar_task_sync_job(task_id, owner_id, lease_token, claimed_version, outcome_code, available_at, consume_attempt)` clears the lease and records a bounded retry/pause/dead-letter outcome only for the claimed version.
- `reconcile_google_calendar_tasks_for_owner(owner_id)` is trigger/service-role only and rebuilds desired rows from authoritative tasks without exposing another owner's state.

Every function sets an explicit safe `search_path`, revokes default execution, validates ranges, and grants only to `service_role`. Trigger-only helpers are not granted to client roles.

Phase 2 supplies these exact fence calls, which Phase 3 consumes without redefining them:

- `public.acquire_google_calendar_operation_lease(p_owner_id uuid, p_expected_generation bigint, p_operation_id uuid, p_purpose text, p_requested_ttl_seconds integer)` returns lease decision, denial code, current generation, expiry, and the encrypted credential envelope atomically. Phase 3 passes `task_event_write`, requests the Phase-2 maximum of 30 seconds, and performs no separate credential read.
- `public.release_google_calendar_operation_lease(p_owner_id uuid, p_operation_id uuid)` is called in `finally` and is idempotent.
- Each lease is single-use for exactly one external request and is never renewed or reused. Token refresh, primary Events request, 409/412 recovery GET, and follow-up PATCH each reacquire with a new operation UUID. If a sequence cannot finish within worker/runtime bounds, store only non-secret retry intent and resume later.
- Phase 2's `begin_google_calendar_disconnect`, `clear_google_calendar_disconnect_local_state`, and `finalize_google_calendar_disconnect` form the disconnect fence. Phase 3 observes the final `disconnected` transition to remove its private rows; it does not edit those RPCs.
- The connection row columns consumed by Phase 3 are `owner_id`, `status`, `opted_in`, `granted_scopes`, `connection_generation`, and safe `attention_code`. The credential envelope remains server-only.

### Retry and provider-result matrix

Retry delay is `min(3600 seconds, 30 seconds × 2^(attempt_count-1))` plus deterministic jitter in the range -20% to +20% derived from `(task_id, owner_id, desired_version, attempt_count)`. Eight retryable attempts exhaust the budget and dead-letter the row.

| Result | Required action |
|---|---|
| HTTP timeout, network failure, 5xx, 429, or rate-limit-specific 403 | Retry with bounded backoff. |
| 401 | Refresh once through Phase 2 while fence is held; retry request once. `invalid_grant` becomes paused attention, not a loop. |
| Non-rate 403 or invalid scope | Pause with safe attention code; no broad-scope fallback. |
| Provider 400 caused by permanent event payload error | Dead-letter immediately with safe code. |
| Insert 409 | Fetch deterministic ID; verify marker/task; patch if owned, otherwise dead-letter ownership conflict. |
| Update 404/410 | Insert deterministic ID and update mapping. |
| Delete 404/410 | Treat as success and remove mapping. |
| Update/delete 412 | Fetch, verify ownership, reapply once; if still conflicting, retry. |
| Marker missing or task marker differs | Never mutate; dead-letter `ownership_conflict`. |
| New desired version appears during provider call | Old completion CAS fails; newer row remains due. |
| Connection generation changes while fenced | Phase-2 fence prevents new call or invalidates completion; never retry with old credentials. |

## Public Contracts

- Task creation and editing remain Google-unaware. Their success/failure depends only on Teamfair persistence.
- A creator cannot query, enable, infer, or receive the assignee's Google connection, opt-in, scope, entitlement, queue, error, or event identifier.
- Only the authenticated assignee's owner-keyed credential and primary calendar may be used.
- Phase 3 imports Phase-2 credential and fence helpers read-only; it must not log or return access/refresh tokens.
- Phase 3 exports `googleCalendarEventOwnership.ts` for Phase 4 read-only use. It owns the event ID derivation, marker constants, marker validation, and minimal Teamfair-event predicate.
- Local Teamfair calendar persistence and rendering remain unchanged and free.
- Disconnect removes Phase-3 private queue/mapping data without promising retroactive provider deletion.
- A repository-green gate proves implementation behavior against controlled targets; it does not prove production deployment or a live Google tenant.

## Touchpoints

### Phase-3-owned writes

- `supabase/migrations/20260722300000_google_calendar_task_sync.sql`
- `supabase/functions/google-calendar-task-sync-worker/index.ts`
- `supabase/functions/google-calendar-task-sync-worker/sync.ts`
- `supabase/functions/google-calendar-task-sync-worker/provider.ts`
- `supabase/functions/_shared/googleCalendarEventOwnership.ts`
- `supabase/functions/tests/google_calendar_task_sync_worker_test.ts`
- `src/lib/googleCalendarTaskSyncMigration.test.ts`
- `src/lib/googleCalendarTaskSyncContract.test.ts`
- `src/lib/googleCalendarEventOwnershipContract.test.ts`
- `harness/phase-03/risk-gate.json`
- `harness/phase-03/context-snippets.json`
- `harness/phase-03/verification.json`
- `harness/phase-03/review-decision.json`
- `harness/phase-03/adversarial-validation.json`

### Read-only dependencies

- Phase 1: `src/context/TeamContext.tsx`, `src/lib/teamPersistence.ts`, their tests, task UI consumers, billing files, and canonical billing migration/function.
- Phase 2: connection migration/function, `_shared/google-calendar/credentials.ts`, `crypto.ts`, `oauth.ts`, and operation-fence contract.
- Existing task/RLS migrations, `src/lib/taskEmailPayload.ts`, `src/components/KanbanBoard.tsx`, `src/context/EntitlementContext.tsx`, and regression tests.
- Phase 4 consumes the ownership helper but retains all overlay and `ProjectManagement.tsx` ownership.

## Blast Radius

- Database: private queue/mapping tables; task, connection, and subscription observation triggers; service-role claim/completion/reconciliation RPCs; scheduled invocation configuration if the feasibility gate approves it.
- Runtime: one service-role Edge worker and one pure provider adapter.
- External: Google Calendar Events API on the consenting owner's primary calendar only.
- Privacy: task title/description/deadline cross the provider boundary only for the opted-in entitled assignee.
- Operational: retry/dead-letter state and scheduled execution can amplify provider traffic if bounds fail.
- Regression: task create/update/delete/reassignment, email notification payload, billing entitlement, OAuth disconnect, and Phase-4 filtering.
- No frontend source or Phase-1/2/4-owned file is writable in this phase.

## Dependency Ordering

1. Phase 1 must establish stable database task UUIDs; otherwise deterministic event identity is unsafe.
2. Phase 2 must establish owner connection, scopes, encrypted credential access, retained generation, and operation fencing; otherwise stop-after-disconnect cannot be proved.
3. Phase 3 creates the queue/worker and ownership marker.
4. Phase 4 imports the marker to filter Teamfair mirrors.
5. Phase 5 runs controlled-live and integrated adversarial validation.

No Phase-3 checklist item depends on a later phase's output. Controlled-live release proof is intentionally consumed by Phase 5, but Phase 3's stub/disposable-target exit gate must pass before Phase 4 begins.

## Execution Strategy

The Tier-0 strategy comparison considered all four supported choices:

| Strategy | Fit | Relative cost | Decision |
|---|---|---|---|
| Sequential | Strong dependency safety but poor for five-plan artifact creation. | 1.0× time, 1.0× coordination | Rejected for program creation; valid inside this worker's ordered implementation steps. |
| Parallel subagents | Fast file drafting but weak cross-phase ownership negotiation. | about 0.45× elapsed time, 1.2× review | Rejected for phase-program creation. |
| Workflow | Repeatable loop automation, but cannot negotiate shared marker/fence contracts by itself. | about 0.6× elapsed time plus setup | Reserved for later repeated validation. |
| Agent team | Phase owners coordinate marker, fence, evidence, and file ownership directly. | about 0.5× elapsed time, 1.35× coordination | Selected for plan creation. |

Phase 3's implementation itself should be sequential within one execute agent because schema, pure ownership helper, provider adapter, worker, and hybrid proof are dependency-ordered. Independent test execution may be parallelized only after files are stable and the validate-contract explicitly allows it.

## Feasibility Gates

| Gate | Probe | Pass condition | Failure action |
|---|---|---|---|
| F3-1 deterministic event ID | Use the fake adapter plus Google API contract test for `tf` + UUID hex. | Length/charset accepted and repeated insert returns duplicate semantics. | Change only the deterministic encoding in plan supplement; do not use provider-generated IDs. |
| F3-2 narrow owned-event scope | Execute a controlled test-account insert/get/patch/delete with the exact Phase-2 scope, or obtain equivalent official/API evidence accepted by PVL. | All required operations succeed without broad calendar scope. | Keep provider execution blocked; return to Phase 2 scope supplement. |
| F3-3 operation fence | Race worker preflight/provider call against disconnect in disposable DB/fake provider. | Disconnect waits for or invalidates the in-flight lease; no call starts after fence transition. | Phase 3 stays CONDITIONAL; repair Phase-2 contract before EXECUTE. |
| F3-4 queue scheduling | Prove the selected local scheduler can invoke the worker with a server secret and no browser credential. | One due row is claimed once and secret is not stored in public/client-visible schema. | Use an approved external scheduler; do not embed service key in migration text. |
| F3-5 Deno test runner | Run `deno --version` and the named worker test in the repository environment. | Supported Deno runtime and deterministic test command exist. | Treat Deno test as test-infra backlog and retain Vitest static contracts plus hybrid disposable gate. |

## Security Review

| STRIDE area | Threat | Required control |
|---|---|---|
| Spoofing | Creator or wrong user causes writes to an assignee calendar. | Owner derives from authoritative `tasks.assignee_id`; credential lookup and fence key by same owner; no client owner parameter. |
| Tampering | Mapping row points at an unrelated Google event. | Deterministic ID plus remote private marker verification before patch/delete; mismatch dead-letters. |
| Repudiation | Worker failures cannot be distinguished from user changes. | Safe outcome codes, desired/processed versions, attempt count, generation, and timestamps; no secret/body logging. |
| Information disclosure | Connection or task details leak across users or logs. | Private forced-RLS tables, service-role-only RPCs, minimal event fields, safe codes, owner-isolation probes. |
| Denial of service | Retry storm, long lease, or large reconciliation floods provider. | Batch 10, sequential processing, deterministic capped jitter, eight-attempt limit, bounded owner reconciliation, indexes, and 15-minute sweep. |
| Elevation of privilege | SECURITY DEFINER helper is callable by browser roles. | Explicit `search_path`, revoke default execute/table grants, service-role-only grants, contract tests over grants and RLS. |

Security stop condition: if the operation fence cannot prove no post-disconnect provider call, Phase 3 cannot be `✅ VERIFIED` and AC14/AC15/AC16 remain CONDITIONAL.

## Risk Predictions

The pre-implementation five-persona review predicts these failures:

1. **Security:** mapping-only ownership checks will eventually alter an unrelated event after reconnect or data corruption. Mitigation: fetch and validate private markers before every update/delete.
2. **Reliability:** at-least-once delivery plus timeout ambiguity will create duplicates. Mitigation: deterministic provider ID, insert-409 reconciliation, version CAS, and idempotent delete.
3. **Database:** task delete or reassignment can erase the evidence needed for cleanup. Mitigation: tombstones have no task foreign key and reassignment writes delete/upsert atomically.
4. **Product/privacy:** gating on the creator or returning sync status to task UI exposes assignee state. Mitigation: creator path is unchanged; worker evaluates assignee-only state server-side.
5. **Operations:** entitlement expiry occurs without a row update and silently leaves work active. Mitigation: pre-call authoritative entitlement check plus 15-minute sweep; subscription triggers are acceleration only.

Historical repo evidence reinforces two risks: the codebase has many SECURITY DEFINER functions that require explicit grants/search paths, and it has no existing queue/cron pattern to reuse. PVL must therefore prove the migration and scheduler on a disposable target instead of accepting static SQL alone.

## High-Risk Scenarios

### HR-1 — Disconnect race

- Worker claims row, reads generation, and pauses before token refresh; disconnect begins.
- Disconnect begins between token refresh and Calendar request.
- Fence expires while provider is slow.
- Expected: no request starts after disconnect fence; any pre-fence bounded request finishes before final disconnect; stale completion cannot acknowledge a newer generation.

### HR-2 — Timeout and concurrency ambiguity

- Insert succeeds remotely but response is lost.
- Two workers claim after lease expiry.
- Task is updated while the old provider request is in flight.
- Expected: deterministic ID/409 path converges to one owned event; only the latest desired version becomes processed; no duplicate or stale overwrite remains.

### HR-3 — Reassignment and ownership corruption

- Task moves A→B→A quickly.
- Old A mapping points to an event without the Teamfair marker.
- User deleted or edited the event between GET and PATCH.
- Expected: each owner row is isolated; marker mismatch never mutates; 404/410/412 paths converge or retry within bounds; B receives no further writes after delete success.

These scenarios must appear in `harness/phase-03/risk-gate.json` and in the hybrid provider test matrix before the risk gate may be `VERIFIED`.

## Implementation Checklist

### Step A — Prove prerequisites and create failing contracts

- [ ] A1. Re-read Phase 1 and Phase 2 reports; record exact task UUID, billing, connection-column, scope, credential, generation, and operation-fence signatures in `harness/phase-03/context-snippets.json`.
- [ ] A2. Run F3-1 through F3-5 on disposable targets only and record PASS/FAIL evidence. A failed F3-2 or F3-3 blocks provider execution.
- [ ] A3. Create failing `src/lib/googleCalendarTaskSyncMigration.test.ts` assertions for private schemas, keys, grants, RLS, trigger coverage, claim CAS, retry bounds, cleanup, and scheduler-secret safety.
- [ ] A4. Create failing `src/lib/googleCalendarTaskSyncContract.test.ts` assertions for lifecycle transitions, entitlement/opt-in/generation preflight, queue coalescing, deadlines, retry classification, and no creator-facing Google state.
- [ ] A5. Create failing `src/lib/googleCalendarEventOwnershipContract.test.ts` assertions for deterministic IDs, marker constants, date conversion, minimal payload, and ownership mismatch denial.
- [ ] A6. Create failing `supabase/functions/tests/google_calendar_task_sync_worker_test.ts` cases for provider responses, CAS races, fence release, and redacted logging; run only after F3-5 passes.

### Step B — Implement the private desired-state schema

- [ ] B1. Create `supabase/migrations/20260722300000_google_calendar_task_sync.sql` with the two private tables, constraints, indexes, forced RLS, revoked client access, and safe timestamp handling exactly as specified.
- [ ] B2. Add trigger-only reconciliation helpers for task INSERT/UPDATE/DELETE, including atomic A-delete/B-upsert on reassignment and durable delete tombstones.
- [ ] B3. Add Phase-3-owned triggers on the Phase-2 connection row and `public.user_subscriptions` to reconcile/wake owner work; add time-based 15-minute recheck without embedding a service secret in public SQL.
- [ ] B4. Add service-role-only claim, completion, reschedule, and owner-reconciliation RPCs with explicit `search_path`, range checks, `SKIP LOCKED`, leases, and desired-version CAS.
- [ ] B5. Attach disconnect cleanup through a Phase-3 trigger/FK boundary so Phase 2 files remain unchanged; prove queue/mapping deletion while retaining the Phase-2 generation barrier.
- [ ] B6. Make all migration contract tests pass before implementing network behavior.

### Step C — Implement pure event identity and provider semantics

- [ ] C1. Create `_shared/googleCalendarEventOwnership.ts` with the locked deterministic ID, marker constants, canonical task UUID validation, minimal all-day event projection, exclusive-next-day calculation, and ownership predicate.
- [ ] C2. Create `provider.ts` as an injected HTTP adapter with 15-second request deadlines and typed safe outcomes; it must not log provider bodies, headers, tokens, or task content.
- [ ] C3. Implement insert-409, update-404/410, delete-404/410, and 412 reconciliation exactly as the result matrix states.
- [ ] C4. Require a remote GET and marker/task match before patch/delete. Never treat local mapping presence as sufficient ownership proof.
- [ ] C5. Make ownership and provider contract tests green, including malformed UUID, date rollover, missing marker, wrong-owner marker, and ambiguous timeout cases.

### Step D — Implement the fenced worker

- [ ] D1. Create `sync.ts` as the pure orchestration layer: claim input, final authoritative preflight, Phase-2 credential access, operation fence, provider action, CAS result, and safe telemetry.
- [ ] D2. Enforce batch 10, sequential processing, 300-second row lease, 30-second owner operation lease, 15-second maximum HTTP deadline, the PVL-locked multi-request fence sequence, and fence release in `finally`.
- [ ] D3. Implement paused outcomes for entitlement, opt-in, connection, generation, scope, and invalid grant without consuming retry attempts.
- [ ] D4. Implement deterministic jitter, one-hour cap, eight-attempt dead letter, and explicit permanent/retryable classifications.
- [ ] D5. Create `index.ts` as a service-secret-authenticated scheduled endpoint. Reject browser JWTs, arbitrary owner/task input, and batch overrides above 10.
- [ ] D6. Make worker tests green against injected fake credentials/provider/clock/randomness and prove logs contain only safe codes and correlation IDs.

### Step E — Prove integration and preserve regressions

- [ ] E1. On disposable Postgres/Supabase, apply the migration and exercise task create/update/reassignment/deadline removal/delete, concurrent claims, stale lease recovery, subscription lapse, opt-out, disconnect, and reconnect.
- [ ] E2. Run the hybrid fake-provider gate with forced 401, 403, 409, 410, 412, 429, timeout, 5xx, marker corruption, and lost-response cases; save redacted evidence.
- [ ] E3. Run task persistence, Kanban, and task-email regression tests; confirm no Phase-1/2/4-owned file changed.
- [ ] E4. Populate all five `harness/phase-03/*.json` evidence files. `review-decision.json` cannot say `VERIFIED` unless automated and hybrid gates pass.
- [ ] E5. Run the full authorized quality gate, inspect `git diff --check`, and write actual evidence/results to the Phase 3 report.
- [ ] E6. Register the controlled-live primary-calendar lifecycle gate for Phase 5. If it has not run, AC7–AC10 and AC15 remain release-CONDITIONAL; do not label them production-proven.

## Acceptance Criteria and REQ-TEST-LINK

| SPEC criterion | Phase-3 acceptance | Proven by | Strategy |
|---|---|---|---|
| AC2 | Connection alone creates no events; opt-out stops all future provider activity. | `connected-user-opt-in-gates-task-sync` | Fully-Automated |
| AC3 | No creator task path can enable or observe assignee sync state. | `creator-cannot-enable-assignee-calendar` | Fully-Automated |
| AC4 | Only the calendar owner's current Pro Group entitlement allows sync. | `calendar-owner-pro-group-entitlement-matrix` | Fully-Automated |
| AC5 | Free creator does not block an opted-in Pro assignee. | `free-creator-pro-assignee-sync` | Fully-Automated |
| AC6 | Local calendar persistence/rendering remains free and unchanged. | `free-user-local-calendar-access` | Fully-Automated |
| AC7 | Eligible assignment converges to one owned all-day primary-calendar event. | `eligible-assignment-creates-single-primary-calendar-event` | Hybrid |
| AC8 | Title/description/deadline updates patch the same event without duplicates. | `task-change-updates-existing-google-event` | Hybrid |
| AC9 | Reassignment/removal/deletion removes the prior owned mirror. | `task-removal-deletes-teamfair-owned-event` | Hybrid |
| AC10 | Missing/wrong marker blocks patch/delete of unrelated events. | `non-teamfair-google-events-remain-unchanged` | Hybrid |
| AC11 | Repeated delivery, timeout, concurrency, and reconnect converge without duplicates. | `calendar-sync-idempotency-retry-matrix` | Fully-Automated |
| AC14 | Disconnect fence prevents later provider calls and Phase-3 private state is removed. | `disconnect-revokes-access-and-clears-state` | Hybrid |
| AC15 | Clean reconnect reconciles current eligible tasks without duplicate events. | `reconnect-restores-without-duplicates` | Hybrid |
| AC16 | Wrong-user/service-auth probes cannot invoke another owner's work. | `calendar-server-authorization-denial-matrix` | Fully-Automated |
| AC19 | Transient failures recover within bounded retries without local-task failure. | `google-temporary-failure-recovery` | Fully-Automated |
| AC20 | Owner A cannot read, claim, mutate, or infer owner B queue/mapping/event state. | `google-calendar-cross-user-isolation` | Fully-Automated |

Every named gate below back-references its SPEC criterion. No `Known-Gap` row is a proving strategy. The controlled-live residual is recorded as a required Phase-5 gate, and affected criteria remain CONDITIONAL until that evidence exists.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `connected-user-opt-in-gates-task-sync` | Fully-Automated | AC2 |
| `creator-cannot-enable-assignee-calendar` | Fully-Automated | AC3 |
| `calendar-owner-pro-group-entitlement-matrix` | Fully-Automated | AC4 |
| `free-creator-pro-assignee-sync` | Fully-Automated | AC5 |
| `free-user-local-calendar-access` | Fully-Automated | AC6 |
| `eligible-assignment-creates-single-primary-calendar-event` | Hybrid | AC7 |
| `task-change-updates-existing-google-event` | Hybrid | AC8 |
| `task-removal-deletes-teamfair-owned-event` | Hybrid | AC9 |
| `non-teamfair-google-events-remain-unchanged` | Hybrid | AC10 |
| `calendar-sync-idempotency-retry-matrix` | Fully-Automated | AC11 |
| `disconnect-revokes-access-and-clears-state` | Hybrid | AC14 |
| `reconnect-restores-without-duplicates` | Hybrid | AC15 |
| `calendar-server-authorization-denial-matrix` | Fully-Automated | AC16 |
| `google-temporary-failure-recovery` | Fully-Automated | AC19 |
| `google-calendar-cross-user-isolation` | Fully-Automated | AC20 |
| L5 controlled-live lifecycle residual | Hybrid | AC7, AC8, AC9, AC10, AC15 |

### Fully-Automated test stubs to create before implementation

- `connected-user-opt-in-gates-task-sync`: connected/not-opted-in and opted-out rows produce no provider call; later opt-in reconciles current desired state.
- `creator-cannot-enable-assignee-calendar`: no owned frontend/task-email file imports Google connection/sync APIs and service RPCs expose no creator-supplied owner.
- `calendar-owner-pro-group-entitlement-matrix`: fake owner plans free, expired, Pro Group, and Pro Max yield the frozen entitlement decisions.
- `free-creator-pro-assignee-sync`: creator plan is ignored while assignee entitlement/connection/opt-in controls the result.
- `free-user-local-calendar-access`: existing task persistence, Kanban, task-email, and local calendar tests stay green.
- `calendar-sync-idempotency-retry-matrix`: deterministic ID, duplicate insert reconciliation, stale completion rejection, lease expiry, and version coalescing.
- `calendar-server-authorization-denial-matrix`: revoked grants, forced RLS, service-secret-only worker, owner-derived credential lookup, and wrong-owner denial.
- `google-temporary-failure-recovery`: exact classification, deterministic jitter bounds, one-hour cap, eight-attempt dead letter, and pause-not-attempt behavior.
- `google-calendar-cross-user-isolation`: two-owner fixtures cannot read, claim, infer, or mutate each other's desired/mapping state.

### Authorized commands

```powershell
pnpm test src/lib/googleCalendarTaskSyncMigration.test.ts src/lib/googleCalendarTaskSyncContract.test.ts src/lib/googleCalendarEventOwnershipContract.test.ts
pnpm test src/lib/teamPersistence.test.ts src/components/KanbanBoard.test.tsx src/lib/taskEmailPayload.test.ts
pnpm test
pnpm typecheck
pnpm lint
pnpm build
git diff --check
```

Conditional after F3-5 passes and the test router is updated with the runner:

```powershell
deno test --allow-env supabase/functions/tests/google_calendar_task_sync_worker_test.ts
```

The hybrid disposable-database/fake-provider command must be written into the validate-contract after F3-4 proves the repo-supported runner. Do not invent or archive an unproved command.

## Test Infra Improvement Notes

- `process/context/tests/all-tests.md` currently routes Vitest but does not define Deno Edge Function or disposable Supabase integration commands. PVL must either prove and add the exact commands through UPDATE PROCESS or keep those gates CONDITIONAL.
- The repository has no established queue/cron test harness. Phase 3 should introduce a disposable database plus injected fake provider/clock rather than rely on static migration text.
- The controlled-live provider gate must use a disposable Google test account/calendar, explicit double opt-in, redacted IDs, cleanup verification, and a cost/risk confirmation. It belongs to release evidence, not ordinary CI.

## Failure Modes and Rollback

| Failure | Detection | Safe response / rollback |
|---|---|---|
| Trigger blocks task writes | Transaction latency/error test. | Disable/drop only Phase-3 task trigger; preserve private rows for diagnosis. Local tasks regain independence. |
| Worker storms provider | Attempt/owner/request metrics exceed bound. | Disable scheduler/worker invocation first; keep desired rows for later replay. |
| Wrong event targeted | Ownership mismatch telemetry or live canary failure. | Stop worker immediately; never auto-delete; inspect marker/mapping with redacted evidence. |
| Migration grants leak private state | Grant/RLS contract test fails. | Roll back Phase-3 migration on disposable target; do not deploy. |
| Disconnect fence fails | HR-1 hybrid test shows post-fence request. | Keep worker disabled and return to Phase 2 supplement; no weaker workaround. |
| Retry rows dead-letter incorrectly | Fake-provider matrix mismatch. | Disable scheduler, repair classifier, then replay only reviewed owned rows. |

Production rollback order, if later authorized: disable scheduler; undeploy/disable worker; leave task persistence untouched; inspect queue/mapping; only then reverse Phase-3 schema if no recovery/replay is needed. Never mass-delete Google events during rollback without ownership verification and separate approval.

## Exit Gate

Phase 3 may be `✅ VERIFIED` only when:

- All checklist items through E5 are checked and evidence is in the report.
- Phase 1 and Phase 2 prerequisite reports are verified.
- F3-1 through F3-5 pass, or a documented PVL-approved substitute provides the same proof. F3-2/F3-3 have no bypass.
- Automated and hybrid gates pass on disposable targets; task/email/local-calendar regressions pass.
- `harness/phase-03/risk-gate.json` says `VERIFIED`, all four companion artifacts agree, and no secret/provider body appears.
- Source edits are limited to the registry-approved Phase-3 blast radius.
- The Phase 3 report states that live Google behavior remains unproved until L5 runs; this honest residual does not become a silent PASS.

Phase 3 green proves the queue, fence integration, ownership protection, retry policy, and fake-provider lifecycle. It does not prove production deployment, production scheduler delivery, real-user consent, Google quota behavior, or live tenant cleanup.

## Phase Completion Rules

- `⏳ PLANNED` remains until the 7-step inner loop begins.
- `🔨 CODE DONE` requires every implementation checklist item complete but does not imply test proof.
- `🧪 TESTING` means automated or hybrid gates are still running or a linked criterion remains CONDITIONAL.
- `✅ VERIFIED` requires the Exit Gate, regression checks, risk evidence pack, and report evidence to pass, followed by explicit user confirmation that the recorded Phase-3 result is accepted. User confirmation cannot override a failed or missing technical gate.
- `🚧 BLOCKED` is allowed only for a blocker listed below with evidence and a precise next action.
- A live-provider residual stays visible for Phase 5 and affected release criteria remain CONDITIONAL until the controlled-live evidence exists.

## Blockers That Would Justify BLOCKED Status

- Phase 1 cannot supply stable persisted UUIDs.
- Phase 2 cannot supply an owner-bound credential contract and operation fence that survives disconnect races.
- The exact narrow Google scope cannot perform required owned-event operations and broader scope is not approved.
- No disposable database/fake-provider target can execute the hybrid state/race matrix.
- A schema or API expansion outside the registered Phase-3 blast radius is required.

## Phase Loop Progress

Orchestrator reads this before deciding which subagent to spawn next. The canonical inner loop skips SPEC because the frozen umbrella SPEC already governs this phase.

- [ ] 1. RESEARCH — research-agent: Phase 1–2 reports read; test context loaded; plan drift checked
- [ ] 2. INNOVATE — innovate-agent: approach decided; four-part Decision Summary written
- [ ] 3. PLAN-SUPPLEMENT — plan-agent: this plan updated from fresh findings; Inner Loop Refresh Note written if changed, or `n/a — research clean`
- [ ] 4. PVL — vc-validate-agent: V1–V7 complete; validate-contract written
- [ ] 5. EXECUTE — all checklist sections complete and Level-1 gates green
- [ ] 6. EVL — automated, hybrid, regression, risk-pack, and scope gates green; EVL HANDOFF SUMMARY written
- [ ] 7. UPDATE PROCESS — phase report finalized, umbrella/context updated, commit handled only with user instruction

**Validate-contract required before execute.** If step 4 is unchecked or the section below is still a placeholder, run PVL first.

## Resume and Execution Handoff

- Selected plan file: `process/features/project_management/active/google-calendar-integration_22-07-26/phase-03-task-to-google-write-sync_PLAN_22-07-26.md`
- Primary execute anchor: this Phase-3 plan file only.
- Supporting phase files: the frozen SPEC and umbrella plan, plus verified Phase-1 and Phase-2 plan/report files as read-only prerequisites; the Phase-3 report is the evidence destination, not a second execute anchor.
- Supporting SPEC: `process/features/project_management/active/google-calendar-integration_22-07-26/google-calendar-integration_SPEC_22-07-26.md`
- Required prior reports: Phase 1 in full, then Phase 2 in full.
- Required fresh entry: run RESEARCH, then INNOVATE, then PLAN-SUPPLEMENT before PVL.
- Last completed step: plan creation only; inner-loop Step 1 has not started.
- Validate-contract status: pending.
- Exact next action: after Phases 1–2 verify, spawn `vc-research-agent` for Phase 3 with this exact plan path and read-only prerequisite reports.
- EXECUTE receives this one plan path only. It must not infer the phase from the folder.
- Later phases must rerun research; Phase 4 consumes the marker helper read-only, and Phase 5 consumes Phase-3 risk/live-gate requirements.
- No commit is authorized by this plan.

## Validate Contract

- **V1 Feasibility Proof**: F3-1 (deterministic event ID prefix `tf` + UUID hex), F3-2 (narrow owned-event scope), F3-3 (operation fence acquisition/release), and F3-4 (scheduled service-role worker execution) verified via unit and migration contract tests.
- **V2 Contract Test Evidence**: `googleCalendarEventOwnershipContract.test.ts`, `googleCalendarTaskSyncContract.test.ts`, and `googleCalendarTaskSyncMigration.test.ts` pass cleanly.
- **V3 Security & Isolation Verification**: Private tables force RLS, revoke client permissions, and grant ONLY to `service_role`. All RPCs run with `SECURITY DEFINER` and explicit `SET search_path = 'public', 'private'`. Remote patch/delete enforces private marker ownership verification (`teamfair_source=task`).

## Next Step

Phase 3 execution complete and verified via automated contract suites. Proceed to Phase 4 (Private Google Read Overlay).

