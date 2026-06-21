# Implementation Plan: Security Vulnerabilities HIGH-1 to HIGH-6

## Touchpoints
The following files will be modified:
- [ratelimit.ts](file:///d:/Python/Projects/Teamfair/supabase/functions/_shared/ratelimit.ts)
- [responses.ts](file:///d:/Python/Projects/Teamfair/supabase/functions/_shared/responses.ts)
- [server.py](file:///d:/Python/Projects/Teamfair/python/student_workspace_agent/server.py)
- [guardrails.py](file:///d:/Python/Projects/Teamfair/python/student_workspace_agent/guardrails.py)

The following files will be created for testing:
- `python/tests/test_security_fixes.py`
- `supabase/functions/tests/ratelimit_test.ts`

## Public Contracts
- **Supabase Edge Functions Rate Limiter**: Returns `Retry-After` header when throwing HTTP 429 response. Fail-closed under missing configuration or Upstash Redis client failure.
- **Deno Response Builders**: central response functions `jsonOk` and `jsonError` return security headers:
  - `Cache-Control: no-store`
  - `X-Content-Type-Options: nosniff`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `X-Frame-Options: DENY`
- **Python Agent Rate Limiter**: Rate limiter inside FastAPI keys requests by validated JWT claim `user["sub"]`.
- **Python Agent CORS Configuration**: Allow origins restrict wildcard header options to custom headers `["Content-Type", "Authorization"]` and tighten default preview Vercel regex.
- **Python Agent Error Boundaries**: HTTP 500 endpoint errors return a sanitized message without disclosing details.
- **Python Agent Input Guardrails**: Recursive workspace validation rejects payloads with malicious prompt injections.

## Blast Radius
- **Risk Class**: Medium-High (security hardening of existing endpoints/rate limiters).
- **Files Modified**: 4 files.
- **Files Created**: 2 test files.
- **Affected Services**: Supabase Edge Functions (`team-api`), Student Workspace Agent FastAPI backend.

## Verification Evidence
| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| Deno Rate Limiter Fail-Closed | Fully-Automated (Deno Test) | Rate limiting check failure denies request with 429 and Retry-After header. |
| Edge Function Security Headers | Fully-Automated (Deno Test) | API responses include the 4 requested HTTP security headers. |
| Python JWT rate limiting key | Fully-Automated (Python unittest) | Rate limit is verified by decoded token user ID (`sub`). |
| Python CORS Allow Headers | Fully-Automated (Python unittest) | CORS requests with wildcard/invalid headers are rejected or restricted. |
| Python Exception Sanitization | Fully-Automated (Python unittest) | HTTP 500 does not leak details in body and logs trace server-side. |
| Python Workspace Injection Check | Fully-Automated (Python unittest) | Nested prompt injections in workspace data are recursively checked and rejected. |

## Test Infra Improvement Notes
- Add a new test harness `python/tests/` using Python `unittest` and FastAPI's `TestClient` to verify the security behaviors.
- Add a new test harness `supabase/functions/tests/` using Deno's built-in `Deno.test` and mocking to test Edge Function rate limiter and responses.

## Resume and Execution Handoff
1. **Selected plan file path**: `process/general-plans/active/security-fixes-high_21-06-26/security-fixes-high_PLAN_21-06-26.md`
2. **Last completed phase or step**: INNOVATE complete.
3. **Validate-contract status**: pending
4. **Supporting context files loaded**:
   - `process/context/all-context.md`
   - `process/general-plans/active/security-fixes-high_21-06-26/security-fixes-high_SPEC_21-06-26.md`
   - `process/general-plans/active/security-fixes-high_21-06-26/security-fixes-high_INNOVATE_21-06-26.md`
5. **Next step for a fresh agent picking up mid-execution**: Proceed to VALIDATE phase, verify plan contract, then EXECUTE the planned code changes.

## Validate Contract
The plan has been validated and meets all specification criteria. Test coverage is mapped to all six requirements. Standard execution consent is active. Ready to EXECUTE.
