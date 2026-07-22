# Phase 05 — Security and Production Readiness

**TL;DR:** Independently prove the integrated Google Calendar program is secure, resilient, observable, and safe for a controlled release. Phase 5 adds test and evidence artifacts only. It does not add product scope, repair Phase 1–4 source, deploy, charge a real payment, mutate production secrets, or run a live Google lane without separate approval.

**Program:** Google Calendar Integration  
**Umbrella plan:** `process/features/project_management/active/google-calendar-integration_22-07-26/google-calendar-integration-umbrella_PLAN_22-07-26.md`  
**Frozen SPEC:** `process/features/project_management/active/google-calendar-integration_22-07-26/google-calendar-integration_SPEC_22-07-26.md`  
**Selected plan:** `process/features/project_management/active/google-calendar-integration_22-07-26/phase-05-security-and-production-readiness_PLAN_22-07-26.md`  
**Date**: 22-07-26  
**Status**: VERIFIED  
**Phase status:** VERIFIED  
**Complexity**: COMPLEX phase inside five-phase program  
**Report destination:** `process/features/project_management/active/google-calendar-integration_22-07-26/phase-05-security-and-production-readiness_REPORT_22-07-26.md`

## Context Envelope

| Field | Value |
|---|---|
| `feature` | `project_management` |
| `phase` | `PLAN` |
| `session-goal` | Author Phase 5 integrated security and production-readiness proof without changing product scope or source. |
| `branch` | `feature_blocking` |
| `worktree` | `D:/Python/Projects/Teamfair` |
| `context-group` | `planning`, `tests`, `auth`, `database` |
| `blast-radius-packages` | Phase-5-only Vitest integration specs, `harness/phase-05/`, Phase 5 plan/report; all Phase 1–4 source is read-only |
| `active-plan` | `process/features/project_management/active/google-calendar-integration_22-07-26/phase-05-security-and-production-readiness_PLAN_22-07-26.md` |
| `test-runner` | `pnpm test | pnpm typecheck | pnpm lint | pnpm build` |
| `validate-contract` | `none — outer PVL pending` |

## Purpose

Phase 5 is the independent proof boundary for Phases 1–4. It exercises the integrated contracts across authentication, entitlement, OAuth, encrypted credential custody, asynchronous task-event sync, private read overlay, browser UX, provider behavior, logging, monitoring, release, and rollback. It records an explicit release verdict backed by reproducible evidence.

No product behavior is designed here. If a gate finds a source defect, the finding returns to the earliest phase that owns that file. Phase 5 may add only Phase-5-specific integrated tests, its namespaced evidence pack, and its report.

## Goals

1. Prove every frozen SPEC criterion AC1–AC20 through a named scenario and one valid strategy.
2. Prove denial behavior for unauthenticated, expired, wrong-owner, cross-user, ineligible, opted-out, revoked, and lapsed-entitlement states.
3. Prove OAuth state, token, encryption, service-role, disconnect-generation, and log/browser boundaries.
4. Prove queue concurrency, duplicate delivery, retry, stale lease, dead-letter, provider failure, reconnect, and lifecycle convergence.
5. Prove private overlay pagination, incremental synchronization, 410 recovery, cleanup, deduplication, and owner-only read-only behavior.
6. Prove server authority for account-scoped Pro Group at exactly 79,000 VND/month while local calendars stay free.
7. Define measurable redacted operational signals, incident thresholds, rollback steps, and release blockers.
8. Run a controlled live Google lane only after separate approval, and never substitute mocks for that evidence.

## Scope

### In scope

- New Phase-5-only Vitest integration specifications.
- Read-only execution of Phase 1–4 test gates and inspection of their reports, validate-contracts, source, logs, and evidence packs.
- Namespaced five-artifact high-risk pack under `harness/phase-05/`.
- Controlled non-production Google OAuth/provider proof after separate user approval.
- Monitoring threshold review, redaction review, release checklist, rollback rehearsal, and final verdict.
- Durable results in the Phase 5 report.

### Out of scope

- New user-facing capability, API, schema, queue, worker, OAuth, billing, or overlay behavior.
- Editing Phase 1–4 source or their owned tests.
- Production deployment, production database mutation, real billing charge, destructive migration, secret rotation, or Google Console/provider mutation without explicit approval.
- Automatically deleting provider events on disconnect.
- Multiple Google accounts, non-primary target calendars, or two-way edits of Google-owned events.
- Treating absent live-provider or OAuth verification evidence as green.

## Entry Gate

All items are mandatory before Phase 5 EXECUTE:

- [ ] Phases 1–4 are `VERIFIED`, not merely code-complete.
- [ ] Each Phase 1–4 plan has a non-placeholder validate-contract and EVL evidence.
- [ ] Phase 1 proves canonical server-owned Pro Group amount `79_000` and account-scoped entitlement truth.
- [ ] Phase 2 freezes exact OAuth scopes, exact redirect URI handling, owner binding, token encryption version, credential access, connection generation, opt-in, and disconnect contracts.
- [ ] Phase 3 freezes desired-state versioning, lease, retry/backoff/dead-letter, event identity, Teamfair marker, all-day mapping, and reconnect contracts.
- [ ] Phase 4 freezes owner-only projection, cache/cursor lifecycle, pagination, `nextSyncToken`, 410 reset, Teamfair-copy filtering, and read-only UI contracts.
- [ ] Phase 1–4 reports and evidence packs exist and are readable.
- [ ] Outer PVL confirms Phase 5 test filenames do not overlap earlier phase ownership.
- [ ] A complete Phase 5 validate-contract names exact hybrid preconditions and evidence destinations.
- [ ] Live-provider approval is obtained separately or the live lane remains an explicit release blocker.

If any prerequisite is absent, Phase 5 stays `BLOCKED` or `CONDITIONAL`; it does not recreate the missing implementation.

## Phase Completion Rules

Phase 5 reaches `VERIFIED` only when:

1. All Phase-5 automated gates pass.
2. Required Phase 1–4 regression gates pass.
3. High-risk evidence pack contains all five complete artifacts and an explicit `APPROVE` decision.
4. No Critical or High security/privacy/reliability finding remains unresolved.
5. Controlled live-provider evidence passes for the intended release cohort.
6. OAuth consent-screen audience, publishing, test-user, redirect URI, and verification state support the intended release.
7. Monitoring signals and redaction checks exist in runtime evidence, not dependency declarations alone.
8. Release and rollback checklists are complete and rehearsed in a disposable or staging target.
9. Phase report records commands, results, evidence references, regressions, blockers, and honest limits.

Status meanings:

- `PLANNED` — no Phase 5 gate has run.
- `CODE DONE` — Phase-5 tests/evidence scaffolding exists, but proof is incomplete.
- `TESTING` — automated/hybrid/probe gates are active.
- `VERIFIED` — every rule above passed with evidence.
- `BLOCKED` — a release-critical prerequisite or gate cannot be resolved within authorized scope.

## What Green Proves

- AC1–AC20 have bidirectional requirement-to-gate traceability.
- Direct client bypasses do not defeat server authentication, entitlement, ownership, opt-in, or operation checks.
- Phase 1–4 integrated behavior converges under defined races and provider failures.
- Browser, URL, response, error, and ordinary operational logs do not expose long-lived credentials or private event content.
- Owner-only Google event display, Teamfair event ownership, local-calendar availability, and fixed price semantics survive integration.
- Controlled Google evidence matches the release claim for the tested OAuth client, test owner, primary calendar, and environment.
- Operators have redacted signals and a bounded rollback path that preserves local Teamfair data.

## What Green Does Not Prove

- Unlimited Google quota, worldwide latency, or provider availability.
- Production deployment safety without a separate production change review.
- Public OAuth availability when only Google `Testing` audience/test-user evidence exists.
- Correctness for multiple Google accounts, non-primary calendars, or two-way edits.
- Deletion of provider events after disconnect has removed access.
- Absence of future Google policy/API changes.
- Any source behavior changed after the recorded commit/worktree snapshot.

## Strategy Comparison

