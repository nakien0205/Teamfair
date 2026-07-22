# Phase 2 — Google Connection and Credential Custody

**TL;DR:** Add a dedicated, owner-only Google Calendar authorization flow for eligible Pro Group accounts. Store browser-safe connection state separately from encrypted refresh credentials. Keep sync disabled until the owner opts in. Disconnect revokes credentials, clears private state, advances a generation fence, and does not report completion while a provider operation is still leased. This plan authorizes no source change, migration application, deployment, secret creation, or live Google action.

**Date**: 22-07-26  
**Complexity**: COMPLEX — auth, billing, OAuth, secrets, database authorization, frontend state, and a cross-phase disconnect fence  
**Status**: PLANNED — outer PVL pending; Phase 1 must be VERIFIED first  
**Umbrella plan:** [google-calendar-integration-umbrella_PLAN_22-07-26.md](./google-calendar-integration-umbrella_PLAN_22-07-26.md)  
**Frozen SPEC:** [google-calendar-integration_SPEC_22-07-26.md](./google-calendar-integration_SPEC_22-07-26.md)  
**Durable phase report:** [phase-02-google-connection-and-credential-custody_REPORT_22-07-26.md](./phase-02-google-connection-and-credential-custody_REPORT_22-07-26.md)

## Context Envelope

| Field | Value |
|---|---|
| `feature` | `project_management` |
| `phase` | `PLAN` |
| `session-goal` | Lock Phase 2 connection, credential-custody, opt-in, and disconnect contracts under the frozen SPEC without implementation or provider action. |
| `branch` | `feature_blocking` |
| `worktree` | `D:/Python/Projects/Teamfair` |
| `context-group` | `planning`, `tests`, `database`, `auth`, `uxui` |
| `blast-radius-packages` | `src/`, `supabase/functions/`, `supabase/migrations/`, task-folder `harness/phase-02/` evidence |
| `active-plan` | `process/features/project_management/active/google-calendar-integration_22-07-26/phase-02-google-connection-and-credential-custody_PLAN_22-07-26.md` |
| `test-runner` | `pnpm test | deno test | supabase db lint | pnpm typecheck | pnpm lint | pnpm build` |
| `validate-contract` | `none — outer PVL pending` |

Context was routed through `process/context/all-context.md`, `process/context/tests/all-tests.md`, and the relevant planning, auth, database, and UX/UI context packs. The tests router has no deeper repository test document for this surface; existing Vitest and Deno test files were inspected before tier assignment.

## Overview

Phase 2 creates the trust boundary between a Teamfair owner account and one connected Google account. It does not create or read calendar events. Phases 3 and 4 may consume its service-only credential and generation contracts after this phase is VERIFIED.

The design separates four concerns:

1. An authenticated Teamfair owner begins dedicated Google Calendar consent.
2. A transport-public callback proves possession of one short-lived, one-time server state and PKCE verifier; it never trusts a browser-supplied Teamfair user identifier.
3. Browser-visible metadata stays in a safe projection while refresh credentials and transient OAuth material stay in a private schema behind service-role-only functions.
4. Disconnect fences new provider operations before revocation and deletion, then waits for bounded existing leases to drain before reporting `disconnected`.

## Goals

- Make Google Calendar authorization separate from Teamfair login.
- Allow only the signed-in resource owner with an active account-scoped Pro Group or Pro Max entitlement to begin connection or enable sync.
- Keep connection and task sync as two different states; successful consent leaves `opted_in = false`.
- Prevent creators, free users, expired sessions, and cross-user requests from reading or changing another user's connection.
- Encrypt refresh tokens and PKCE verifiers with a versioned server-held keyring.
- Keep access tokens memory-only and all credentials out of browser responses, logs, URLs, and public tables.
- Make state replay, redirect mismatch, partial scope grants, and account-link confusion fail closed.
- Make disconnect safe when entitlement has expired, because cleanup must remain possible.
- Provide a generation and operation-lease contract that later workers must use before Google calls.
- Produce local automated evidence and bounded hybrid evidence without mutating production or a live Google project.

## Non-Goals

- Creating, updating, listing, or deleting Google Calendar events.
- Background jobs, retry queues, cursors, event mappings, personal-calendar overlays, or task sync.
- Changing Teamfair sign-in providers.
- Changing Phase 1 billing or plan prices. Phase 1 owns the frozen 79,000 VND/month Pro Group contract.
- Applying a migration, deploying an Edge Function, creating Supabase secrets, configuring a live Google OAuth client, publishing a consent screen, or using a real user's calendar.
- Deleting Google events on disconnect. Existing provider events may remain.
- Claiming that mocked provider behavior proves Google Console configuration or live revocation timing.

## Dependencies and Entry Conditions

| Dependency | Required state before EXECUTE | Failure response |
|---|---|---|
| Frozen program SPEC | Unchanged and linked above | Return to SPEC if requirements changed. |
| Phase 1 billing entitlement contract | `VERIFIED`; canonical server helper recognizes `pro_group` and `pro_max`; 79,000 VND Pro Group drift resolved | Do not implement Phase 2 against the current stale 69,000 VND value. Return to Phase 1. |
| Phase 1 task identity contract | `VERIFIED` enough for later per-user ownership references | Keep later Phase 3/4 integration blocked. |
| Blast-radius registry | Phase 2 claim remains accepted; no unowned file overlap | Coordinator resolves conflict before execute. |
| Local test tooling | pnpm/Vitest works; Deno test command and local Supabase availability recorded by PVL | Mark affected hybrid gate CONDITIONAL; do not fabricate a pass. |
| Google OAuth feasibility | Required scope set, ID-token validation, callback topology, and exact redirect behavior confirmed from current official docs | Update this plan through PLAN-SUPPLEMENT before implementation. |

## Phase Completion Rules

Phase 2 can become `✅ VERIFIED` only when all conditions below are true:

1. Every numbered checklist item is complete or explicitly returned to PLAN.
2. Every developed behavior has at least one Fully-Automated, Hybrid, or Agent-Probe proving gate; Known-Gap is never a pass strategy.
3. AC1–AC4, AC14, AC16–AC18, and AC20 have bidirectional criterion-to-gate links.
4. The focused and full Vitest suites, focused Deno tests, typecheck, lint, build, and diff check are green.
5. The isolated database authorization matrix and the mocked OAuth failure matrix are green.
6. The browser-exposure audit finds no refresh token, access token, client secret, raw state record, PKCE verifier, Google subject, or provider error detail in frontend payloads or persisted browser state.
7. Disconnect fencing proves that no new operation lease is granted after the generation transition and that `disconnected` is not reported while a valid pre-fence lease remains.
8. The phase evidence pack has a human `PASS` or `APPROVED` decision with no expired artifact and no unreviewed redaction problem.
9. The report file contains actual evidence paths, command outcomes, remaining provider limits, and the user-confirmation state.
10. The user confirms the phase result; automated green alone is not user confirmation.

Live Google Console state, real refresh-token issuance, and real provider revocation are release evidence, not a hidden Phase 2 automated pass. Any developed behavior that cannot be proved locally remains CONDITIONAL with a named backlog stub.

