# Phase 01 — Task Identity and Pricing Contract

**Date**: 22-07-26  
**Status**: PLANNED — awaiting VALIDATE  
**Complexity**: COMPLEX phase within a five-phase program

## TL;DR

Phase 1 removes temporary task IDs from the create flow and makes the database-generated UUID available before any success, notification, update, or delete action. It also makes 79,000 VND/month the single server-authoritative Pro Group price while preserving Pro Max at 129,000 VND/month and preserving Pro Max inheritance of Pro Group features. No Google OAuth, calendar-provider work, charge, deployment, or production mutation occurs in this phase.

## Context Envelope

- feature: `project_management`
- phase: `PLAN`
- session-goal: define an executable Phase 1 contract for persisted task identity and account-scoped pricing
- branch: `feature_blocking`
- worktree: `D:/Python/Projects/Teamfair`
- context-group: `planning, tests, database, auth`
- blast-radius-packages: `src | supabase/functions`
- active-plan: `process/features/project_management/active/google-calendar-integration_22-07-26/phase-01-task-identity-and-pricing_PLAN_22-07-26.md`
- test-runner: `pnpm test | pnpm typecheck | pnpm lint | pnpm build`
- validate-contract: `pending — VALIDATE must write V1–V7 contract before EXECUTE`

## Session Goal and Observable Outcome

Goal: lock the two prerequisites on which later Google Calendar phases depend.

Observable outcome:

1. A newly created task first becomes visible as a task carrying its database-persisted UUID; immediate update/delete operations use that same UUID.
2. The server selects 79,000 VND for `pro_group` and 129,000 VND for `pro_max`; browser code can display the catalog but cannot choose the charged amount.
3. `pro_max` continues to satisfy all Pro Group feature checks.
4. Local calendars remain available to free accounts and task creation remains independent of the creator's entitlement.

## Purpose

Later queue, OAuth, sync, and subscription-change work needs a durable task identifier and one stable entitlement contract. Phase 1 establishes those foundations without touching external providers.

## Entry Gate

Phase 1 may enter EXECUTE only when all conditions hold:

- The frozen program SPEC remains the authoritative requirements source.
- The umbrella plan still places Phase 1 before OAuth, outbox, sync, and lifecycle phases.
- The blast-radius registry continues to assign the listed implementation files to Phase 1.
- VALIDATE resolves the two feasibility questions in `## Feasibility Gates` and writes the validate-contract.
- A disposable Supabase test environment or equivalent isolated database fixture is named for hybrid identity and billing evidence. Production is not an acceptable test target.

## Dependencies and Inputs

- Frozen SPEC: `process/features/project_management/active/google-calendar-integration_22-07-26/google-calendar-integration_SPEC_22-07-26.md`.
- Program plan: `process/features/project_management/active/google-calendar-integration_22-07-26/google-calendar-integration_PROGRAM_PLAN_22-07-26.md`.
- Blast-radius registry: `process/features/project_management/active/google-calendar-integration_22-07-26/phase-blast-radius-registry.md`.
- Existing `tasks.id` UUID default and task SELECT policies from the current Supabase migrations.
- Existing account-scoped `user_subscriptions`, `billing_plan_for_user`, and `get_my_entitlements` contracts.
- Existing local-calendar behavior in `src/pages/ProjectManagement.tsx`; Phase 1 treats this file as read-only.
- Current test routing from `process/context/tests/all-tests.md`; no deeper test router exists.
- Repository routing source: `process/context/all-context.md`.

## Strategy Compare

Strategy score: **5/7**.

- S1, three or more workspace packages: no.
- S2, public API or identity contract: yes.
- S3, three viable implementation directions: no; the work has two tightly coupled prerequisites, not three competing designs.
- S4, phase-program membership: yes.
- S5, requested planning depth: yes.
- S6, high-risk identity or billing behavior: yes.
- S7, five or more touched files: yes.

| Strategy | Cost | Fit | Decision |
|---|---:|---|---|
| Sequential | Low | Simple, but weak cross-contract checkpoints for identity and billing | Reject |
| Parallel subagents | Medium | Creates merge and contract drift risk across shared persistence and pricing surfaces | Reject |
| Deterministic workflow | Medium | One ordered lane, explicit gates, reproducible evidence, no ownership ambiguity | **Selected** |
| Agent team | High | Appropriate for program-level cross-phase validation, excessive for this single execution lane | Reserve for outer program validation |