### Seven-signal score

| Signal | Present | Evidence |
|---|---:|---|
| S1 — 3+ packages/runtime surfaces | Yes | Frontend/Vitest, Supabase DB/functions, Google OAuth/Calendar, monitoring/evidence |
| S2 — schema/API/auth surface | Yes | Consumes all three high-risk surfaces |
| S3 — 3+ viable work directions | Yes | Security, provider, queue, privacy, billing, UX |
| S4 — phase program | Yes | Phase 5 of five |
| S5 — depth requested | Yes | Full complex phase plan and AC1–AC20 matrix required |
| S6 — high-risk class | Yes | Auth, billing, schema, secrets, trust boundary, external contract |
| S7 — 5+ files | Yes | Six integrated tests, five evidence artifacts, plan/report |

**Score:** 7/7 — HIGH.

### Four-option assessment

| Strategy | Agent math | Cost guard | Fit |
|---|---:|---|---|
| Sequential | 1 agent × 7 lanes = 7 serial passes | None | Rejected: slow and weak independence for final assurance |
| Parallel subagents | 6 read-only lane agents + 1 coordinator = 7 | Not triggered; under 30 | Selected: lanes do not edit shared source and coordinator owns one verdict |
| Workflow | 1 deterministic pipeline × 7 ordered gates | Not triggered | Useful for command execution after lane findings, but weaker for independent review |
| Agent team | Up to 6 specialists × 1 round = 6 plus coordinator | Not triggered; at member limit | Reserved if lanes need mid-run conflict negotiation; unnecessary for read-only evidence collection |

**Selected strategy:** six parallel read-only lanes—security, provider, queue, privacy, billing, UX/release—with one coordinator. Planning/validation agents use the cost-efficient planning model; no code-execution model is needed for read-only lanes. Coordinator records one normalized verdict and rejects conflicting or incomplete evidence.

## Architecture Notes

Phase 5 is an assurance layer, not another runtime layer. Data flows from frozen SPEC and Phase 1–4 artifacts into test gates, evidence files, then one release decision. No Phase 5 source is imported by production code.

Established repo patterns found by scout:

- Frontend and integration tests use colocated Vitest files and `pnpm test <paths...>`.
- Supabase Edge Functions use `_shared/auth.ts`, `_shared/cors.ts`, `_shared/ratelimit.ts`, and `_shared/responses.ts`.
- `jsonOk`/`jsonError` apply `Cache-Control: no-store` and security headers.
- Current Sentry usage is build-plugin-only and PostHog is installed but no runtime capture pattern was found.
- Current billing source/tests still encode 69,000 VND, conflicting with frozen 79,000 VND requirement.

Phase 5 test/evidence-only shape matches the existing colocated test pattern. No architectural divergence is introduced. Missing runtime observability and current price drift remain release blockers until their owning phases supply proof.

## Data Flow Under Validation

1. Capture immutable test manifest: branch, commit, worktree diff summary, Phase 1–4 plan/report/contract hashes, OAuth client environment label, and test owner IDs in redacted form.
2. Exercise owner authentication and server entitlement checks before every connection, status, opt-in, refresh, sync, or disconnect action.
3. Exercise OAuth initiate/callback state, exact redirect binding, granted-scope verification, subject binding, encrypted credential storage, token refresh, revoke, and disconnect generation.
4. Exercise task changes into transactional desired state, then worker lease/version rechecks and provider adapter outcomes.
5. Exercise provider-owned primary-calendar create/update/delete/read plus Teamfair marker/identity checks.
6. Exercise overlay full pagination, incremental token, 410 owner-only reset, copy filtering, cache cleanup, and minimal read-only response.
7. Capture sanitized operational signals and validate thresholds without copying tokens or event text.
8. Aggregate automated, hybrid, probe, regression, and risk-pack evidence into one release verdict.

At every failure, local task/calendar data remains authoritative. Provider state is never used to roll back a successful Teamfair task mutation.

## Security Review — STRIDE and OWASP

| Threat | Concrete attack/failure | Mandatory proof | OWASP mapping |
|---|---|---|---|
| Spoofing | Replayed/expired OAuth state or wrong Google subject links credentials to another Teamfair owner | One-time state, owner binding, expiry, PKCE, exact redirect, subject mismatch and replay rejection | A07 Identification and Authentication Failures |
| Tampering | Client or stale worker changes owner/task/version/generation/event mapping | Server-derived owner/task, DB constraints, desired-version and generation recheck before provider call | A01 Broken Access Control, A08 Integrity Failures |
| Repudiation | Consent, retry, disconnect, or worker result cannot be reconstructed | Correlation ID plus owner/task hashes, action, attempt, provider status class, and final state; no private text/token | A09 Logging and Monitoring Failures |
| Information disclosure | Refresh/access token, subject, connection existence, event details, or provider error reaches browser/log/URL/other user | Static response/source scan, browser network/storage audit, cross-user direct request matrix, log redaction scan | A01 Broken Access Control, A02 Cryptographic Failures |
| Denial of service | Refresh spam, pagination loop, duplicate queue delivery, stale lease, or provider 429 creates runaway work | Bounded page/retry/lease policy, rate limits, jittered backoff, dead-letter, stale-version suppression, alert thresholds | A04 Insecure Design, A10 SSRF/availability boundary |
| Elevation of privilege | Creator, teammate, admin UI, expired owner, or service-role handler reads/writes another owner's state | Full denial matrix; service-role handler must resolve owner from authenticated context and never trust supplied owner ID | A01 Broken Access Control |

### Security release blockers

- Any accepted OAuth state replay, account-link mismatch, cross-user request, wrong-owner access, or service-role IDOR.
- Any refresh token or encryption material in browser storage, URL, response, client error, ordinary log, Sentry event, or PostHog event.
- Missing encryption version metadata, undocumented active key ID, or no tested dual-read/single-write key-rotation path.
- Disconnect that can leave usable local credentials, active generation, cursor/cache, or queued provider activity.
- Any change/delete of an event without verified Teamfair ownership marker plus deterministic mapping.
- Any unresolved Critical/High dependency or secret finding.

## Risk Predictions

**Verdict:** CAUTION. Read-only validation is safe, but release remains blocked until live-provider, OAuth verification, observability, and high-risk evidence are real.

| Persona | Prediction | Required mitigation |
|---|---|---|
| Architect | Separate phase contracts may individually pass while integrated generation/version/ownership semantics disagree. | Build one cross-phase contract manifest and fail on any incompatible field, state, or ownership rule. |
| Security | Public callback, service-role access, logs, or owner projections can bypass otherwise-correct UI boundaries. | Test direct requests at server boundary, replay/mismatch paths, response minimization, and redaction. |
| Performance | Duplicate deliveries, expired leases, pagination loops, and provider backoff can amplify quota usage. | Concurrency gates, bounded page count, jittered capped retries, stale suppression, dead-letter alerts. |
| UX | Safe failures can still trap users in false connected/synced states or break free local calendars. | Test clear retry/reconnect/upgrade states and local-calendar regression for every external failure. |
| Devil's Advocate | Mocks can make every gate green while redirect registration, refresh tokens, revocation, exclusive all-day end, or 410 behavior fails live. | Controlled live Google lane is a release blocker, never replaced by fixture success. |

## Highest-Risk Scenario Set

### R1 — OAuth, credential, and disconnect race

- Two callbacks reuse the same state; only first may consume it.
- Callback arrives after initiator session expires; state-bound server transaction decides safely without trusting browser owner input.
- Signed-in user and state owner differ; no connection or existence detail is returned.
- Google subject changes or wrong account grants scopes; link is rejected or requires explicit clean replacement per Phase 2 contract.
- Refresh token is absent on repeat consent; existing valid credential is not silently erased.
- Disconnect races token refresh, queue lease, overlay refresh, and callback; generation barrier makes every stale operation a no-op.
- Encryption key rotates between write and read; current writer uses newest key while authorized old-key reads remain bounded and observable.

### R2 — Queue, provider, and task lifecycle convergence