## Strategy Decision

`vc-agent-strategy-compare` threshold score: **6/7**. The phase touches security/auth, has at least four independent workstreams, belongs to a phase program, requests exhaustive planning, is high-risk, and spans more than five files. It does not independently span three repository packages.

| Strategy | Estimate | Decision |
|---|---:|---|
| Sequential | 1 actor, about 2 rounds | Rejected. Slow and weak for cross-checking auth, SQL, crypto, and UI contracts. |
| Parallel subagents | 4 actors, about 1 round | Rejected. Phase 2 requires live coordination on schema, fencing, and provider boundaries. |
| Workflow | 1 deterministic pipeline, about 2 rounds | Supporting choice for test and evidence gates, not the main implementation strategy. |
| Agent team | 4 specialists, about 2 rounds | Selected. Use database/security, Edge/OAuth, frontend, and adversarial-test owners with one phase lead. |

The team must stay inside this phase's accepted file claim. One implementer owns each file at a time. Reviewers may read but must not silently edit another owner's file.

## Architecture and Data Flow

### Connection start

1. `GoogleCalendarConnectionCard` asks the typed browser client to start authorization.
2. The Edge Function validates the Supabase bearer token with the existing shared auth helper.
3. The server resolves the caller's account-scoped entitlement through Phase 1's canonical server contract; only `pro_group` or `pro_max` continues.
4. The server ignores any browser owner identifier and uses the authenticated user ID.
5. In one server-controlled operation, it creates a high-entropy raw state, stores only its SHA-256 digest, generates a PKCE verifier/challenge, encrypts the verifier, binds the row to owner, exact redirect URI, requested scope-set version, expiry, and connection generation, and invalidates older unconsumed states for that owner.
6. It returns only the Google authorization URL. The URL contains the raw state and PKCE challenge, but no Teamfair user ID or secret.
7. The browser performs a top-level redirect to Google; no popup or embedded user-agent is required.

### Callback

1. Google performs a GET to the exact server callback URI.
2. The callback accepts only expected OAuth query fields and a bounded total query length.
3. The server hashes received state and atomically consumes one unexpired, unused row. Replay, owner substitution, redirect drift, or missing state fails before token exchange.
4. The server decrypts the PKCE verifier and exchanges the authorization code with the exact redirect URI.
5. It validates the ID token issuer, audience, signature, expiry, and nonce/account-binding inputs using a current supported method established by PVL. It hashes the stable `sub` claim and discards identity claims such as email.
6. It normalizes granted scopes and requires every frozen required scope. Partial grants fail closed and do not replace a valid prior connection.
7. It rechecks the current account-scoped entitlement after exchange. If the owner is no longer eligible, it makes a bounded best-effort revoke call for the new token, stores no new credential, preserves no pending consent state, and returns a generic entitlement outcome.
8. Initial connection requires a refresh token. Reconnection never overwrites a valid credential with a missing refresh token; it either preserves the existing same-account credential or returns `reconnect_required` according to the validated provider response matrix.
9. Credential replacement and safe connection metadata update are atomic from the application's view. New credentials use the current encryption key version. Successful consent sets `status = connected` and `opted_in = false`.
10. The server deletes or renders unusable all transient OAuth material and redirects only to the fixed Teamfair Settings URL with a generic outcome code.

### Status and explicit opt-in

1. The authenticated owner requests status; the server resolves entitlement and returns only the safe `GoogleCalendarConnectionView`.
2. Connection does not imply sync permission. The owner must enable the separate opt-in control.
3. `set_opt_in(true)` requires authenticated owner, active eligible entitlement, connected status, current required scopes, and decryptable credentials.
4. `set_opt_in(false)` remains available to the authenticated owner even if entitlement later expires, because disabling access is cleanup.

### Provider-operation lease and disconnect

1. Before any later phase makes a Google HTTP request, it requests a fresh service-only operation lease with owner, expected generation, opaque operation ID, and bounded expiry. One lease covers exactly one external HTTP request; it is never renewed or reused for a multi-request job.
2. Lease acquisition and authorization happen atomically against connection status, opt-in, entitlement, and generation. No lease is issued while `disconnecting` or `disconnected`.
3. The caller holds the lease from its final authorization check through that one bounded provider HTTP request and releases it in a `finally` path. Phase 3 requests a 30-second lease and sets each provider deadline to at most 15 seconds. Token refresh, event insert, conflict GET, recovery PATCH, and delete each require separate acquire/call/release cycles. If disconnect occurs between calls, the next acquisition fails and no next provider request begins.
4. Disconnect authenticates the owner but permits cleanup even when paid entitlement has expired.
5. `begin_disconnect` atomically sets `disconnecting`, forces `opted_in = false`, and increments the monotonic connection generation. This fences all new leases and stale queued work.
6. The server makes a bounded best-effort revoke call using the current refresh token, regardless of whether prior consent included combined scopes.
7. It unconditionally deletes refresh credentials, OAuth state rows, and any expired leases. Provider revoke timeout or error is recorded only as a sanitized code and never prevents local credential deletion.
8. `finalize_disconnect` returns `pending` while a valid pre-fence lease remains. It sets `disconnected` only when leases have drained or expired under the proven timeout/TTL invariant.
9. Phases 3 and 4 own cleanup of tables introduced by those phases. They must bind their rows to generation and register their cleanup in their migrations; they must not edit the Phase 2 migration without PLAN-SUPPLEMENT.

This lease contract guarantees that no provider call begins after disconnect fencing and that disconnect is not reported complete while a valid earlier provider call is in flight. It does not claim to cancel an HTTP request already sent before fencing.

## Google OAuth Contract

Current official Google documentation confirms exact redirect matching, state validation, offline access for refresh tokens, narrow Calendar scopes, and project-wide combined-authorization revocation behavior. The requested scope set is frozen for Phase 2 as:

- `openid`
- `email`
- `https://www.googleapis.com/auth/calendar.events.owned`
- `https://www.googleapis.com/auth/calendar.events.readonly`

`email` is included only because Google's current OpenID Connect contract requires `openid` plus `profile`, `email`, or both. The implementation uses the stable `sub` for a one-way account-binding hash and must not persist or return email. `calendar.events.owned` permits Teamfair-owned event writes on calendars the user owns. `calendar.events.readonly` permits the later personal-calendar overlay. Broad `calendar`, `calendar.events`, `profile`, and incremental `include_granted_scopes=true` are not requested.

Authorization parameters are server-owned constants: web-server authorization-code response, `access_type=offline`, `prompt=consent` for initial/reconnect flows that need a refresh token, exact callback URI, state, PKCE challenge, and the frozen scope set. Provider errors and authorization codes are handled on the callback endpoint, then removed by a fixed clean redirect.

Official sources used to lock this contract:

- [Google OAuth 2.0 for web server applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google OpenID Connect reference](https://developers.google.com/identity/openid-connect/reference)
- [Google Calendar API scopes](https://developers.google.com/workspace/calendar/api/auth)

PVL must still prove that the chosen runtime can validate Google ID tokens and PKCE without introducing an unsupported dependency. If it cannot, the plan must be supplemented before EXECUTE; do not remove account binding silently.

## Data Model

### `public.google_calendar_connections`

One row per Teamfair owner. Browser-safe metadata only.

| Column | Contract |
|---|---|
| `owner_id` | `uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`; never accepted from browser actions. |
| `status` | `text NOT NULL DEFAULT 'disconnected'`; check to `consent_pending`, `connected`, `attention_needed`, `disconnecting`, `disconnected`. |
| `opted_in` | `boolean NOT NULL DEFAULT false`; check requires `status = 'connected'` when true. Consent success must not set true. |
| `granted_scopes` | `text[] NOT NULL DEFAULT '{}'`; canonically sorted and duplicate-free before write. |
| `google_subject_hash` | `text NULL`; when present, check requires 64-character lowercase hexadecimal SHA-256. Excluded from browser projection. |
| `connection_generation` | `bigint NOT NULL DEFAULT 0 CHECK (connection_generation >= 0)`; incremented on disconnect fencing and credential replacement. |
| `attention_code` | `text NULL`; check allows `reconnect_required`, `scope_missing`, `credential_unreadable`, or `revoke_unconfirmed`. |
| `connected_at` | `timestamptz NULL`. |
| `created_at` | `timestamptz NOT NULL DEFAULT now()`. |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()`; maintained only by server-owned mutation functions. |

RLS is enabled. Direct writes are revoked from `anon` and `authenticated`. Owner visibility is supplied only by the safe projection RPC. No admin-style cross-user lookup is exposed.

### `private.google_calendar_credentials`

One current refresh credential per owner. No direct PostgREST/browser access.

| Column | Contract |
|---|---|
| `owner_id` | `uuid PRIMARY KEY REFERENCES public.google_calendar_connections(owner_id) ON DELETE CASCADE`. |
| `encrypted_refresh_token` | `text NOT NULL`; base64 AES-GCM ciphertext including authentication tag. |
| `nonce` | `text NOT NULL`; base64 unique 96-bit random nonce per encryption. |
| `key_version` | `integer NOT NULL CHECK (key_version > 0)`. |
| `credential_generation` | `bigint NOT NULL CHECK (credential_generation >= 0)`; equals the connection generation that authorized it. |
| `created_at` | `timestamptz NOT NULL DEFAULT now()`. |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()`. |

### `private.google_calendar_oauth_states`

Short-lived, one-time callback records.

| Column | Contract |
|---|---|
| `state_digest` | `text PRIMARY KEY` checked as 64-character lowercase hexadecimal SHA-256; raw state is never stored. |
| `owner_id` | `uuid NOT NULL REFERENCES public.google_calendar_connections(owner_id) ON DELETE CASCADE`; authenticated initiator. |
| `encrypted_pkce_verifier` | `text NOT NULL`; base64 AES-GCM ciphertext. |
| `pkce_nonce` | `text NOT NULL`; base64 unique 96-bit encryption nonce. |
| `key_version` | `integer NOT NULL CHECK (key_version > 0)`. |
| `oidc_nonce_digest` | `text NOT NULL` checked as 64-character lowercase hexadecimal SHA-256; raw OIDC nonce is not persisted. |
| `redirect_uri` | `text NOT NULL`; exact server callback used at authorization start. |
| `scope_set_version` | `integer NOT NULL DEFAULT 1 CHECK (scope_set_version = 1)` for the frozen Phase 2 set. |
| `connection_generation` | `bigint NOT NULL CHECK (connection_generation >= 0)`; generation observed at authorization start. |
| `expires_at` | `timestamptz NOT NULL`; server caps lifetime at ten minutes. |
| `consumed_at` | `timestamptz NULL`; only atomic consume writes it. |
| `created_at` | `timestamptz NOT NULL DEFAULT now()`. |

### `private.google_calendar_operation_leases`

Bounded cross-phase fence for provider calls.

| Column | Contract |
|---|---|
| `owner_id` | `uuid NOT NULL REFERENCES public.google_calendar_connections(owner_id) ON DELETE CASCADE`. |
| `operation_id` | `uuid NOT NULL`; opaque non-secret value; composite primary key with `owner_id`. |
| `connection_generation` | `bigint NOT NULL CHECK (connection_generation >= 0)`; generation atomically authorized at acquisition. |
| `purpose` | `text NOT NULL`; check allows only `task_event_write`, `personal_event_read`, or `credential_validation`. |
| `acquired_at` | `timestamptz NOT NULL DEFAULT now()`. |
| `expires_at` | `timestamptz NOT NULL`; database accepts requested TTL only from 20 through 30 seconds and caps at 30 seconds. |
| `released_at` | `timestamptz NULL`; idempotent release timestamp. |

The private schema revokes access from `PUBLIC`, `anon`, and `authenticated`. Service operations use SECURITY DEFINER functions with fixed `search_path`, explicit argument validation, and grants only to `service_role`. The feasibility gate must confirm the exact Supabase private-schema access method; browser access is never an acceptable fallback.

## Encryption and Key Rotation Contract

- Use AES-256-GCM through Edge-runtime Web Crypto after a Deno feasibility test.
- Store a server secret named `GOOGLE_CALENDAR_TOKEN_KEYS_JSON` mapping positive versions to base64-encoded 32-byte keys and `GOOGLE_CALENDAR_TOKEN_ACTIVE_KEY_VERSION` selecting new writes. Names are contract only; this phase does not create secret values.
- Use a fresh 96-bit nonce for every encryption. Reject wrong key length, nonce length, unknown version, authentication failure, malformed base64, or oversized plaintext.
- Bind ciphertext with authenticated additional data containing provider name, credential type, owner ID, and connection generation.
- Encrypt new values with the active version. Decrypt existing values by their stored version.
- Rewrap under the active version only after a successful authenticated use or an explicit future service-only rotation operation. Never remove an old key until a service-only row count proves no credential or unexpired OAuth state uses it.
- Access tokens exist only in function memory for the shortest practical time and are never persisted.
- Error objects, structured logs, test snapshots, and evidence artifacts must redact token-like values, authorization codes, raw state, verifiers, client secrets, ciphertext, nonce, Google subject, and email.

## Public Contracts

### Browser-safe connection view

`GoogleCalendarConnectionView` contains only:

| Field | Type and meaning |
|---|---|
| `status` | `not_connected`, `consent_pending`, `connected`, `attention_needed`, `disconnecting`, or `disconnected` |
| `optedIn` | boolean |
| `grantedScopes` | canonical string array |
| `connectionGeneration` | non-negative integer |
| `attentionCode` | `entitlement_required`, `reconnect_required`, `scope_missing`, `credential_unreadable`, `revoke_unconfirmed`, or null |
| `connectedAt` | ISO timestamp or null |
| `updatedAt` | ISO timestamp or null when no row exists |

It excludes Google subject hash, email, access token, refresh token, ciphertext, nonce, key version, raw state, verifier, authorization code, provider response, and provider error detail.

### Edge Function `google-calendar-connection`

| Route/action | Auth and entitlement | Request | Response |
|---|---|---|---|
| `POST authorize` | Valid bearer; authenticated owner; active Pro Group or Pro Max | No owner ID; optional fixed UI return intent only | Authorization URL and expiry; no secret |
| `GET callback` | Transport-public; authorized only by consumed one-time state bound to an authenticated initiation | Google `code` or allowlisted `error`, plus state | Fixed Settings redirect with generic `calendar=connected`, `denied`, or `failed` |
| `POST status` | Valid bearer; active eligible entitlement for full view | No owner ID | Safe connection view; ineligible users receive generic entitlement response |
| `POST set_opt_in` | Valid bearer; owner; enabling requires active entitlement and usable connection; disabling requires owner only | Boolean `enabled` | Safe connection view |
| `POST disconnect` | Valid bearer; owner; entitlement not required for cleanup | No owner ID | Safe `disconnecting` or `disconnected` view plus generic revoke-confirmed flag |

The mixed public callback/protected-action topology is a mandatory feasibility gate. If Supabase gateway JWT configuration cannot support it while preserving handler-level authorization, split callback and action functions only through PLAN-SUPPLEMENT and registry coordination.

### Database functions

| Function | Caller | Contract |
|---|---|---|
| `public.get_my_google_calendar_connection()` | `authenticated` | No parameters. Returns one row with `status text`, `opted_in boolean`, `granted_scopes text[]`, `connection_generation bigint`, `attention_code text`, `connected_at timestamptz`, `updated_at timestamptz`; uses `auth.uid()` only and returns no connection metadata when the canonical Phase 1 entitlement is ineligible. |
| `public.create_google_calendar_oauth_state(p_owner_id uuid, p_state_digest text, p_encrypted_pkce_verifier text, p_pkce_nonce text, p_key_version integer, p_oidc_nonce_digest text, p_redirect_uri text, p_scope_set_version integer, p_connection_generation bigint, p_expires_at timestamptz)` | `service_role` | Returns `boolean`. Rechecks eligible entitlement, creates or validates the safe connection row, marks consent pending only when there is no usable existing connection, invalidates older unconsumed owner states, and inserts one capped-TTL state. |
| `public.consume_google_calendar_oauth_state(p_state_digest text)` | `service_role` | Returns one row with owner ID, encrypted verifier envelope, OIDC nonce digest, redirect URI, scope-set version, and observed generation. Atomically marks one matching unexpired state consumed; a second caller gets zero rows. |
| `public.store_google_calendar_credential(p_owner_id uuid, p_expected_generation bigint, p_credential_generation bigint, p_encrypted_refresh_token text, p_credential_nonce text, p_key_version integer, p_google_subject_hash text, p_granted_scopes text[], p_connected_at timestamptz)` | `service_role` | Returns `bigint` new generation. Requires `p_credential_generation = p_expected_generation + 1`, atomically rechecks eligible entitlement and current generation, advances to that generation, replaces private credential, writes safe metadata, and forces opt-in false. The Edge encrypts with that next generation in AES-GCM AAD before calling. |
| `public.get_google_calendar_credential_for_service(p_owner_id uuid, p_expected_generation bigint)` | `service_role` | Returns encrypted token, nonce, key version, and credential generation only when status/generation allow credential validation. Later provider calls must use lease acquisition instead. |
| `public.rewrap_google_calendar_credential_for_service(p_owner_id uuid, p_expected_generation bigint, p_encrypted_refresh_token text, p_credential_nonce text, p_key_version integer)` | `service_role` | Returns `boolean`; replaces only the ciphertext envelope at the same generation after successful decrypt/refresh, enabling active-key rewrap without changing connection identity. |
| `public.set_google_calendar_opt_in_for_service(p_owner_id uuid, p_enabled boolean)` | `service_role` | Returns the safe connection row. Enabling atomically requires current eligible entitlement, connected state, complete required scopes, decryptable current credential, and matching generation; disabling requires authenticated-owner proof at the Edge boundary but no paid entitlement. |
| `public.acquire_google_calendar_operation_lease(p_owner_id uuid, p_expected_generation bigint, p_operation_id uuid, p_purpose text, p_requested_ttl_seconds integer)` | `service_role` | Returns `lease_acquired boolean`, generic `denial_code text`, authorized generation, capped expiry, and credential envelope. Checks connected, opted-in, eligible entitlement, generation, and disconnect fence atomically. |
| `public.release_google_calendar_operation_lease(p_owner_id uuid, p_operation_id uuid)` | `service_role` | Returns `boolean`; idempotently releases only the matching active lease. |
| `public.begin_google_calendar_disconnect(p_owner_id uuid)` | `service_role` | Returns fenced generation, credential envelope, and active-lease count. Atomically sets disconnecting, disables opt-in, increments generation, deletes pending OAuth states, and fences new leases. |
| `public.clear_google_calendar_disconnect_local_state(p_owner_id uuid, p_fenced_generation bigint, p_revoke_outcome text)` | `service_role` | Returns `boolean`; deletes credentials/states and records only allowlisted `confirmed`, `not_found`, `timeout`, or `failed` revoke outcome when generation matches. |
| `public.finalize_google_calendar_disconnect(p_owner_id uuid, p_fenced_generation bigint)` | `service_role` | Returns status and active-lease count. Finalizes only when no unexpired/unreleased pre-fence lease remains and local private state is cleared. |

Every SECURITY DEFINER function has a fixed search path, schema-qualified references, revoked public execution, explicit service-role grant where needed, and no client-selected authorization subject.

## UI Contract

- Add one `GoogleCalendarConnectionCard` inside the existing `SettingsModal`; do not add a Project Management page control in this phase.
- Show plan eligibility, connection state, separate sync opt-in, reconnect guidance, and disconnect.
- The primary connection control explains that Google Calendar permission is separate from Teamfair sign-in.
- A successful callback returns to Settings and shows connected but not syncing.
- Ineligible owners see upgrade guidance and no authorization URL.
- Creators/non-owners never see or receive another user's connection state.
- `disconnecting` disables duplicate connect/opt-in/disconnect actions and can poll status until finalization.
- Errors are actionable but generic: denied consent, expired attempt, wrong account/reconnect needed, missing scope, temporarily unavailable, or entitlement required.
- Never render email, Google account ID, tokens, provider response bodies, or raw OAuth errors.
- Existing Settings behavior and accessibility remain unchanged: keyboard focus, labels, disabled-state explanation, and live status announcements are required.

## Security

### STRIDE summary

| Threat | Main control | Required evidence |
|---|---|---|
| Spoofing owner or Google account | Existing bearer validation; server-derived owner; one-time state; PKCE; validated OIDC `sub` hash | Cross-user denial and wrong-account/replay scenarios |
| Tampering with state, redirect, scope, or generation | State digest, exact redirect binding, server-owned scopes, atomic generation RPCs, AES-GCM AAD | Callback mismatch and ciphertext tamper tests |
| Repudiation | Sanitized action/result/correlation logging without payload secrets | Redaction audit and disconnect evidence |
| Information disclosure | Public/private split, service-only grants, safe projection, no token persistence in browser | Browser-exposure audit and RLS matrix |
| Denial of service | Existing rate limit helper, per-owner pending-state cap, TTL cleanup, bounded provider timeouts, bounded leases | Spam-initiation and lease-expiry tests |
| Elevation of privilege | Entitlement and owner checks per action; creator/free/cross-user denial; fixed SECURITY DEFINER search paths | Server authorization denial matrix |

Disconnect cleanup is intentionally allowed after entitlement expiry. This is not an elevation path because it can only disable and delete the authenticated owner's integration.

## Risk Predictions

The required five-persona pre-implementation debate produced these dominant predictions:

| Persona | Prediction | Plan response |
|---|---|---|
| Senior engineer | A final generation read followed by an HTTP call still races with disconnect. | Add the bounded operation-lease/fence contract and withhold `disconnected` until leases drain. |
| Security engineer | A transport-public callback or SECURITY DEFINER function can become a cross-user credential oracle. | One-time state authorization, no browser owner parameter, fixed search paths, service-only grants, and denial matrix. |
| QA engineer | Happy-path mocks will miss replay, missing refresh token, partial grant, reconnect, and revoke-timeout behavior. | Make the full credential failure matrix a Hybrid gate and add deterministic provider fakes. |
| Product owner | Users will treat "connected" as "syncing" and may not understand paid eligibility. | Separate consent from explicit opt-in and expose distinct UI states. |
| Platform engineer | Private-schema access, mixed callback auth, and Google ID-token verification may not behave as assumed in Supabase Edge. | Run three mandatory feasibility probes before source implementation; supplement the plan on any mismatch. |

Highest likelihood × impact risks are callback topology, credential exposure, and disconnect/provider-call races. Each has a hard gate below.

## Failure Modes and Scenario Matrix

| Scenario | Required behavior | Proving gate |
|---|---|---|
| Missing, expired, malformed, or invalid Supabase bearer | Generic 401; no row/provider interaction | `server-authorization-denial-matrix` |
| Free/Pro Personal/expired entitlement attempts authorize or enable | Generic 403/upgrade response; no state/token mutation | `calendar-owner-pro-group-entitlement-matrix` |
| Creator guesses assignee ID | Request shape has no owner ID; generic denial/no data | `creator-cannot-enable-assignee-calendar` |
| User A targets User B connection/RPC | No data or mutation across status, opt-in, disconnect, and service paths | `google-calendar-cross-user-isolation` |
| Repeated authorize spam | Rate-limited; at most one current pending attempt per owner | `google-consent-credential-failure-matrix` |
| Callback state missing, wrong, expired, or already consumed | No token exchange; generic clean redirect; no secret logs | `google-consent-credential-failure-matrix` |
| OAuth callback is retried concurrently | Exactly one consume/exchange winner; all others fail closed | `google-consent-credential-failure-matrix` |
| Redirect URI differs by scheme, case, path, or slash | Exchange blocked before provider call | `google-consent-credential-failure-matrix` |
| Consent denied or Google returns error | State consumed; no credential replacement; generic result | `google-consent-credential-failure-matrix` |
| Partial Calendar scope grant | No connected/opted-in state; reconnect guidance | `google-consent-credential-failure-matrix` |
| ID token invalid, expired, wrong audience/issuer, or wrong account on reconnect | No credential replacement; generic wrong-account/reconnect state | `google-consent-credential-failure-matrix` |
| Initial token response lacks refresh token | Fail closed; do not claim connected | `google-consent-credential-failure-matrix` |
| Same-account reconnect omits refresh token | Preserve existing valid token only under validated same-account rule; otherwise reconnect required | `google-consent-credential-failure-matrix` |
| Active encryption key missing/invalid or stored key version unknown | No plaintext fallback; attention state; safe error | `credential-encryption-rotation-matrix` |
| Ciphertext/AAD/nonce tampered | Authenticated decryption fails; no token/log leak | `credential-encryption-rotation-matrix` |
| Entitlement ends during consent | Callback may store a disabled connection only if PVL explicitly validates that policy; opt-in remains false and no provider lease is possible | `google-consent-credential-failure-matrix` |
| Disconnect revoke returns 400, times out, or is delayed | Always clear local credentials/states; store sanitized `revoke_unconfirmed`; do not retry with plaintext in logs | `disconnect-revokes-access-and-clears-state` |
| Disconnect races with queued work | Generation increment rejects stale work and new leases | `disconnect-generation-operation-fence` |
| Disconnect races with already leased provider call | Status stays `disconnecting` until lease releases/expires under timeout invariant | `disconnect-generation-operation-fence` |
| Browser response, storage, error, or evidence contains secret | Test fails and phase cannot pass | `refresh-token-browser-exposure-audit` |

If entitlement ends during consent, the callback must not store the newly returned refresh token. It performs a bounded best-effort revoke, clears the consumed attempt, preserves any older valid connection only as disabled/attention-needed state, and returns generic entitlement guidance. This rule is locked and is not an implementation-time choice.

## Feasibility Gates

No implementation checklist item after Gate F4 may begin until these probes have recorded verdicts in the phase evidence folder.

| ID | Question | Method | PASS condition | FAIL/INCONCLUSIVE action |
|---|---|---|---|---|
| F1 | Can one Supabase Edge Function support a transport-public GET callback and bearer-protected POST actions with handler-level auth in this repo's deployment model? | Minimal local Edge probe using current Supabase function tooling and shared auth helper; no production deploy | Callback reaches handler without bearer; every protected action rejects missing/invalid bearer; no other route becomes anonymous | PLAN-SUPPLEMENT to split callback/action files and coordinate blast radius |
| F2 | Can the Edge runtime validate Google ID tokens and perform authorization-code plus PKCE exchange using a supported, pinned method? | Current official docs plus local mocked JWKS/token endpoint probe | Issuer, audience, expiry, signature, nonce/state/account binding, PKCE, timeout, and malformed response paths are deterministic | Choose a documented supported dependency via docs review, or return to PLAN |
| F3 | Can Edge Web Crypto implement the AES-256-GCM envelope and key rotation contract? | Focused Deno encrypt/decrypt/tamper/version/AAD probe | Round trip works; tamper/wrong owner/wrong generation/unknown version fail; no plaintext appears | Return to PLAN; do not store plaintext or browser-encrypted tokens |
| F4 | Can service-role-only functions safely access the `private` schema while browser roles cannot? | Isolated local Supabase migration/RPC probe with owner A, owner B, anon, authenticated, and service role | Safe owner RPC works; direct private access and cross-user access fail; service helper works only through intended grant | Adjust SQL contract through PLAN-SUPPLEMENT; never expose private schema to browser |

Google Console audience, test users, app verification, exact registered redirect URI, real offline refresh-token issuance, and real revoke timing require an Agent-Probe in a controlled non-production Google project during release validation. No credentials or provider mutations are authorized by this plan session.

## Touchpoints

### Files created in EXECUTE

| File | Planned responsibility |
|---|---|
| `supabase/migrations/20260722200000_google_calendar_connection_credentials.sql` | Public/private tables, constraints, RLS, owner-safe projection, service-only credential/state/lease/disconnect functions, grants, and rollback notes |
| `supabase/functions/google-calendar-connection/index.ts` | Action routing, shared auth/entitlement checks, OAuth start/callback, status, opt-in, disconnect, sanitized responses, and dependency seams for tests |
| `supabase/functions/_shared/google-calendar/crypto.ts` | AES-GCM envelope, keyring parsing, AAD, hashes, and redaction-safe errors |
| `supabase/functions/_shared/google-calendar/credentials.ts` | Service-only credential load/store/delete, token refresh, generation, operation lease, and disconnect coordination |
| `supabase/functions/_shared/google-calendar/oauth.ts` | Frozen scopes, state/PKCE, authorization URL, callback exchange, ID-token/account binding, revoke, and provider response normalization |
| `supabase/functions/tests/google_calendar_connection_test.ts` | Deno authorization, OAuth failure, opt-in, disconnect, generation, lease, and response-redaction tests |
| `supabase/functions/tests/google_calendar_crypto_test.ts` | Deno encryption, tamper, AAD, key-version, and log-redaction tests |
| `src/lib/googleCalendarConnection.ts` | Typed browser client and safe response parser |
| `src/lib/googleCalendarConnection.test.ts` | Browser contract, serialization, safe-field allowlist, and error normalization tests |
| `src/components/GoogleCalendarConnectionCard.tsx` | Connection, plan gate, separate opt-in, reconnect, and disconnect UI |
| `src/components/GoogleCalendarConnectionCard.test.tsx` | Component state, eligibility, accessibility, and no-secret rendering tests |
| `src/components/SettingsModal.test.tsx` | Settings integration and regression tests |

### File modified in EXECUTE

| File | Planned responsibility |
|---|---|
| `src/components/SettingsModal.tsx` | Mount the connection card in account settings without changing Project Management ownership |

### Evidence files created in EXECUTE/EVL

| File | Planned responsibility |
|---|---|
| `process/features/project_management/active/google-calendar-integration_22-07-26/harness/phase-02/risk-gate.json` | High-risk class, approver, expiry, and gate state |
| `process/features/project_management/active/google-calendar-integration_22-07-26/harness/phase-02/context-snippets.json` | Redacted command, SQL/RLS, provider-mock, and UI evidence snippets |
| `process/features/project_management/active/google-calendar-integration_22-07-26/harness/phase-02/verification.json` | Artifact hashes, staleness, expected-vs-observed checks, and redaction result |
| `process/features/project_management/active/google-calendar-integration_22-07-26/harness/phase-02/review-decision.json` | Human PASS/FAIL decision and follow-ups |
| `process/features/project_management/active/google-calendar-integration_22-07-26/harness/phase-02/adversarial-validation.json` | Replay, cross-user, credential exposure, and disconnect-race results |

## Blast Radius

### Owned writes

Only the files listed in Touchpoints plus this plan and report are in Phase 2's accepted claim. `ProjectManagement.tsx`, task schema, sync queue/event mapping, read cursors/cache, billing migration/API, umbrella, SPEC, registry, and other phase files are outside this phase's write scope.

### Read-only dependencies

- `supabase/functions/_shared/auth.ts`
- `supabase/functions/_shared/cors.ts`
- `supabase/functions/_shared/responses.ts`
- `supabase/functions/_shared/ratelimit.ts`
- Phase 1's canonical billing/entitlement helpers and migration
- `src/context/AuthContext.tsx`
- `src/context/EntitlementContext.tsx`
- `src/lib/billing.ts`
- `src/lib/supabaseClient.ts`

### Cross-phase contract

- Phase 3 imports `crypto.ts`, `credentials.ts`, and `oauth.ts` read-only, and must acquire/release an operation lease around each bounded provider call.
- Phase 4 imports credential/generation helpers read-only and must bind cache/cursor rows to connection generation.
- Phases 3 and 4 own cleanup for tables they introduce. Their migrations must make stale-generation rows harmless and remove them when disconnect generation changes.
- Any need to edit a Phase 2-owned file later requires an explicit Phase 2 PLAN-SUPPLEMENT and registry coordination.

## Implementation Checklist

1. **Record PVL feasibility verdicts before implementation.** Run F1–F4, write redacted results to the phase evidence pack, and return to PLAN on any failed mechanism. Do not create live secrets or mutate provider/deployment state.
2. **Create failing crypto contract tests in `supabase/functions/tests/google_calendar_crypto_test.ts`.** Name scenarios for round trip, nonce uniqueness, AAD owner/generation mismatch, ciphertext tamper, unknown key version, invalid keyring, active-version write, old-version read, rewrap decision, oversized plaintext, and redacted errors.
3. **Implement `supabase/functions/_shared/google-calendar/crypto.ts`.** Add strict environment parsing, Web Crypto AES-256-GCM, SHA-256 digest helpers, constant safe errors, versioned decrypt/encrypt, and no logging of inputs or outputs. Make Step 2 green.
4. **Create the connection migration in `supabase/migrations/20260722200000_google_calendar_connection_credentials.sql`.** Add the four tables, checks, indexes, TTL support, RLS, safe projection, service-only credential/state/lease/disconnect functions, fixed search paths, grants/revokes, atomic consume, monotonic generation, and migration rollback notes.
5. **Prove database authorization before Edge integration.** In an isolated local Supabase instance, test anon, owner A, owner B, creator/non-owner, free owner, eligible owner, expired entitlement, and service role against every public/service function. Save only redacted IDs and result codes.
6. **Create failing OAuth and authorization tests in `supabase/functions/tests/google_calendar_connection_test.ts`.** Cover missing/invalid bearer, entitlement matrix, no owner parameter, state TTL/replay/concurrency, exact redirect, PKCE, required scopes, ID-token checks, missing refresh token, same/different account reconnect, opt-in separation, rate limiting, generic redirects, revoke failure, and no-secret responses.
7. **Implement `supabase/functions/_shared/google-calendar/oauth.ts`.** Freeze the four scopes, exact endpoints/redirect behavior, state and PKCE generation, token exchange, normalized provider errors, ID-token/account binding, refresh-token preservation rules, and bounded revoke client established by F2. Make provider URLs and clocks injectable for deterministic tests.
8. **Implement `supabase/functions/_shared/google-calendar/credentials.ts`.** Add service-only credential lifecycle, access-token memory handling, generation checks, atomic lease acquire/release, bounded TTL validation, disconnect begin/finalize, and fail-closed crypto/provider errors.
9. **Implement `supabase/functions/google-calendar-connection/index.ts`.** Add strict method/action routing, existing shared bearer validation, Phase 1 entitlement checks, per-owner rate limiting, transport-public callback state authorization, authorize/status/opt-in/disconnect actions, fixed clean redirects, and allowlisted response/log fields.
10. **Close the disconnect race gate.** Prove no lease can start after fencing, stale generation is rejected, an active pre-fence lease keeps status `disconnecting`, each Google HTTP request requires a new single-use lease, 15-second provider timeout is strictly below the 30-second lease, release is idempotent, expiry is bounded, local secrets clear even when revoke fails, and finalization is idempotent.
11. **Create failing browser contract tests in `src/lib/googleCalendarConnection.test.ts`.** Lock action request shapes without owner IDs, the safe response allowlist, unknown-field rejection, generic error mapping, callback-result parsing, and absence of credential/provider fields.
12. **Implement `src/lib/googleCalendarConnection.ts`.** Use the existing Supabase session/function boundary, typed actions, strict safe response parsing, and no browser persistence of authorization results beyond generic UI state.
13. **Create failing UI tests in `src/components/GoogleCalendarConnectionCard.test.tsx`.** Cover eligible/ineligible plans, separate connect and opt-in controls, connected-but-off default, disconnecting state, reconnect/denial/error guidance, keyboard and accessible status behavior, duplicate-action suppression, and no identity/secret rendering.
14. **Implement `src/components/GoogleCalendarConnectionCard.tsx`.** Render the state machine and call only the typed browser client. Do not expose creator controls or accept another user ID.
15. **Create/update `src/components/SettingsModal.test.tsx`, then integrate in `src/components/SettingsModal.tsx`.** Prove the card appears only in the owner account settings surface, existing Settings sections still work, callback result opens/refreshes the card safely, and no Project Management page file changes.
16. **Run focused verification.** Execute the focused Deno tests and focused Vitest files; resolve every failure inside the accepted blast radius or return to PLAN for a scope change.
17. **Run repository regression gates.** Execute full tests, typecheck, lint, build, SQL lint when local Supabase is available, and `git diff --check`. Record environment-based skips as CONDITIONAL, not PASS.
18. **Run the high-risk evidence pack and adversarial review.** Capture deterministic replay/cross-user/crypto/disconnect evidence, verify redaction and artifact freshness, obtain human review decision, and reject stale or secret-bearing evidence.
19. **Update the durable phase report.** Replace placeholders with exact changed files, command outcomes, acceptance evidence, known live-provider limits, deviations, rollback readiness, and user-confirmation state.
20. **Stop at the phase boundary.** Do not deploy, apply migrations, set secrets, change Google Console, enter Phase 3, or commit. Hand the exact selected plan and evidence paths to EVL/UPDATE PROCESS.

## Acceptance Criteria

Each carried SPEC criterion names its proving scenario and strategy. Each gate in Verification Evidence points back to the same criterion.

- **AC1 — Calendar consent is separate from login.** A Teamfair session never creates Google Calendar consent; only the dedicated owner action creates state and redirects. **proven by:** `calendar-consent-separated-from-login`; **strategy:** Fully-Automated.
- **AC2 — Connected user opt-in gates task sync.** Callback success leaves opt-in false; no service lease is available until the owner explicitly enables it. **proven by:** `connected-user-opt-in-gates-task-sync`; **strategy:** Fully-Automated.
- **AC3 — Creator cannot enable assignee calendar.** Browser/server contracts accept no assignee owner ID and deny non-owner/cross-user mutations. **proven by:** `creator-cannot-enable-assignee-calendar`; **strategy:** Fully-Automated.
- **AC4 — Calendar owner Pro Group entitlement matrix.** Only active account-scoped Pro Group/Pro Max owners may authorize or enable; cleanup remains possible after expiry. **proven by:** `calendar-owner-pro-group-entitlement-matrix`; **strategy:** Fully-Automated.
- **AC14 — Disconnect revokes access and clears state.** Disconnect fences work, attempts bounded revoke, always deletes local credentials/transient states, disables opt-in, advances generation, and reaches disconnected only after leases drain. **proven by:** `disconnect-revokes-access-and-clears-state`; **strategy:** Hybrid.
- **AC16 — Calendar server authorization denial matrix.** Missing/invalid auth, creator, free, expired, cross-user, and malformed action cases fail before sensitive data/provider use. **proven by:** `calendar-server-authorization-denial-matrix`; **strategy:** Fully-Automated.
- **AC17 — Refresh token browser exposure audit.** No browser response, render, state, storage, log, snapshot, or evidence contains credential/private OAuth material. **proven by:** `refresh-token-browser-exposure-audit`; **strategy:** Fully-Automated.
- **AC18 — Google consent and credential failure matrix.** State/PKCE/redirect/scope/ID-token/token/reconnect/revoke/crypto failures are safe and actionable without leaking secrets. **proven by:** `google-consent-credential-failure-matrix`; **strategy:** Hybrid.
- **AC20 — Google Calendar cross-user isolation.** Owner A cannot observe or mutate owner B's safe or private integration state through browser, RPC, or function actions. **proven by:** `google-calendar-cross-user-isolation`; **strategy:** Fully-Automated.

## Verification Evidence

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| `calendar-consent-separated-from-login` — auth-provider/login regressions plus explicit authorize-only state creation | Fully-Automated | AC1 |
| `connected-user-opt-in-gates-task-sync` — callback default false and lease denial until opt-in | Fully-Automated | AC2 |
| `creator-cannot-enable-assignee-calendar` — request schema and server denial tests | Fully-Automated | AC3 |
| `calendar-owner-pro-group-entitlement-matrix` — free, personal, group, max, expiry, cleanup exception | Fully-Automated | AC4 |
| `disconnect-revokes-access-and-clears-state` — mocked revoke plus isolated DB cleanup/fence evidence | Hybrid | AC14 |
| `calendar-server-authorization-denial-matrix` — Edge and RPC denial table | Fully-Automated | AC16 |
| `refresh-token-browser-exposure-audit` — response allowlist, rendered DOM, storage/log/evidence scans | Fully-Automated | AC17 |
| `google-consent-credential-failure-matrix` — deterministic provider fakes plus local callback probe | Hybrid | AC18 |
| `google-calendar-cross-user-isolation` — two-user isolated DB and endpoint matrix | Fully-Automated | AC20 |
| `credential-encryption-rotation-matrix` — Deno AES-GCM version/tamper/AAD suite | Fully-Automated | AC17, AC18 |
| `disconnect-generation-operation-fence` — concurrent lease/disconnect deterministic test | Fully-Automated | AC2, AC14, AC16 |
| `controlled-google-provider-release-check` — consent screen, scopes, offline token, exact redirect, revoke timing | Agent-Probe | AC14, AC18; release gate only, not Phase 2 local green |

### Exact commands

Run in this order from `D:/Python/Projects/Teamfair`:

1. `deno test supabase/functions/tests/google_calendar_crypto_test.ts supabase/functions/tests/google_calendar_connection_test.ts`
2. `pnpm test src/lib/googleCalendarConnection.test.ts src/components/GoogleCalendarConnectionCard.test.tsx src/components/SettingsModal.test.tsx`
3. `supabase db lint --local`
4. `pnpm test`
5. `pnpm typecheck`
6. `pnpm lint`
7. `pnpm build`
8. `git diff --check`

The local Edge feasibility command is `supabase functions serve google-calendar-connection --env-file <local-test-env-file>`. The env file must be outside version control and contain fake/local values only. If Deno, Supabase CLI, or local Postgres is unavailable, record the exact failure and keep the affected Hybrid gate CONDITIONAL.

### High-risk evidence pack

Risk class: **auth/security + secrets + external integration + migration/RLS**.

The evidence pack must contain:

- exact plan/SPEC/commit-or-worktree identity and expiry;
- redacted output from focused and regression commands;
- owner A/owner B/anon/service-role authorization results;
- state replay and concurrent callback result counts;
- encryption tamper/rotation results;
- disconnect/lease timeline with generation values and bounded timestamps;
- frontend response/render/storage/log scan result;
- expected-versus-observed checks and artifact hashes;
- human reviewer decision with unresolved gaps;
- no real refresh token, access token, authorization code, raw state, verifier, client secret, email, subject, ciphertext, or secret-key material.

## Test Infra Improvement Notes

- Add deterministic provider seams for authorization, JWKS/ID-token validation, token exchange, refresh, and revoke. Tests must never call live Google endpoints.
- Add reusable two-owner Supabase authorization fixtures only within an already approved test file or through PLAN-SUPPLEMENT; do not create an unclaimed helper file silently.
- Add a response/log/evidence redaction scanner to the Phase 2 test files. If a reusable cross-program scanner is desired, create a backlog plan rather than expanding this phase.
- Local Supabase runtime availability is not guaranteed. SQL lint alone does not prove RLS. The two-user runtime matrix stays Hybrid and CONDITIONAL until isolated runtime evidence exists.
- Live Google consent and revocation remain a release Agent-Probe. Backlog stub: `phase-05-google-provider-controlled-release-evidence` owns real-provider proof without making Phase 2 vacuously green.

## Rollback and Recovery

- Before deployment, rollback is file-level removal within this phase's owned paths; no external state exists.
- After a non-production migration, rollback first disables the Edge route, fences all connections, deletes private credentials/states/leases, then removes functions/tables only after evidence confirms no dependent Phase 3/4 rows.
- Never roll back by restoring plaintext tokens, lowering RLS, exposing the private schema, decrementing generation, or reusing a consumed state.
- A failed callback leaves the prior valid connection unchanged and consumes the attempted state.
- A failed credential replacement keeps the old credential only when account binding and generation still match; otherwise it fails closed into `attention_needed`.
- A revoke failure still deletes local credentials. Recovery is user-driven reconnect, not secret recovery from logs.
- Key rollback keeps old key versions available until row counts reach zero. Removing a still-referenced key is forbidden.
- Once Phase 3/4 depend on this schema, destructive rollback requires a new coordinated migration; never edit an applied migration.

## Phase Loop Progress

1. [ ] **RESEARCH** — re-read Phase 1 report in full, umbrella forward preview, frozen SPEC, current context routers, current billing/auth/schema/runtime, and official Google/Supabase docs.
2. [ ] **INNOVATE** — confirm callback topology, identity binding, encryption envelope, and disconnect lease approach; record the four-section Decision Summary.
3. [ ] **PLAN-SUPPLEMENT** — update this existing plan with research/innovate findings or record `n/a — research clean`; write the required Inner Loop Refresh Note if changed.
4. [ ] **PVL** — run feasibility gates, adversarial validation, REQ-TEST-LINK audit, and write V1–V7 validate-contract here. Validate is never skipped.
5. [ ] **EXECUTE** — implement only this exact selected plan after explicit approval; run per-section Level-1 tests.
6. [ ] **EVL** — run all verification and high-risk evidence gates; obtain user confirmation; keep unresolved developed behavior CONDITIONAL.
7. [ ] **UPDATE PROCESS** — archive only after EVL green, update durable context/report, run required audits, and commit only if the user separately asks.

**Validate-contract required before EXECUTE.** The umbrella Stable Program Goal remains authoritative. Each later phase must rerun RESEARCH before its own execution.

## Exit Gate

Phase 2 exits only when the Phase Completion Rules are satisfied and its report is evidence-backed. Its green check proves the connection, private credential, owner/entitlement, opt-in, generation, lease, and local disconnect contracts. It does not prove live Google Console configuration, production deployment, production migration, production secrets, or real provider behavior.

## Validate Contract

**Status:** PENDING OUTER PVL

PVL must populate V1–V7 and resolve at minimum:

- F1 mixed callback/protected-action topology;
- F2 supported ID-token and PKCE mechanism;
- F3 AES-GCM/keyring runtime behavior;
- F4 private-schema/service-role behavior;
- Phase 1 entitlement helper exact name and 79,000 VND drift resolution;
- entitlement-expiry-during-callback revoke-and-discard behavior;
- lease TTL, provider timeout, and disconnect-finalization invariant;
- exact Deno/Supabase test environment availability;
- all acceptance criterion ↔ proving gate links and any CONDITIONAL residual.

No V7 gap may add a file outside this plan's blast radius or a new public API/schema field without returning to the coordinator for scope authorization.

## VALIDATE Strategy Recommendation

`vc-agent-strategy-compare` was applied again at the PLAN → VALIDATE boundary for one completed high-risk plan.

| Option | Cost estimate | Suitability |
|---|---:|---|
| Sequential | 1 reviewer, about 3 review rounds; lowest token cost, highest elapsed time | Not recommended; auth, SQL, crypto, OAuth, UI, and race analysis would bottleneck and cross-check late. |
| Parallel subagents | 4 independent reviewers plus synthesis; about 2.5× single-review token cost | Good for initial dimension scans, but reviewers cannot resolve shared contract findings directly. |
| Workflow | One deterministic V1–V7 pipeline; about 1.5× single-review token cost | Required as the validation skeleton, but not enough alone for adversarial specialist debate. |
| `vc-team` | Database/RLS, Edge/OAuth, crypto/security, and tests/UI reviewers plus synthesizer; about 3× single-review token cost and 2 coordinated rounds | **Recommended.** Run the required V1–V7 workflow with a four-specialist team, then one synthesis/fix loop. |

The validate team must be read-only except for the validate-contract section and explicitly routed PVL supplements. Feasibility probes may use fake/local data only.

## Resume and Execution Handoff

**Primary execute anchor:** this direct Phase 2 plan file. The umbrella, frozen SPEC, registry, Phase 1 report, and Phase 2 report are supporting files, not alternate execute anchors.

1. Select exactly this file for Phase 2 work: `process/features/project_management/active/google-calendar-integration_22-07-26/phase-02-google-connection-and-credential-custody_PLAN_22-07-26.md`.
2. Read `process/context/all-context.md`, then follow planning, tests, auth, database, and UX/UI routers. Read `process/context/tests/all-tests.md` before changing test strategy.
3. Read the frozen SPEC, umbrella, accepted blast-radius registry, and verified Phase 1 report.
4. Filename reconciliation is complete: the umbrella uses this accepted Phase 2 filename, and no duplicate Phase 2 plan exists.
5. Run the 7-step phase loop. Do not skip inner RESEARCH, PLAN-SUPPLEMENT, or PVL.
6. Use the accepted Agent Team strategy with explicit file ownership.
7. Do not deploy, apply migrations, create secrets, change Google Console, use live provider accounts, commit, or start Phase 3.
8. If an implementation decision remains creative, stop and supplement this plan.

**Next step:** after review, say **ENTER VALIDATE MODE** with this exact plan path. VALIDATE is required before EXECUTE.