Reason: persisted identity must be proven before task-creation UI changes can be trusted, and the canonical price contract must be proven before display consumers change. A deterministic workflow keeps both contracts ordered and reviewable.

## Architecture Decisions

### A1. Database UUID is the only durable task identity

`insertTask` returns the row created by Supabase after requesting the inserted row and exactly one result. The returned `Task` carries the database UUID. `TeamContext.addTask` becomes asynchronous and resolves to that persisted `Task`. It does not publish a `Date.now()` placeholder.

The preferred public return contract is `Promise<Task>`, not `Promise<string>`, because both current create callers need the final task state and later phases need the stable identifier. VALIDATE must confirm the query shape, TypeScript inference, and SELECT-policy behavior before locking this contract.

### A2. Persist first, then publish success

In Supabase mode, the application inserts first. Only after the insert returns a persisted task does context upsert it into the captured group and allow success UI, notification, email, or analytics work. A rejected insert leaves the form open and preserves user input.

In demo/local mode, `crypto.randomUUID()` supplies a stable local identity and the same asynchronous `Promise<Task>` contract resolves immediately. Local mode must not regress to timestamp IDs.

### A3. Async reconciliation is group-safe and duplicate-safe

The create call captures the target group ID before awaiting persistence. Resolution updates that group by ID, not by a stale array index or currently selected project. The context upserts by persisted UUID, so a realtime refresh arriving before the insert promise resolves cannot create a duplicate.

### A4. Task insert success is not undone by activity-log failure

The task row is the authoritative create result. If the later activity-log write fails, `insertTask` reports the task as created and records a non-fatal warning/reconciliation signal. It must not reject in a way that encourages a second task insert. This split prevents duplicate tasks after partial success.

### A5. One pure, shared pricing catalog

`supabase/functions/_shared/billing.ts` owns public plan IDs, VND amounts, and feature predicates. It contains no environment access, Deno-only imports, browser globals, secrets, network calls, or mutable state. `billing-api` imports it on the server. `src/lib/billing.ts` imports/re-exports its safe catalog surface and retains client-specific entitlement normalization.

The server accepts a supported plan ID and derives the order amount from the catalog. It never accepts browser-supplied price authority. UI pages format the same constants for display.

### A6. Entitlement semantics stay account-scoped

The catalog matrix is fixed:

| Plan | Pro Group features | Pro Max-only features | Monthly VND |
|---|---:|---:|---:|
| `free` | No | No | 0 |
| `pro_group` | Yes | No | 79,000 |
| `pro_max` | Yes | Yes | 129,000 |

No new subscription model is introduced. Pro Max inherits Pro Group features through the existing feature predicate. The task creator's plan does not control whether a Pro assignee can receive later calendar sync. Local calendars remain free.

## Data Flow Architecture Note

### Task create flow

1. The creation UI validates input, captures the target group, enters an in-flight state, and calls `addTask` once.
2. `TeamContext.addTask` builds the creation request without inventing a durable placeholder ID.
3. `teamPersistence.insertTask` inserts the task, requests the inserted row, verifies one row, maps it through the shared database-to-domain mapper, and returns the persisted `Task`.
4. Context upserts that task by UUID into the captured group ID. A prior realtime arrival with the same UUID is replaced, not duplicated.
5. The caller uses the returned task for post-create notifications/email, closes and resets the form, and shows success.
6. On pre-insert failure, no task, success, notification, email, or success analytics event is published. The form remains recoverable.
7. On post-insert activity-log failure, the task remains successful and no automatic task retry occurs.

### Billing flow

1. The browser selects only `pro_group` or `pro_max`.
2. `billing-api` authenticates the account, validates the plan ID, and reads the VND amount from the shared pure catalog.
3. The server creates the existing pending-order representation using that amount. No Phase 1 test performs a real charge.
4. Client pages use the same catalog for display. Display values are informative; server lookup remains authoritative.

## Scope

### In scope