- Two workers lease same logical task; only one current lease/version may commit provider mapping.
- Lease expires after provider success but before local commit; retry reconciles deterministic identity without duplicate.
- Create, update, reassign, date removal, delete, and reconnect arrive out of order; final provider state equals latest authoritative task state.
- Provider returns 429, 500, timeout, 401/revoked, 404, or ambiguous transport failure; retry/dead-letter classification is bounded and local task remains successful.
- Free creator assigns to entitled opted-in assignee; sync proceeds without revealing assignee state.
- Entitlement or opt-in lapses after enqueue; worker recheck suppresses provider call.
- Non-Teamfair event with similar title/description exists; ownership marker prevents modification.
- Date-only task maps to all-day start date and exclusive next-day end.

### R3 — Private overlay and incremental-sync recovery

- Multiple pages with repeated/cancelled events converge without duplicates.
- Incremental refresh uses only server-held `nextSyncToken`; token never reaches browser.
- Invalid/expired sync token returns 410; only that owner's cache/cursor resets before bounded full resync.
- Partial page failure does not publish half-applied cache or remove local Teamfair calendar data.
- Concurrent open/manual refresh is coalesced or versioned; stale response cannot overwrite newer cache.
- Teamfair-created Google copies are filtered by private marker to avoid duplicate display beside local tasks.
- Wrong owner, direct ID guess, service-role request, and expired session receive non-enumerating denial.
- Disconnect clears owner cache/cursor; subsequent refresh makes no provider call until clean reconnect, consent, entitlement, and opt-in.

## Immutable Cross-Phase Contracts Consumed

### Phase 1 — task identity and pricing

- `supabase/functions/_shared/billing.ts` is canonical pure billing truth.
- Pro Group is exactly `79_000` VND/month; Pro Max remains `129_000` and inherits Pro Group features.
- Browser-supplied amount is ignored; server selects amount from plan ID.
- Entitlement is account-scoped through `billing_plan_for_user` / `get_my_entitlements`.
- Free creator does not control eligible assignee sync; local calendars remain free.

### Phase 2 — connection and credential custody

- Exact OAuth scopes and redirect contract come from Phase 2 validate-contract; Phase 5 must not broaden them.
- Frozen least scopes are `openid`, `email`, `https://www.googleapis.com/auth/calendar.events.owned`, and `https://www.googleapis.com/auth/calendar.events.readonly`. Phase 2 uses `email` only to satisfy Google's current OIDC requirement alongside `openid`, validates stable `sub`, stores only a SHA-256 subject hash, and discards/never returns email. `profile`, broad `calendar`, broad `calendar.events`, and `include_granted_scopes` are forbidden.
- Callback is transport-public but state-authorized: one-time short-lived digest, owner binding, PKCE verifier, exact redirect URI, granted-scope verification, and Google subject binding.
- Browser projection contains safe status only; credentials remain encrypted/server-only with version metadata.
- Disconnect stays available after entitlement lapse, increments generation, best-effort revokes, and always removes local credential material.

### Phase 3 — task write sync

- One coalesced desired-state row per canonical task identity; Teamfair task transaction never waits for Google.
- Worker rechecks current desired version, owner entitlement, opt-in, connection generation, task eligibility, and lease before every provider call.
- Deterministic provider event identity, server mapping, and private extended properties prove Teamfair ownership.
- Date-only task uses exclusive next-day all-day end.
- Queue identity is `(task_id, owner_id)` with `desired_version`/`processed_version` compare-and-set. Worker processes batches of 10 sequentially, uses a 300-second row lease, a 90-second Phase-2 owner-operation lease around final preflight/token refresh/provider calls, and a 15-second HTTP deadline.
- Retry starts at 30 seconds with exponential deterministic ±20% jitter, caps at 1 hour, and dead-letters after 8 retryable attempts. Entitlement/opt-in/disconnected/generation blocks do not consume attempts; triggers plus a 15-minute safety sweep reawaken eligible work.

### Phase 4 — private read overlay

- Browser request is exactly `rangeStart` (inclusive YYYY-MM-DD), `rangeEndExclusive` (exclusive, later than start, at most 42 days), and `reason` (`open`, `navigate`, or `manual`); unknown fields are rejected. Owner/JWT, connection generation, sync token, page token, and force-full controls are server-only.
- Browser event projection is exactly provider event ID, title, same-variant start/end (`date` or `dateTime`), `allDay`, `readOnly: true`, and `source: google`; attendees/email/description/location/conference/organizer/html link/tokens/provider body/task marker are excluded.
- Response states are `ready`, bounded-cache `stale`, `upgrade_required`, `reconnect_required`, or `retryable_error` with Phase-4-defined sanitized metadata.
- Full provider fetch uses `primary`, `singleEvents=true`, `showDeleted=false`, 250 records/page, at most 20 pages/5,000 records, and 10-second page deadline. Cache commits only after full chain; final-page `nextSyncToken` is server-only.
- 410 clears current owner + generation + range cache/cursor, then performs one non-recursive full retry. Cache uses owner + generation + range keys, atomic compare-and-set, post-fetch entitlement/status/opt-in/generation recheck, and disconnect/generation purge.
- Teamfair-created copies are filtered to prevent duplicate display beside local Teamfair tasks.
- Disconnect cleanup removes overlay cache/cursor without deleting local calendar data.

Any conflict between these contracts is a release blocker routed to the earliest owning phase.

## Authorization Denial Matrix

| Actor/state | Connection/status | Opt-in/disconnect | Task write sync | Overlay read/refresh | Expected result |
|---|---|---|---|---|---|
| Unauthenticated | Deny | Deny | No provider call | Deny | 401/generic; no existence detail |
| Expired/invalid session | Deny | Deny | No provider call | Deny | 401/generic; no state mutation |
| Authenticated wrong owner | Deny | Deny | Cannot target owner | Deny | 403/404 generic per frozen contract |
| Cross-user direct request | Deny | Deny | Cannot supply assignee Google state | Deny | Same non-enumerating shape for exists/missing |
| Free calendar owner | Upgrade/status-safe only | Disconnect cleanup allowed; enable denied | Suppress before provider call | Google overlay denied; local calendar allowed | No paid behavior; local data intact |
| Free creator, Pro assignee | Creator sees no private state | Creator cannot opt in | Eligible sync proceeds for assignee | Creator cannot read assignee overlay | AC3/AC5 boundary preserved |
| Entitlement lapse | No new enable | Opt-out/disconnect allowed | Stale/queued work suppressed | No provider fetch; local calendar allowed | Safe attention/upgrade state |
| Opted out | Status safe | Re-opt-in owner-only | No provider write | Phase 4 contract decides read behavior; no task sync | No future task sync |
| Revoked credentials | Reconnect guidance | Disconnect cleanup allowed | No provider write; classified failure | No fetch; retry/reconnect state | No local data loss |

## Test Coverage Plan

Only `process/context/tests/all-tests.md` exists in the current test routing chain. It documents Vitest/jsdom plus `pnpm test`, `pnpm typecheck`, and `pnpm lint`; no browser E2E or live-provider runner exists. Existing blast-radius tests are colocated under `src/`; existing Supabase function test uses Deno naming but is not registered by the test router. Therefore Phase 5 creates Vitest integration specs for deterministic cross-phase proof and keeps browser/provider/runtime proof Hybrid or Agent-Probe.

### Area A — authorization, OAuth, token custody, service-role boundary

| Tier | Scenario | Command / steps | What it proves | What it does not prove |
|---|---|---|---|---|
| Fully-Automated | `calendar-server-authorization-denial-matrix`, OAuth replay/mismatch, token response/URL/source redaction | `pnpm test src/lib/googleCalendarPhase05Authorization.integration.test.ts` | AC1–AC3, AC14, AC16–AC18, AC20 deterministic denial and projection contracts | Real Google Console registration, real browser network, real refresh issuance |
| Hybrid | Controlled OAuth authorize/callback/refresh/revoke/disconnect with approved non-production client and test owner | Follow `## Controlled Live Google Lane`; capture redacted request IDs, screenshots, DB state classes, and provider event IDs | Exact redirect, actual consent, scopes, subject, refresh, revocation, disconnect behavior | Public audience beyond approved test cohort |
| Agent-Probe | Browser DevTools storage/network/history plus redacted Supabase/Sentry/PostHog inspection | Inspect one successful, denied, replayed, revoked, and disconnected flow | Human-observable absence of tokens/private details in browser and operations | Future telemetry configuration drift |
| Known-Gap | None accepted for release | — | — | Missing live OAuth evidence remains blocker, not passable gap |

### Area B — account-scoped entitlement and local calendars

| Tier | Scenario | Command / steps | What it proves | What it does not prove |
|---|---|---|---|---|
| Fully-Automated | 79,000 server authority; owner/creator matrix; lapse; local calendar free | `pnpm test src/lib/billing.test.ts src/lib/googleCalendarPhase05Billing.integration.test.ts` | AC4–AC6 and server/client contract consistency | Live paid activation or real charge |
| Hybrid | Disposable Supabase entitlement/order projection using Phase 1 gate | Run exact Phase 1 hybrid gate from its validate-contract; verify order row amount and function authorization | Database/Edge Function integration for account-scoped truth | Production migration/deploy/payment provider |
| Agent-Probe | Inspect upgrade, lapse, free creator, and free local-calendar UX | Use two owners and one creator in disposable environment | Clear, non-leaking user states | Accessibility beyond tested views |
| Known-Gap | None accepted for developed entitlement behavior | — | — | Current 69,000 evidence blocks release until Phase 1 is green |

### Area C — queue, retries, provider failures, lifecycle convergence

| Tier | Scenario | Command / steps | What it proves | What it does not prove |
|---|---|---|---|---|
| Fully-Automated | Concurrency, duplicate delivery, stale lease, retries/backoff/dead-letter, generation, 429/5xx/timeout adapter outcomes | `pnpm test src/lib/googleCalendarPhase05Resilience.integration.test.ts src/lib/googleCalendarPhase05ProviderContract.integration.test.ts` | AC7–AC11, AC15, AC19 deterministic final state and no local-task coupling | Actual Google quota enforcement or network behavior |
| Hybrid | Controlled primary-calendar create/update/delete/read, revocation, reconnect, and bounded failure recovery | Follow provider steps in live lane; use disposable task/event IDs and explicit cleanup | Actual primary-calendar semantics and idempotent lifecycle | High-volume quota/load limits |
| Agent-Probe | Inspect queue depth, attempt, next-attempt, lease, desired version, generation, dead-letter, mapping, and correlation signals during staged failures | Compare sanitized operational records before/after each failure | Operators can diagnose and recover without secrets/private text | Long-term production traffic pattern |
| Known-Gap | Deliberate real quota exhaustion is not authorized | — | — | Stubbed 429 handling plus Console quota inspection do not prove sustained live-quota behavior; public release remains conditional if policy requires live proof |

### Area D — private read overlay, pagination, sync token, 410, cleanup

| Tier | Scenario | Command / steps | What it proves | What it does not prove |
|---|---|---|---|---|
| Fully-Automated | Owner isolation, minimal response, pagination, incremental token, 410 owner-only reset, atomic cache, disconnect cleanup, Teamfair-copy dedup | `pnpm test src/lib/googleCalendarPhase05Privacy.integration.test.ts` | AC12–AC14, AC18–AC20 privacy and recovery contracts | Actual Google pagination/token lifecycle |
| Hybrid | Approved test owner: two-page list, incremental change, invalid token 410/full resync, disconnect refresh cleanup | Follow overlay steps in live lane using disposable non-production cache and primary calendar | Actual list/page/sync/revoke behavior and private overlay projection | Cross-region/provider outage behavior |
| Agent-Probe | Two-browser/two-owner direct-request and UI inspection | Verify owner A event never appears for owner B and imported event has no Teamfair write action | Visible privacy/read-only boundary | Formal side-channel resistance |
| Known-Gap | None accepted for owner isolation | — | — | Unavailable provider lane remains blocker |

### Area E — UX, observability, release, rollback, cross-phase E2E

| Tier | Scenario | Command / steps | What it proves | What it does not prove |
|---|---|---|---|---|
| Fully-Automated | Consent separation, upgrade/lapse/reconnect/retry states, local calendar regression, no imported-event write action, redaction/static signal schema | `pnpm test src/pages/GoogleCalendarPhase05E2E.test.tsx src/lib/googleCalendarPhase05ReleaseReadiness.integration.test.ts` | AC1, AC4, AC6, AC12–AC13, AC17–AC19 integrated UI/contract behavior | Real browser OAuth redirects, real monitoring delivery |
| Fully-Automated | Full Phase 5 focused suite | `pnpm test src/lib/googleCalendarPhase05Authorization.integration.test.ts src/lib/googleCalendarPhase05Billing.integration.test.ts src/lib/googleCalendarPhase05Resilience.integration.test.ts src/lib/googleCalendarPhase05ProviderContract.integration.test.ts src/lib/googleCalendarPhase05Privacy.integration.test.ts src/lib/googleCalendarPhase05ReleaseReadiness.integration.test.ts src/pages/GoogleCalendarPhase05E2E.test.tsx` | All deterministic Phase 5 scenarios together | Live provider/runtime behavior |
| Fully-Automated | Full regression/build gates | Run sequentially: `pnpm test`, then `pnpm typecheck`, then `pnpm lint`, then `pnpm build`, then `git diff --check` | No known repo regression, typed/buildable integration, clean diff | Production runtime/configuration |
| Hybrid | Staging rollback rehearsal plus controlled live provider lane | Complete `## Release and Rollback Checklist`; record timestamps and sanitized outcomes | Operators can disable provider lanes while preserving local Teamfair data | Production deployment itself |
| Agent-Probe | Sentry/PostHog/Supabase operational evidence and accessibility/privacy review | Inspect configured dashboards/logs for required events, thresholds, redaction, and usable states | Monitoring exists and user states are understandable | Guaranteed alert delivery during future outage |
| Known-Gap | No real browser automation runner exists in current test context | — | — | Browser-only checks stay Hybrid/Agent-Probe; create backlog test-infra stub and keep browser release gate CONDITIONAL until automated runner exists |

## Test Infra Improvement Notes

- Add a documented real-browser E2E runner before public release so OAuth redirects, browser storage/network isolation, and two-user privacy can move from Hybrid/Agent-Probe toward Fully-Automated.
- Register an exact Deno/Supabase Edge Function test command in `process/context/tests/all-tests.md`; until then, Phase 1–4 validate-contracts are the authority for their function tests.
- Add disposable local/staging Supabase fixtures for two owners, free creator, Pro assignee, expired entitlement, revoked credential, stale generation, queued work, cache, and 410 recovery.
- Add a deterministic fake Google adapter with scripted 401/404/410/429/5xx/timeout/ambiguous-success sequences; it proves recovery logic but never replaces live Google evidence.
- Add redaction assertions at the telemetry boundary so token, authorization code, PKCE verifier, encryption key/ciphertext, private summary/description, and raw provider body fail tests if serialized.
- Add a controlled provider evidence harness that records only correlation IDs, hashed owner/task IDs, provider event IDs, status classes, timestamps, and cleanup receipts.
- Create a backlog test-infra stub for real-browser automation if it cannot be added within Phase 5. The missing browser runner keeps the browser gate CONDITIONAL; it cannot be used as a terminal `Known-Gap` pass.

## SPEC Acceptance Criteria Traceability