- Persisted task UUID return and async task-create contract.
- Safe create UI states for Kanban and lecturer task creation.
- Realtime-safe task upsert and captured-group reconciliation.
- Server-authoritative 79,000 VND Pro Group pricing.
- Pro Max price and inheritance regression protection.
- Free local-calendar and entitlement-boundary regression protection.
- Automated and disposable-environment hybrid evidence.

### Out of scope

- Google OAuth, token storage, provider APIs, callback routes, queue/outbox schema, workers, or sync lifecycle.
- Database schema or RLS changes.
- New billing plan or subscription model.
- Real payment, production order, deployment, live migration, or production database mutation.
- Changes to `src/pages/ProjectManagement.tsx`; Phase 1 verifies it only.
- UI redesign beyond async loading, error, and truthful completion behavior.

## Touchpoints

| File | Planned change | Contract owner |
|---|---|---|
| `supabase/functions/_shared/billing.ts` | Add pure canonical plan catalog, amounts, and feature predicates | Phase 1 |
| `supabase/functions/billing-api/index.ts` | Replace duplicate plan literals with server import from canonical catalog | Phase 1 |
| `src/lib/billing.ts` | Import/re-export safe catalog; preserve account entitlement normalization | Phase 1 |
| `src/lib/billing.test.ts` | Prove exact prices, inheritance, and tamper-resistant server derivation boundary | Phase 1 |
| `src/pages/Landing.tsx` | Derive light landing display from catalog | Phase 1 |
| `src/pages/LandingDark.tsx` | Derive dark landing display from catalog | Phase 1 |
| `src/pages/Checkout.tsx` | Derive checkout display from catalog without becoming price authority | Phase 1 |
| `src/lib/teamPersistence.ts` | Return inserted persisted task; split task success from activity-log failure | Phase 1 |
| `src/lib/teamPersistence.test.ts` | Prove returned UUID, mapping, insert errors, and post-insert log failure | Phase 1 |
| `src/context/TeamContext.tsx` | Make `addTask` async; stable local UUID; captured-group upsert by UUID | Phase 1 |
| `src/context/TeamContext.test.tsx` | Prove async success/failure, group switching, and realtime-race reconciliation | Phase 1 |
| `src/components/KanbanBoard.tsx` | Await create; disable double submit; gate side effects and truthful UI | Phase 1 |
| `src/components/KanbanBoard.test.tsx` | Prove success, rejection, retained input, and one-submit behavior | Phase 1 |
| `src/pages/LecturerDashboard.tsx` | Await create; disable double submit; gate side effects and truthful UI | Phase 1 |
| `src/pages/LecturerDashboard.test.tsx` | Prove success, rejection, retained input, and one-submit behavior | Phase 1 |
| `src/pages/ProjectManagement.test.tsx` | Read-only regression gate for free local calendars | Existing owner; no Phase 1 edit |

## Public Contracts

1. **Persisted create result:** `insertTask` resolves to the persisted domain `Task`, including the database UUID. It rejects only when the task itself cannot be confirmed as inserted.
2. **Context create result:** `TeamContext.addTask` resolves to `Promise<Task>` after a stable identity exists. Both current create callers await it.
3. **Identity invariant:** every task visible after create uses one UUID stable across immediate update, delete, reload, and future queue references.
4. **Pricing catalog:** `free`, `pro_group`, and `pro_max` are the supported account plans; exact monthly VND amounts are 0, 79,000, and 129,000.
5. **Server authority:** billing requests carry a plan ID; the server maps it to the amount. Client display data cannot override that mapping.
6. **Feature inheritance:** `pro_max` returns true for Pro Group feature checks and true for Pro Max-only checks. `pro_group` returns true only for Pro Group feature checks.
7. **Free-local invariant:** local calendar creation/view remains available without a paid plan.
8. **Creator-neutral invariant:** task creation does not consult creator entitlement; later assignee sync eligibility can be evaluated independently.

## Blast Radius

### Direct surfaces

- Task persistence query/mapping and activity logging.
- Team context public API and all known create callers.
- Task creation dialog behavior and side effects.
- Billing Edge Function catalog consumption.
- Browser plan constants and three pricing display surfaces.

### Downstream consumers