| Criterion | Locked outcome | proven by: | strategy: |
|---|---|---|---|
| AC1 | Calendar consent is separate from Teamfair sign-in | `calendar-consent-separated-from-login` | Fully-Automated |
| AC2 | Connection alone does not sync; owner opt-in gates writes and opt-out stops future sync | `connected-user-opt-in-gates-task-sync` | Fully-Automated |
| AC3 | Creator cannot enable assignee calendar access | `creator-cannot-enable-assignee-calendar` | Fully-Automated |
| AC4 | Calendar owner needs account-scoped Pro Group at exactly 79,000 VND/month | `calendar-owner-pro-group-entitlement-matrix` | Fully-Automated |
| AC5 | Free creator can trigger eligible sync for Pro opted-in assignee | `free-creator-pro-assignee-sync` | Fully-Automated |
| AC6 | Local calendars remain free | `free-user-local-calendar-access` | Fully-Automated |
| AC7 | Eligible assignment creates one primary-calendar Teamfair event | `eligible-assignment-creates-single-primary-calendar-event` | Hybrid |
| AC8 | Task change updates same provider event | `task-change-updates-existing-google-event` | Hybrid |
| AC9 | Delete/ineligibility removes Teamfair-owned provider event | `task-removal-deletes-teamfair-owned-event` | Hybrid |
| AC10 | Non-Teamfair Google events are unchanged | `non-teamfair-google-events-remain-unchanged` | Hybrid |
| AC11 | Retry/reconnect/repeated delivery remains idempotent | `calendar-sync-idempotency-retry-matrix` | Fully-Automated |
| AC12 | Owner sees private read-only overlay on open/refresh | `global-calendar-private-read-only-refresh` | Fully-Automated |
| AC13 | Imported Google event has no Teamfair write action | `imported-google-event-has-no-write-actions` | Fully-Automated |
| AC14 | Disconnect revokes/invalidates and clears local credential/sync/cache state | `disconnect-revokes-access-and-clears-state` | Hybrid |
| AC15 | Reconnect restores sync without duplicates | `reconnect-restores-without-duplicates` | Hybrid |
| AC16 | Server denies missing auth/entitlement/ownership/action | `calendar-server-authorization-denial-matrix` | Fully-Automated |
| AC17 | Refresh token never reaches browser-visible surface | `refresh-token-browser-exposure-audit` | Fully-Automated |
| AC18 | Denied/revoked/expired credentials produce safe reconnect state | `google-consent-credential-failure-matrix` | Hybrid |
| AC19 | Temporary provider failure is retryable and preserves local data/idempotency | `google-temporary-failure-recovery` | Fully-Automated |
| AC20 | Cross-user access is denied without existence leak | `google-calendar-cross-user-isolation` | Fully-Automated |

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `calendar-consent-separated-from-login` — sign-in alone yields no Calendar scope/connection | Fully-Automated | AC1 |
| `connected-user-opt-in-gates-task-sync` — connected/not-opted-in and opted-out yield no provider write | Fully-Automated | AC2 |
| `creator-cannot-enable-assignee-calendar` — creator direct/UI attempts denied without private state | Fully-Automated | AC3 |
| `calendar-owner-pro-group-entitlement-matrix` — exact 79,000 server truth, owner scope, lapse | Fully-Automated | AC4 |
| `free-creator-pro-assignee-sync` — creator tier ignored, assignee eligibility controls | Fully-Automated | AC5 |
| `free-user-local-calendar-access` — local calendar survives every paid/provider denial | Fully-Automated | AC6 |
| `eligible-assignment-creates-single-primary-calendar-event` — approved live primary insert/read | Hybrid | AC7 |
| `task-change-updates-existing-google-event` — same live event ID after update | Hybrid | AC8 |
| `task-removal-deletes-teamfair-owned-event` — live Teamfair event absent after delete/ineligibility | Hybrid | AC9 |
| `non-teamfair-google-events-remain-unchanged` — control event hash/ID unchanged | Hybrid | AC10 |
| `calendar-sync-idempotency-retry-matrix` — duplicate/race/reconnect converges on one mapping/event | Fully-Automated | AC11 |
| `global-calendar-private-read-only-refresh` — owner-only projection, open/manual refresh | Fully-Automated | AC12 |
| `imported-google-event-has-no-write-actions` — no UI/API mutation path | Fully-Automated | AC13 |
| `disconnect-revokes-access-and-clears-state` — approved revoke plus local cleanup/generation proof | Hybrid | AC14 |
| `reconnect-restores-without-duplicates` — approved live reconnect keeps deterministic event | Hybrid | AC15 |
| `calendar-server-authorization-denial-matrix` — all actors/states in denial table | Fully-Automated | AC16 |
| `refresh-token-browser-exposure-audit` — response/URL/source/browser/log redaction | Fully-Automated | AC17 |
| `google-consent-credential-failure-matrix` — deny/revoke/expire safe state and reconnect guidance | Hybrid | AC18 |
| `google-temporary-failure-recovery` — 429/5xx/timeout retry, local preservation, no duplicate | Fully-Automated | AC19 |
| `google-calendar-cross-user-isolation` — two-owner direct request and non-enumeration matrix | Fully-Automated | AC20 |

## Controlled Live Google Lane

This lane is manual-first Hybrid evidence. It is never run in PLAN. It requires separate user approval because it changes external test-account/provider state.

### Preconditions

- [ ] Non-production Google Cloud project and OAuth client are identified in the validate-contract.
- [ ] Intended audience is explicit: Google `Testing` with named test users, internal organization-only, or external published/verified.
- [ ] Exact HTTPS server callback URI is copied from Phase 2 runtime configuration and exactly matches one authorized redirect URI; no wildcard or client-computed alternate is accepted.
- [ ] Phase 2 final scope set exactly matches Google Console and consent screen: `openid`, `email`, `https://www.googleapis.com/auth/calendar.events.owned`, and `https://www.googleapis.com/auth/calendar.events.readonly`. `email` is used only for the OIDC request requirement and is discarded; `profile`, broad `calendar`, broad `calendar.events`, and `include_granted_scopes` are absent.
- [ ] Sensitive-scope verification status supports intended audience. A `Testing` client can prove only named test-user behavior, not public launch.
- [ ] Dedicated disposable Google test owner and primary calendar are used; no personal/production calendar.
- [ ] Teamfair test environment uses disposable Supabase data and non-production secrets.
- [ ] Evidence capture redacts authorization code, state, PKCE verifier, access/refresh token, client secret, encryption data, event title/description, and personal email.
- [ ] Cleanup owner, deadline, and stop conditions are assigned.

### Exact controlled sequence

1. Sign in to Teamfair without calendar consent; prove no Calendar scope/connection and local calendar works.
2. Start dedicated authorize flow; record exact redirect URI and requested scopes before leaving Teamfair.
3. Complete consent as designated Google test owner; prove one-time state consumption, required granted scopes, subject hash binding, encrypted server-only refresh credential, and generic browser redirect outcome.
4. Replay callback and mismatch state/owner; prove denial and no credential/state mutation.
5. Keep connected but not opted in; create eligible task and prove no provider event.
6. Opt in as entitled owner. From a free creator, assign a scheduled task to test owner; prove exactly one event in `primary` and record provider event ID plus Teamfair marker only.
7. Update title/date and change date-only all-day task; prove same event ID and exclusive next-day end.
8. Reassign/remove date/delete; prove Teamfair-owned event lifecycle and untouched control event that lacks Teamfair marker.
9. Repeat delivery and reconnect sequence; prove one mapped event and no duplicate.
10. Create/read at least two disposable provider events with page size forced low enough for two pages; prove all pages, owner-only minimal projection, and Teamfair-copy dedup.
11. Capture `nextSyncToken`, change one event, run incremental refresh, and prove only changed state merges.
12. In disposable test cache only, use an invalid/expired sync token; prove 410 clears only that owner's overlay cache/cursor and triggers bounded full resync.
13. Revoke Google access, then attempt write/read; prove safe revoked state, no local task/calendar loss, reconnect guidance, and bounded retry classification.
14. Disconnect while queue and overlay work are staged; prove generation invalidates stale work, credential/sync/cache cleanup completes, and no future provider call occurs.
15. Reconnect/consent/opt in; prove eligible sync returns without duplicate.
16. Inspect Google Console quota/errors and runtime signals. Do not intentionally exhaust quota. Actual 429/5xx/timeout behavior must have deterministic adapter proof; if policy requires real occurrence and none is safely available, verdict remains CONDITIONAL.
17. Delete only disposable provider events created by this lane and remove disposable Teamfair records; record cleanup receipts without secrets/private content.

### Live-lane verdict rules

- `PASS — controlled cohort only`: every step passes and OAuth client state supports only named test users.
- `PASS — intended release cohort`: every step passes and consent/publishing/verification state supports intended audience.
- `CONDITIONAL`: controlled test-user flow passes but public verification, safe quota-failure evidence, real-browser automation, or monitoring delivery remains incomplete.
- `BLOCKED`: lane unavailable, redirect/scope mismatch, no refresh token, replay accepted, revocation/cleanup fails, wrong calendar touched, duplicate created, unrelated event changed, cross-user leak, or any token/private data exposure.

## Monitoring and Operational Signals

All signals contain only correlation ID, action, hashed owner/task ID, connection generation, desired version, attempt, lease age, provider status class, duration, and result class. They must never contain tokens, authorization codes, state, PKCE verifier, client secret, encryption key/ciphertext, Google subject, raw provider body, calendar/event title/description/location/attendees, or user email.

| Signal | Threshold | Severity | Required operator action |
|---|---|---|---|
| Unauthorized/cross-user action accepted | Any occurrence | P0 | Disable affected Google lane; preserve evidence; investigate ownership/service-role boundary |
| Sensitive-field redaction violation | Any occurrence | P0 | Stop release; revoke affected test credentials; purge telemetry within policy; rotate exposed test secret if needed |
| Teamfair ownership violation or unrelated event mutation | Any occurrence | P0 | Pause worker; disable writes; preserve mappings; do not mass-delete provider events |
| Duplicate provider event for one task identity | Any confirmed occurrence | P1 | Pause worker claims; reconcile mapping; fix owning Phase 3; replay latest desired state only |
| Disconnect leaves credential row or provider work after generation change | Any occurrence | P0 | Disable connection/write/read lanes; revoke test credential; route to Phase 2/3/4 owner |
| Oldest ready queue item | More than 5 minutes for 10 consecutive minutes | P1 | Inspect worker health, provider status, lease and retry schedule |
| Dead-letter count | At least 1 new item in 5 minutes | P1 | Triage status class and owning task; no automatic destructive replay |
| Stale lease recovery | More than 5 per hour or same item twice | P2 | Inspect worker concurrency/termination and lease duration |
| Provider 429 ratio | At least 5% over 15 minutes with at least 20 calls | P2 | Reduce concurrency, honor Retry-After/backoff, inspect quota; never retry storm |
| Provider 5xx/timeout ratio | At least 10% over 10 minutes with at least 20 calls | P2 | Enter degraded mode, preserve desired state/cache, show retryable status |
| OAuth internal callback failure | At least 5 failures in 10 minutes, excluding user denial/cancel | P1 | Inspect redirect, state expiry, scope and token exchange without logging payloads |
| Overlay refresh failure | Three consecutive owner refresh failures or cache age over 15 minutes after manual refresh | P2 | Show stale/retry state; inspect token, pagination, cursor and provider health |
| 410 full resync | More than 2 per owner/hour or 5 owners/15 minutes | P2 | Inspect token persistence/query-shape drift; bound resync work |
| Entitlement/price mismatch | Any response/order not exactly 79,000 for Pro Group or creator tier changes assignee decision | P0 | Disable new Google purchase/enable path; route to Phase 1 |

Sentry/PostHog packages alone are not evidence. Phase 5 requires actual redacted runtime event capture and alert/dashboard inspection, or release remains CONDITIONAL/BLOCKED.

## Release and Rollback Checklist

### Release prerequisites

- [ ] AC1–AC20 traceability table and Verification Evidence table are complete.
- [ ] Phases 1–4 are VERIFIED with regression evidence.
- [ ] Current checkout contains no 69,000 Pro Group authority in active source/test/copy; server and display are exactly 79,000.
- [ ] OAuth audience, publishing, test-user, redirect URI, scopes, and verification status match intended release.
- [ ] Controlled live Google lane has matching PASS verdict.
- [ ] Five Phase 5 risk artifacts validate and review decision is `APPROVE`.
- [ ] No Critical/High open finding, token leak, cross-user leak, ownership violation, duplicate, or cleanup failure.
- [ ] Queue, provider, overlay, billing, UX, full regression, typecheck, lint, build, and diff gates pass.
- [ ] Monitoring signals reach configured runtime destination with sensitive-field redaction.
- [ ] Operators can independently disable new connection, provider writes, and provider reads while preserving local calendars/tasks.
- [ ] Staging rollback rehearsal passes and is recorded.

### Rollback rehearsal

1. Stop accepting new Google connection/opt-in work through the owning Phase 2 operational switch.
2. Pause new Phase 3 worker claims without deleting desired-state rows or local tasks.
3. Disable Phase 4 provider refresh while retaining local calendar rendering.
4. Let active leases expire or terminate through documented safe boundary; do not force overlapping workers.
5. Preserve queue/mapping/cache evidence; never bulk-delete unrelated Google events.
6. Revoke only affected test credentials when credential exposure/revocation incident demands it.
7. Confirm local task creation/update/delete and local Global Calendar remain available.
8. Fix the earliest owning phase, re-run its PVL/EVL, then re-run all Phase 5 gates before re-enable.

If independent lane disablement does not exist, release is blocked and the requirement returns to the owning phase. Phase 5 does not add the switch itself.

## Failure Modes and Routing

| Failure | Phase 5 action | Owning route |
|---|---|---|
| Price remains 69,000 or browser amount is authoritative | Block release; record evidence | Phase 1 supplement |
| OAuth state/scope/credential/owner defect | Stop live lane; revoke test credential if needed | Phase 2 supplement |
| Queue race, duplicate, retry, lease, mapping, marker, lifecycle defect | Pause validation write lane; preserve desired state/mapping | Phase 3 supplement |
| Overlay privacy, pagination, token, 410, cache, dedup, read-only defect | Stop overlay lane; preserve local calendar | Phase 4 supplement |
| Shared contract mismatch across phases | Coordinator names earliest prerequisite owner | Earliest owning phase |
| Missing monitoring/redaction implementation | Do not claim readiness | Phase owning runtime emission point |
| Live provider or OAuth verification unavailable | Keep release gate CONDITIONAL/BLOCKED; never mark Known-Gap green | Operational/provider follow-up |
| Phase-5 test/evidence defect only | Fix within Phase 5 and rerun | Phase 5 |

## High-Risk Evidence Pack

EXECUTE creates exactly these namespaced files:

- `harness/phase-05/risk-gate.json`
- `harness/phase-05/context-snippets.json`
- `harness/phase-05/verification.json`
- `harness/phase-05/review-decision.json`
- `harness/phase-05/adversarial-validation.json`

Required content:

- `risk-gate.json`: risk classes `auth/identity`, `billing/credits`, `schema/data`, `public/external contract`, `runtime/provider`, and `permission/secret/trust-boundary`; `mustStopBeforeFinalize: true`.
- `context-snippets.json`: exact file/line excerpts for every Phase 1–4 security boundary and Phase 5 test/evidence surface; secrets/private data removed.
- `verification.json`: every automated/hybrid/probe/regression step with command, result, evidence reference, and honest skip/block reason.
- `review-decision.json`: explicit `APPROVE` or `REJECT`, rationale, reviewer, timestamp, intended release cohort.
- `adversarial-validation.json`: every R1–R3 and denial-matrix scenario, `ruled_out` boolean, rationale, and evidence link.

Missing/incomplete pack or non-APPROVE decision blocks finalization. Earlier `harness/phase-N/` packs are read-only inputs.

## Touchpoints

### Phase 5 write ownership