- Immediate task update/delete paths depend on the stable ID.
- Phase 3 queue/outbox work depends on stable task UUIDs.
- Phases 2–5 depend on the entitlement and pricing semantics but do not own them.
- Existing billing orders, entitlement RPCs, and account-scoped subscriptions must remain compatible.

### Compatibility statement

- No schema migration is planned.
- Existing task rows and UUIDs remain unchanged.
- Existing `pro_group` and `pro_max` identifiers remain unchanged.
- The Pro Group monetary value intentionally changes from the repository's current 69,000 VND literal to the frozen SPEC value of 79,000 VND. Existing historical order amounts are not rewritten.
- Pro Max remains 129,000 VND and retains its current inherited features.

## Feasibility Gates

### F1. Inserted-row return and SELECT policy

Before implementation proceeds past persistence tests, prove in a disposable Supabase environment that the existing authenticated role can insert a task and receive that same row through the insert-return query. Confirm the returned UUID is the database UUID and the current SELECT RLS permits the response. If this fails, stop. Phase 1 cannot add RLS or schema changes without a plan supplement and registry update.

### F2. Cross-runtime shared pricing module

Before changing all consumers, prove that the pure module under `supabase/functions/_shared/` is accepted by both the Edge Function import path and the frontend TypeScript/build pipeline. Required proof is the focused billing test, `pnpm typecheck`, and `pnpm build`. If the frontend boundary fails, stop and request a plan supplement for a claimed generated client artifact; do not duplicate the price literals.

## Security Review

| Threat | Control | Evidence gate |
|---|---|---|
| Browser tampers with order amount | Browser sends plan ID only; server derives amount from canonical catalog | `billing-server-authority` |
| Temporary identity targets wrong task | No temporary durable ID; database UUID returned before publication | `persisted-task-uuid-create-return` |
| Project switches during pending insert | Capture group ID and reconcile by that ID | `pending-create-project-switch` |
| Realtime response duplicates task | UUID upsert replaces same identity | `realtime-before-create-resolution` |
| Double submission creates duplicates | In-flight state disables repeated submit | `double-submit-single-insert` |
| Misleading success or repudiation | Success and analytics occur only after confirmed insert | `create-failure-truthful-ui` |
| Shared catalog leaks secrets | Module is pure public data with no environment access | `shared-billing-module-boundary` |
| Entitlement elevation | Existing account-scoped entitlement RPCs remain authoritative; no new auth bypass | `account-plan-feature-matrix` |

Security classification: OWASP A01 access control and A04 insecure design are the relevant review lenses. No secret, OAuth credential, token, or provider data enters this phase.

## Risk Predictions

Five-persona pre-implementation review result: **CAUTION**. No design-blocking issue was found, but identity/RLS proof and cross-runtime module proof are mandatory.

| Persona | Prediction | Mitigation |
|---|---|---|
| Architecture | Async create may reconcile into the wrong currently selected group | Capture target group ID and update by ID |
| Data integrity | Insert may succeed while activity logging fails, causing caller retry and duplicate task | Treat task insert as authoritative success; log failure is non-fatal |
| Security | UI price can drift or attempt to control server amount | One pure catalog; server plan lookup; tamper test |
| Test engineering | Mock-only tests can pass while RLS blocks returned rows | Mandatory disposable-Supabase hybrid gate |
| Product/UX | Awaiting persistence may create double-clicks or lose form data on failure | In-flight disable; retain input and dialog on rejection |

## Failure Modes and Required Behavior

| Failure or race | Required behavior | Terminal state |
|---|---|---|
| Insert rejects before a row exists | Keep form/input, show error, publish no success/notification/email | Safe failure |
| Insert succeeds but returned row is unavailable | Fail feasibility gate; do not fabricate an ID | Blocked |
| Activity log fails after task insert | Keep created task, emit non-fatal diagnostic, do not retry insert | Success with diagnostic |
| Project selection changes while insert is pending | Upsert returned task into captured group ID | Success |
| Realtime row arrives before promise resolves | Upsert by UUID; exactly one task remains | Success |
| User submits twice | Second submit is disabled/ignored; one persistence call | Success |
| Billing request includes manipulated client display value | Server ignores it and charges/catalogs only by validated plan ID | Safe success/rejection |
| Shared catalog imports runtime-specific API | Typecheck/build fails; no duplicated fallback literal | Blocked |
| Disposable test environment is unavailable | Automated gates may run, but hybrid identity/billing gates remain NOT RUN | Conditional; no Phase 1 green |

## Implementation Checklist

1. [ ] In `src/lib/teamPersistence.test.ts`, add red-first cases for an inserted row returning its database UUID, insert rejection, and activity-log failure after successful insert.
2. [ ] In `src/context/TeamContext.test.tsx`, add red-first cases for `Promise<Task>`, stable local UUIDs, captured-group resolution, and realtime-before-resolution UUID upsert.
3. [ ] In `src/components/KanbanBoard.test.tsx` and `src/pages/LecturerDashboard.test.tsx`, add red-first cases for awaiting creation, disabled duplicate submit, gated notifications/email, retained form data on rejection, and truthful success/error UI.
4. [ ] Run the F1 disposable-Supabase probe and record whether insert-return plus existing SELECT RLS returns the persisted task row. Stop on failure.
5. [ ] In `src/lib/teamPersistence.ts`, reuse one database-row-to-domain mapper for reload and insert return; make `insertTask` return the confirmed persisted `Task`.
6. [ ] In `src/lib/teamPersistence.ts`, separate post-insert activity-log failure from task-create failure so a created task is never retried as if absent.
7. [ ] In `src/context/TeamContext.tsx`, change the `addTask` public contract to `Promise<Task>`, remove timestamp durable IDs, and use `crypto.randomUUID()` only for demo/local tasks.
8. [ ] In `src/context/TeamContext.tsx`, capture the target group ID before awaiting persistence and upsert the returned task by UUID into that group.
9. [ ] In `src/components/KanbanBoard.tsx`, await `addTask`, enforce one in-flight submit, run notifications/email/reset/close/success only after resolution, and preserve recoverable form state on rejection.
10. [ ] In `src/pages/LecturerDashboard.tsx`, apply the same async, one-submit, side-effect, and recoverable-error contract.
11. [ ] Run the focused task-create automated suite and make every red-first case green before billing edits.
12. [ ] In `src/lib/billing.test.ts`, add red-first cases for exact 79,000/129,000 amounts, Pro Max inheritance, unsupported plan rejection, and browser amount non-authority.
13. [ ] Add `supabase/functions/_shared/billing.ts` as a pure public catalog containing plan IDs, amounts, and feature predicates with no runtime-specific dependencies.
14. [ ] Run F2 with the focused billing test, `pnpm typecheck`, and `pnpm build`; stop and request a scoped plan supplement if the shared module cannot cross both runtimes.
15. [ ] In `supabase/functions/billing-api/index.ts`, remove duplicate price literals and derive pending-order amount only from the validated plan ID and canonical catalog.
16. [ ] In `src/lib/billing.ts`, import/re-export the safe catalog while preserving account-scoped entitlement normalization and existing public consumer names where compatible.
17. [ ] In `src/pages/Landing.tsx`, `src/pages/LandingDark.tsx`, and `src/pages/Checkout.tsx`, derive displayed VND prices from the catalog; show exact 79,000 VND for Pro Group and 129,000 VND for Pro Max without approximate currency authority.
18. [ ] Run the focused billing, task-persistence, context, Kanban, lecturer-dashboard, and free-local-calendar test files.
19. [ ] Run the disposable-Supabase identity hybrid: create one task, assert returned UUID, immediately update and delete that UUID, assert cleanup, and retain no test row.
20. [ ] Run the isolated billing-function hybrid: prove `pro_group` produces 79,000 and `pro_max` produces 129,000 in pending test orders, prove manipulated browser amount is ignored, and clean up without a real charge.
21. [ ] Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `git diff --check`; resolve all Phase 1 regressions.
22. [ ] Perform agent probes for both landing themes, checkout price display, create pending/error UX, Pro Max inheritance, and free local-calendar access.
23. [ ] Update `phase-01-task-identity-and-pricing_REPORT_22-07-26.md` with commands, environment, evidence, failures, cleanup proof, and Phase 1 exit status.

## Acceptance Criteria and Requirement-to-Test Links

### P1-AC1 — Persisted identity is immediate

Every created Supabase task is first exposed with its database UUID, and immediate update/delete uses that UUID.