- `src/lib/googleCalendarPhase05Authorization.integration.test.ts`
- `src/lib/googleCalendarPhase05Billing.integration.test.ts`
- `src/lib/googleCalendarPhase05Resilience.integration.test.ts`
- `src/lib/googleCalendarPhase05ProviderContract.integration.test.ts`
- `src/lib/googleCalendarPhase05Privacy.integration.test.ts`
- `src/lib/googleCalendarPhase05ReleaseReadiness.integration.test.ts`
- `src/pages/GoogleCalendarPhase05E2E.test.tsx`
- `process/features/project_management/active/google-calendar-integration_22-07-26/harness/phase-05/risk-gate.json`
- `process/features/project_management/active/google-calendar-integration_22-07-26/harness/phase-05/context-snippets.json`
- `process/features/project_management/active/google-calendar-integration_22-07-26/harness/phase-05/verification.json`
- `process/features/project_management/active/google-calendar-integration_22-07-26/harness/phase-05/review-decision.json`
- `process/features/project_management/active/google-calendar-integration_22-07-26/harness/phase-05/adversarial-validation.json`
- `process/features/project_management/active/google-calendar-integration_22-07-26/phase-05-security-and-production-readiness_REPORT_22-07-26.md`

### Read-only validation dependencies

- Phase 1 billing/task-identity source, tests, plan, report, validate-contract, and evidence.
- Phase 2 connection/OAuth/crypto/credential source, tests, plan, report, validate-contract, and evidence.
- Phase 3 migration/worker/provider/ownership source, tests, plan, report, validate-contract, and evidence.
- Phase 4 migration/overlay/provider/UI source, tests, plan, report, validate-contract, and evidence.
- `supabase/functions/_shared/auth.ts`, `_shared/cors.ts`, `_shared/ratelimit.ts`, `_shared/responses.ts`.
- `process/context/tests/all-tests.md`, package scripts, Vite/Sentry config, and current observability integration points.

Any required edit to a read-only dependency stops that lane and routes to its owner.

## Public Contracts

Phase 5 adds no production public contract. It proves these frozen contracts:

- Calendar owner controls consent, connection, opt-in/out, status, overlay, and disconnect.
- Pro Group is account-scoped to owner at exactly 79,000 VND/month; creator may be free; local calendars remain free.
- Google calls are server-side, least-scope, owner/entitlement/action checked, and primary-calendar-only.
- Refresh tokens and encryption material never reach browser-visible surfaces.
- Task save never waits for Google; desired state and retries converge without duplicate.
- Teamfair modifies only events carrying verified Teamfair ownership identity/marker.
- Imported events are owner-only, minimal, read-only, and deduplicated against Teamfair copies.
- Disconnect best-effort revokes and always clears local credentials/sync/cache state; it does not promise provider-event deletion.
- Failures are retryable/safe and never corrupt local Teamfair task/calendar data.

## Blast Radius

**Risk class:** High — auth/identity, billing, schema/data, external API, runtime/provider, secrets/trust boundary.

**Writes:** seven Phase-5-only test files, five namespaced evidence JSON files, one phase report, and this plan.  
**Reads:** every Phase 1–4 implementation and proof surface.  
**Runtime surfaces exercised:** Vitest/jsdom, disposable Supabase/Edge Functions where prior contracts define it, Google OAuth, Google Calendar primary events, Sentry/PostHog/Supabase operational records.  
**Production mutation:** none authorized.

## Potential Blast Radius Conflicts

No unresolved write overlap after coordinator reconciliation:

- Phase 1 owns billing/task identity.
- Phase 2 owns OAuth/credential/connection and `harness/phase-02/`.
- Phase 3 owns queue/worker/write-sync/marker.
- Phase 4 owns overlay/UI and `harness/phase-04/`.
- Phase 5 owns only Phase-5-named integrated tests, `harness/phase-05/`, and Phase 5 report.

If a Phase-5 test requires changing an earlier owned test/helper, that edit is reassigned to the earliest prerequisite phase.

## Implementation Checklist

### A — Freeze test target and prerequisite evidence

- [ ] A1. Record branch, commit, dirty-worktree summary, exact plan/report paths, and Phase 1–4 plan/report/validate-contract status in the Phase 5 report.
- [ ] A2. Read Phase 1–4 reports in dependency order and build a cross-phase contract manifest covering identity, price, entitlement, scopes, redirect, credential version, generation, queue policy, event marker, overlay projection, and cleanup.
- [ ] A3. Confirm all Phase 5 write paths match registry ownership; stop and request coordinator reassignment for any overlap.
- [ ] A4. Run each Phase 1–4 exact automated exit gate from its validate-contract and record outcomes without modifying owned files.
- [ ] A5. Verify all earlier high-risk evidence packs exist, validate, and contain explicit decisions.

### B — Add red-first integrated authorization and billing tests

- [ ] B1. Create `src/lib/googleCalendarPhase05Authorization.integration.test.ts` with named cases for every denial-matrix row, OAuth replay/mismatch/expiry, service-role owner derivation, connection non-enumeration, token isolation, encryption version/rotation, and disconnect generation race.
- [ ] B2. Run `pnpm test src/lib/googleCalendarPhase05Authorization.integration.test.ts`; retain red evidence until upstream contracts are genuinely present, then rerun to green.
- [ ] B3. Create `src/lib/googleCalendarPhase05Billing.integration.test.ts` with named cases for exactly 79,000 server authority, ignored browser amount, free owner, Pro owner, Pro Max inheritance, free creator/Pro assignee, entitlement lapse, opt-out, and free local calendar.
- [ ] B4. Run `pnpm test src/lib/billing.test.ts src/lib/googleCalendarPhase05Billing.integration.test.ts`; any 69,000 or creator-gated result routes to Phase 1.

### C — Add red-first queue, provider-contract, and lifecycle tests

- [ ] C1. Create `src/lib/googleCalendarPhase05Resilience.integration.test.ts` for concurrent lease claims, duplicate delivery, stale lease, retry/backoff cap, dead-letter, stale desired version, stale generation, reconnect idempotency, and 429/5xx/timeout/ambiguous-success sequences.
- [ ] C2. Create `src/lib/googleCalendarPhase05ProviderContract.integration.test.ts` for primary calendar, create/update/delete/reassign/date removal, deterministic identity, ownership marker, unrelated event protection, and all-day exclusive end.
- [ ] C3. Run `pnpm test src/lib/googleCalendarPhase05Resilience.integration.test.ts src/lib/googleCalendarPhase05ProviderContract.integration.test.ts`; route implementation failures to Phase 3.

### D — Add red-first privacy, overlay, and integrated UX tests

- [ ] D1. Create `src/lib/googleCalendarPhase05Privacy.integration.test.ts` for owner-only projection, cross-user non-enumeration, bounded pagination, server-only `nextSyncToken`, 410 owner-only reset, atomic cache publication, disconnect cleanup, and Teamfair-copy dedup.
- [ ] D2. Create `src/pages/GoogleCalendarPhase05E2E.test.tsx` for dedicated-consent UI, upgrade/lapse/reconnect/retry states, imported-event read-only behavior, and local-calendar regression for free/failed/provider-down states.
- [ ] D3. Run `pnpm test src/lib/googleCalendarPhase05Privacy.integration.test.ts src/pages/GoogleCalendarPhase05E2E.test.tsx`; route implementation failures to Phase 4 or earliest prerequisite.

### E — Add release-readiness and redaction tests

- [ ] E1. Create `src/lib/googleCalendarPhase05ReleaseReadiness.integration.test.ts` to validate required monitoring event schema, forbidden sensitive fields, release blockers, rollback prerequisites, earlier evidence inventory, and verdict rules.
- [ ] E2. Run `pnpm test src/lib/googleCalendarPhase05ReleaseReadiness.integration.test.ts` and record missing runtime signals as blockers rather than mocking them green.
- [ ] E3. Run secret/sensitive-field searches defined by PVL across source, generated responses, logs, Phase 5 evidence, and browser artifacts; do not print matched secret values.

### F — Build five-artifact high-risk evidence pack