- proven by: `persisted-task-uuid-create-return`, `persisted-task-immediate-update-delete`
- strategy: `Hybrid`

### P1-AC2 — Creation UI is truthful and race-safe

Both create surfaces await persistence, prevent duplicate submission, preserve form data on failure, and reconcile the captured group without duplicate realtime rows.

- proven by: `create-failure-truthful-ui`, `pending-create-project-switch`, `realtime-before-create-resolution`, `double-submit-single-insert`
- strategy: `Fully-Automated`

### P1-AC3 — Server price is canonical

The server derives exactly 79,000 VND for Pro Group and 129,000 VND for Pro Max from one catalog; browser-supplied amount cannot alter it.

- proven by: `billing-server-authority`, `shared-billing-module-boundary`
- strategy: `Hybrid`

### P1-AC4 — Owner entitlement prerequisite for SPEC AC4

An active owner `pro_group` plan continues to expose Pro Group features at the new 79,000 VND catalog price.

- proven by: `account-plan-feature-matrix`
- strategy: `Fully-Automated`

### P1-AC5 — Creator/assignee entitlement separation prerequisite for SPEC AC5

Task creation remains creator-plan-neutral, and the feature matrix supports later assignee-based evaluation without a new model.

- proven by: `creator-plan-neutral-task-create`, `account-plan-feature-matrix`
- strategy: `Fully-Automated`

### P1-AC6 — Free local calendars satisfy SPEC AC6

Free users retain local calendar access and are not routed through a paid/provider gate.

- proven by: `free-user-local-calendar-access`
- strategy: `Fully-Automated`

### P1-AC7 — Stable identity prerequisite for SPEC AC7–AC11

Task create/reload/realtime paths converge on one UUID suitable for later queued create, update, delete, reassignment, and deduplication contracts.

- proven by: `persisted-task-uuid-create-return`, `realtime-before-create-resolution`
- strategy: `Hybrid`

## Test Tier Assignments

The full test router was loaded and every existing test file in the Phase 1 blast radius was discovered before tier assignment.

| Scenario | Tier | Why this tier | Required command or evidence |
|---|---|---|---|
| `persisted-task-uuid-create-return` | Hybrid | Mock proves query contract; disposable Supabase proves database UUID and SELECT RLS | Focused persistence test plus isolated Supabase insert-return evidence |
| `persisted-task-immediate-update-delete` | Hybrid | Requires a real disposable row and same-UUID lifecycle | Isolated create/update/delete/cleanup transcript |
| `create-failure-truthful-ui` | Fully-Automated | Deterministic rejected promise and side-effect assertions | `pnpm test src/components/KanbanBoard.test.tsx src/pages/LecturerDashboard.test.tsx` |
| `pending-create-project-switch` | Fully-Automated | Deterministic deferred promise and context state | `pnpm test src/context/TeamContext.test.tsx` |
| `realtime-before-create-resolution` | Fully-Automated | Deterministic same-UUID upsert race | `pnpm test src/context/TeamContext.test.tsx` |
| `double-submit-single-insert` | Fully-Automated | Deterministic in-flight UI state and call count | Kanban and lecturer-dashboard focused tests |
| `billing-server-authority` | Hybrid | Automated catalog tests plus isolated Edge Function order amount | Billing focused test plus disposable function evidence |
| `shared-billing-module-boundary` | Fully-Automated | Type and build pipelines prove both consumer boundaries | `pnpm test src/lib/billing.test.ts`, `pnpm typecheck`, `pnpm build` |
| `account-plan-feature-matrix` | Fully-Automated | Pure plan/feature matrix | `pnpm test src/lib/billing.test.ts` |
| `creator-plan-neutral-task-create` | Fully-Automated | Creation call must not branch on creator plan | Context and creation UI focused tests |
| `free-user-local-calendar-access` | Fully-Automated | Existing ProjectManagement regression test | `pnpm test src/pages/ProjectManagement.test.tsx` |
| `landing-checkout-price-clarity` | Agent-Probe | Visual copy, light/dark rendering, and loading/error state need rendered inspection | Captured light landing, dark landing, checkout, and create-dialog evidence |