- [ ] F1. Write `harness/phase-05/risk-gate.json` with all applicable risk classes and stop-before-finalize flag.
- [ ] F2. Write redacted exact-line `harness/phase-05/context-snippets.json` for every trust boundary.
- [ ] F3. Append every automated/hybrid/probe/regression result to `harness/phase-05/verification.json` with command, result, and evidence reference.
- [ ] F4. Write `harness/phase-05/adversarial-validation.json` for denial matrix and R1–R3 scenarios.
- [ ] F5. After independent review, write `harness/phase-05/review-decision.json` with explicit APPROVE/REJECT and intended release cohort.
- [ ] F6. Run `.claude/skills/vc-risk-evidence-pack/scripts/validate-risk-artifacts.mjs` against the Phase 5 pack using the exact syntax confirmed during PVL; any failure blocks finalization.

### G — Run controlled live Google lane after separate approval

- [ ] G1. Confirm all live-lane preconditions and separate approval; if absent, record release blocker and do not call Google.
- [ ] G2. Execute consent, state replay/mismatch, scope, subject, offline refresh, browser isolation, revocation, and disconnect sequence.
- [ ] G3. Execute primary-calendar create/update/delete/read, all-day exclusive end, unrelated-event control, retry, reconnect, and duplicate checks.
- [ ] G4. Execute overlay pagination, incremental token, 410 full-resync, owner isolation, Teamfair-copy dedup, and disconnect cache cleanup.
- [ ] G5. Inspect quota/failure signals without intentional quota exhaustion; record any unprovable live behavior as CONDITIONAL.
- [ ] G6. Clean only disposable test data and record cleanup receipts.

### H — Verify observability, incident response, and rollback

- [ ] H1. Trigger one sanitized success and failure for OAuth, worker, overlay, entitlement, and disconnect in non-production runtime.
- [ ] H2. Verify required fields and absence of forbidden fields in Supabase logs, Sentry, and PostHog; package installation without delivered event is failure.
- [ ] H3. Verify each threshold can be queried/alerted and has an assigned operator action.
- [ ] H4. Rehearse independent disablement of connection, writes, and reads while local Teamfair task/calendar flows remain green.
- [ ] H5. Record rollback rehearsal and recovery revalidation in Phase 5 report.

### I — Final cross-phase verification and verdict

- [ ] I1. Run full focused Phase 5 command from `## Test Coverage Plan`.
- [ ] I2. Run sequentially: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `git diff --check`.
- [ ] I3. Run the narrowest representative regression gate from each Phase 1–4 report and record PASS/FIXED/BLOCKED.
- [ ] I4. Confirm AC1–AC20 each have matching scenario, strategy, evidence result, and criterion back-reference.
- [ ] I5. Confirm no Critical/High finding, missing high-risk artifact, missing provider proof, OAuth verification mismatch, monitoring gap, or cleanup failure remains.
- [ ] I6. Write final Phase 5 report verdict: `PASS — intended cohort`, `CONDITIONAL — named blockers`, or `BLOCKED — named failure`.
- [ ] I7. Mark Phase 5 VERIFIED only for full PASS; never equate code/test creation with release readiness.

## Exit Gate

- All checklist items either pass or have an explicit blocking verdict; no silent skip.
- All exact automated commands are green.
- Required Hybrid and Agent-Probe evidence is recorded.
- AC1–AC20 traceability is bidirectional.
- Phase 1–4 representative regressions are green.
- Phase 5 risk pack validates and review decision is APPROVE.
- Live-provider and OAuth verification evidence match intended release cohort.
- Monitoring/redaction and rollback evidence exist.
- Report has one honest release verdict and `What green does not prove` section.

## Blockers That Justify BLOCKED

- Any Phase 1–4 dependency is not VERIFIED or its contract/evidence is missing.
- Any Critical/High auth, privacy, credential, event-ownership, idempotency, billing, or data-integrity failure.
- Current effective Pro Group amount is not exactly 79,000 VND server-side.
- Live provider lane unavailable or not approved when release claim requires it.
- OAuth app audience/publishing/verification/redirect/scope state does not support intended release.
- Refresh token/private event data appears in browser, URL, response, error, log, Sentry, or PostHog.
- High-risk evidence pack is missing, invalid, or explicitly REJECTED.
- No safe independent lane-disable/rollback path preserves local calendars.
- Monitoring signals are absent or cannot be redacted/queried.

## Dependencies

- Frozen SPEC and umbrella plan.
- Phase 1 canonical task identity and 79,000 billing/entitlement proof.
- Phase 2 OAuth/credential/connection/disconnect proof and final official-doc-backed scope contract.
- Phase 3 queue/worker/provider-write/event-ownership proof and exact retry policy.
- Phase 4 owner-only overlay/cache/pagination/sync-token/410 proof.
- Google Cloud OAuth client and disposable Google/Supabase test environment for Hybrid lane.
- Sentry/PostHog/Supabase operational access for redacted signal proof.

## Integration Notes

- Google docs confirm web-server redirect URI must exactly match an authorized URI, offline access is needed for refresh, state must be verified, and sensitive scopes may require verification.
- Google Calendar docs confirm `primary` calendar keyword, all-day `start.date`/`end.date`, pagination plus `nextSyncToken`, 410 invalid-token full resync, and exponential backoff for quota failures.
- Phase 2 final validate-contract owns exact scope choice. Phase 5 checks the registered/requested/granted set; it never broadens it.
- Existing jsdom tests are not browser/provider proof. Hybrid and Agent-Probe lanes remain mandatory.
- No Supabase config file or documented browser E2E runner exists in current repo context; PVL must not invent commands.

## Phase Loop Progress

The canonical phase-program inner loop `R → I → P → PVL → E → EVL → UP` skips SPEC because the program SPEC is already frozen.

- [ ] 1. RESEARCH — prior Phase 1–4 reports read; live context/test routing loaded; drift checked
- [ ] 2. INNOVATE — validation approach and lane boundaries confirmed; Decision Summary written
- [ ] 3. PLAN-SUPPLEMENT — this plan refreshed from current contracts or marked research-clean
- [ ] 4. PVL — full V1–V7; complete validate-contract written; live and risk gates locked
- [ ] 5. EXECUTE — Phase-5-only tests/evidence completed; per-section gates green
- [ ] 6. EVL — independent rerun, regressions, live/provider/probe evidence, and handoff summary complete
- [ ] 7. UPDATE PROCESS — report/umbrella/context closeout complete; commit only if user requests

**Validate-contract required before EXECUTE.** Placeholder or partial contract blocks EXECUTE.

## Resume and Execution Handoff

- Selected plan file path: `process/features/project_management/active/google-calendar-integration_22-07-26/phase-05-security-and-production-readiness_PLAN_22-07-26.md`
- Last completed step: PLAN draft created; no implementation or live provider action
- Validate-contract status: pending outer PVL
- Supporting inputs: frozen SPEC, umbrella, registry, Phase 1–4 plans/reports/validate-contracts/evidence, routed auth/database/test context, Google official docs
- Supporting context files loaded: `process/context/all-context.md`, `process/context/tests/all-tests.md`, `process/context/auth/all-auth.md`, `process/context/database/all-database.md`, `process/context/planning/all-planning.md`, and required development protocols
- Execute anchor: this exact Phase 5 plan only; never infer execution from the program folder
- Supporting phase files: `phase-01-task-identity-and-pricing_PLAN_22-07-26.md`, `phase-02-google-connection-and-credential-custody_PLAN_22-07-26.md`, `phase-03-task-to-google-write-sync_PLAN_22-07-26.md`, and `phase-04-private-google-read-overlay_PLAN_22-07-26.md` are read-only dependencies
- Next step: after all phase plans pass validators and coordinator resolves conflicts, run outer PVL; Phase 5 itself later begins with fresh RESEARCH after Phases 1–4 are VERIFIED
- EXECUTE scope: only Phase-5-named tests, `harness/phase-05/`, and Phase 5 report
- Live action rule: obtain separate approval before Google consent/provider calls or external configuration mutation
- Source failure rule: route to earliest owning phase; do not edit Phase 1–4 source from Phase 5

## Validate Contract

(placeholder — vc-validate-agent writes this section before EXECUTE)