No developed behavior may pass on `Known-Gap`. If the disposable Supabase or isolated billing-function harness cannot be provisioned, the affected hybrid gate remains **CONDITIONAL**, Phase 1 stays in TESTING, and UPDATE PROCESS must register a test-building backlog stub before any archive attempt.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `persisted-task-uuid-create-return` | Hybrid | Phase prerequisite for AC7, AC8, AC9, AC10, AC11; P1-AC1; P1-AC7 |
| `persisted-task-immediate-update-delete` | Hybrid | Phase prerequisite for AC8 and AC9; P1-AC1 |
| `create-failure-truthful-ui` | Fully-Automated | P1-AC2; prevents false lifecycle evidence |
| `pending-create-project-switch` | Fully-Automated | P1-AC2; stable ownership prerequisite for AC7–AC11 |
| `realtime-before-create-resolution` | Fully-Automated | Phase prerequisite for AC7 and AC11; P1-AC2; P1-AC7 |
| `double-submit-single-insert` | Fully-Automated | Phase prerequisite for AC7 and AC11; P1-AC2 |
| `billing-server-authority` | Hybrid | AC4 pricing prerequisite; P1-AC3; P1-AC4 |
| `shared-billing-module-boundary` | Fully-Automated | AC4 pricing prerequisite; P1-AC3 |
| `account-plan-feature-matrix` | Fully-Automated | AC4 and AC5 prerequisites; P1-AC4; P1-AC5 |
| `creator-plan-neutral-task-create` | Fully-Automated | AC5 prerequisite; P1-AC5 |
| `free-user-local-calendar-access` | Fully-Automated | AC6; P1-AC6 |
| `landing-checkout-price-clarity` | Agent-Probe | AC4 user-facing price clarity; P1-AC3 |

## Verification Commands

Run in this order:

1. `pnpm test src/lib/teamPersistence.test.ts src/context/TeamContext.test.tsx src/components/KanbanBoard.test.tsx src/pages/LecturerDashboard.test.tsx`
2. `pnpm test src/lib/billing.test.ts`
3. `pnpm test src/pages/ProjectManagement.test.tsx`
4. Disposable-Supabase identity hybrid using the validated test-environment procedure.
5. Isolated billing-function hybrid using the validated test-environment procedure; no real charge.
6. `pnpm test`
7. `pnpm typecheck`
8. `pnpm lint`
9. `pnpm build`
10. `git diff --check`

Evidence must name the exact environment and cleanup result. “Passed locally” without commands and disposable-resource proof is insufficient for hybrid gates.

## Test Infra Improvement Notes

- `process/context/tests/all-tests.md` supplies runner commands but no deeper Supabase/Edge Function fixture guide. VALIDATE must name a disposable-environment procedure before hybrid work starts.
- The existing persistence tests do not yet expose a reusable insert/select/single chain mock. Phase 1 should add the smallest reusable mock helper inside the owned test file, not create a new framework.
- If hybrid setup cannot be defined without new files outside the registered blast radius, request a plan supplement and registry claim. Do not silently downgrade the gate.

## Exit Gate

Phase 1 is green only when:

- F1 and F2 pass.
- All fully automated gates pass.
- Both hybrid gates run against disposable resources and pass; none are skipped.
- Agent-probe evidence confirms exact price presentation and truthful task-create pending/error states.
- Full test, typecheck, lint, build, and diff-check gates pass.
- No schema, OAuth, provider, production, charge, deployment, or live migration change appears in the diff.
- The Phase 1 report contains exact commands, evidence, cleanup proof, and remaining limitations.

## Phase Green Proves

- New task creation exposes a persisted UUID before immediate lifecycle actions.
- Current create surfaces handle delay, rejection, double-submit, group switching, and realtime duplication safely.
- One server-authoritative catalog controls exact Pro Group and Pro Max amounts.
- Pro Max still inherits Pro Group features.
- Free local calendars and creator-neutral task creation remain intact.
- Later phases can consume stable task identity and entitlement semantics.

## Phase Green Does Not Prove

- Google OAuth, token security, provider calls, outbox delivery, retries, reconciliation, disconnect, resubscription, cancellation, or expiry.
- External event idempotency or calendar lifecycle correctness.
- Production deployment, production RLS behavior, production payment creation, or real charge success.
- Historical order repricing.

## Blockers and Stop Conditions

- Existing SELECT RLS cannot return the inserted task row in the disposable hybrid.
- The shared pricing module cannot compile for both server and browser consumers.
- A required fix needs schema/RLS changes or a file outside the registered Phase 1 blast radius.
- A hybrid gate has no disposable environment and would require production mutation.
- Full-suite failures cannot be isolated from Phase 1 changes.

On any stop condition: keep the phase CONDITIONAL, record exact evidence in the report, and route a scoped PLAN-SUPPLEMENT request through the program coordinator. No creative fallback and no duplicated price literal are allowed.

## Phase Completion Rules

Implementation completion is not phase completion. Phase 1 finishes only after EXECUTE gates, EVL evidence, closeout report, UPDATE PROCESS audits, and archive routing all pass. Commit authority remains with the user.

## Phase Loop Progress

1. RESEARCH — load live implementation, RLS, test, and prior-phase evidence.
2. INNOVATE — produce the four-section Decision Summary.
3. PLAN-SUPPLEMENT — refresh this existing phase plan or record research-clean.
4. PVL — write the executable V1–V7 validate-contract.
5. EXECUTE — implement only the selected Phase 1 plan and pass section gates.
6. EVL — prove all exit gates and complete the report.
7. UPDATE PROCESS — run audits, archive, update context, and leave commit authority with the user.

**Validate-contract required before EXECUTE; PVL is never skipped.**

| Step | Owner | Required output | Current state |
|---|---|---|---|
| 1. RESEARCH | research agent | Current code/RLS/test evidence and prior-phase input | Pending |
| 2. INNOVATE | innovate agent | Four-section Decision Summary | Pending |
| 3. PLAN-SUPPLEMENT | plan agent | Refresh this plan or record research-clean | Pending |
| 4. PVL | validate agent | V1–V7 validate-contract with F1/F2 and hybrid procedure | Pending |
| 5. EXECUTE | execute agent | Section gates and implementation evidence | Pending |
| 6. EVL | validation/test actors | Exit-gate proof and report completion | Pending |
| 7. UPDATE PROCESS | update-process agent | Audits, archive, context update, user-controlled commit checkpoint | Pending |

Validate is never skipped. Each later phase must rerun its own RESEARCH before execution.

## Resume and Execution Handoff

- Exact execute anchor: `process/features/project_management/active/google-calendar-integration_22-07-26/phase-01-task-identity-and-pricing_PLAN_22-07-26.md`.
- Supporting phase files are the frozen SPEC, umbrella plan, blast-radius registry, and Phase 1 report named in this plan; they provide context but are not execute anchors.
- Do not give EXECUTE the umbrella plan as its implementation target.
- First read the frozen SPEC, umbrella plan, registry, this plan, and Phase 1 report.
- Re-run RESEARCH immediately before Phase 1 execution because the worktree is already dirty and owned files may drift.
- Preserve unrelated user changes in all touched files.
- Validate F1 before locking the `Promise<Task>` implementation and F2 before migrating all pricing consumers.
- EXECUTE receives only this exact selected plan path plus explicit supporting artifacts.
- No commit, push, deploy, production mutation, real charge, or live migration is authorized.
- After Phase 1 green, the program may advance to Phase 2; later phases must not edit Phase 1-owned contracts without coordinator-approved supplement.

## Validate Contract

Pending. VALIDATE must write the executable V1–V7 contract here before EXECUTE, including:

- exact Section 1 identity tests and F1 disposable-environment command/procedure;
- exact Section 2 billing tests and F2 cross-runtime proof;
- bidirectional criterion-to-gate links preserved from this plan;
- per-section Level-1 gates and final EVL gates;
- no-skip policy for hybrid identity and billing evidence;
- rollback and cleanup actions for disposable rows/orders;
- explicit confirmation that production and real-charge paths stay untouched.

## Unresolved Questions for PVL

1. What exact disposable Supabase environment and fixture setup will prove insert-return under current RLS without production access?
2. Does the frontend build accept the direct pure import from `supabase/functions/_shared/billing.ts`; if not, which newly claimed generated-client artifact will preserve one source of truth?

## Next Step

Say **ENTER VALIDATE MODE** with this exact plan path. VALIDATE is required before any EXECUTE handoff.
