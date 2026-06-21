# Research Report: Security Vulnerabilities HIGH-1 to HIGH-6

**Date**: 2026-06-21
**Status**: RESEARCH COMPLETE
**Target Findings**: HIGH-1 to HIGH-6

---

## Executive Summary

This report documents the research findings for the six high-severity security vulnerabilities identified in the Teamfair codebase (HIGH-1 to HIGH-6). It details the exact locations, core issues, blast radius, and exact remediation patterns for each finding. Additionally, it provides a comprehensive strategy for refactoring rate limit keying and addresses the critical testing gaps in the backend surfaces (Deno Edge Functions and Python AI agent).

---

## Detailed Findings

### HIGH-1: Rate Limiter Fails Open + No Rate Limiting when Unconfigured
- **Exact File**: [ratelimit.ts](file:///d:/Python/Projects/Teamfair/supabase/functions/_shared/ratelimit.ts)
- **Location**: Line 12-19 (limiter initialization) and Line 21-36 (`enforceRateLimit` function).
- **Core Issue**:
  1. **Fail-Open**: If Upstash Redis fails, the `try-catch` block catches Deno/network/Redis errors and logs `console.warn("Upstash rate limiting failed open:", error)` and then returns. This allows all requests to bypass rate limits during Redis outages.
  2. **No Fallback**: If Redis env variables (`UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`) are missing, `strictLimiter` is null, causing all requests to pass with only a warning log.
  3. **No Retry-After Header**: The HTTP 429 response thrown on rate limit matches does not return a `Retry-After` header.
- **Blast Radius**: API abuse, token-exhaustion, denial-of-service, or brute-force attacks are completely unimpeded if Redis is offline or unconfigured.
- **Proposed Remediation**:
  - Implement a local `InMemoryLimiter` class using a Deno `Map` to track request windows per-isolate.
  - Set `InMemoryLimiter` as the fallback when Upstash Redis is unconfigured or fails (ensures fail-secure/fail-closed behavior).
  - Calculate reset time remaining (`Math.ceil((resetTime - Date.now()) / 1000)`) and attach it to the `ApiError` metadata.
  - Modify `jsonError` in [responses.ts](file:///d:/Python/Projects/Teamfair/supabase/functions/_shared/responses.ts) to read this custom header and output it in the HTTP response headers.

```typescript
// Proposed InMemoryLimiter in ratelimit.ts
class InMemoryLimiter {
  private store = new Map<string, { count: number; reset: number }>();
  private limitCount: number;
  private windowMs: number;

  constructor(limitCount: number, windowSecs: number) {
    this.limitCount = limitCount;
    this.windowMs = windowSecs * 1000;
  }

  limit(identifier: string) {
    const now = Date.now();
    const entry = this.store.get(identifier);

    if (!entry || now > entry.reset) {
      const reset = now + this.windowMs;
      this.store.set(identifier, { count: 1, reset });
      return { success: true, reset };
    }

    if (entry.count >= this.limitCount) {
      return { success: false, reset: entry.reset };
    }

    entry.count++;
    return { success: true, reset: entry.reset };
  }
}
```

---

### HIGH-2: Python Agent In-Memory Rate Limiter is Trivially Bypassable
- **Exact File**: [server.py](file:///d:/Python/Projects/Teamfair/python/student_workspace_agent/server.py)
- **Location**: Lines 124-145 (`_check_rate_limit` function).
- **Core Issue**:
  1. **User-Controlled Key**: The rate limit is keyed by `student_name` (supplied in the request body). An attacker can bypass the limit by varying/modifying the `student_name` field on each request.
  2. **Per-Process Store**: The store `_rate_limit_store` is a local Python dictionary. It is not shared across multi-worker environments (Uvicorn workers or replica containers), allowing multiple requests to pass concurrently.
  3. **Incomplete Coverage**: The heavy `/verify-task` endpoint does not have rate limiting at all, opening it up to SSRF and CPU exhaustion.
- **Blast Radius**: Attackers can abuse contribution analysis and task verification endpoints repeatedly.
- **Proposed Remediation**:
  - Key the rate limit by the authenticated user's ID (`user["sub"]` from JWT claims) or the client's IP address (extracted from headers like `X-Forwarded-For`).
  - Add rate limiting to the `/verify-task` endpoint using the same IP/User key.
  - Implement a Redis-backed rate limiter for production environments, or document the limitations of local dictionary storage in multi-worker environments.

---

### HIGH-3: CORS on Python Agent Allows Wildcard Headers + Broad Vercel Preview Regex
- **Exact File**: [server.py](file:///d:/Python/Projects/Teamfair/python/student_workspace_agent/server.py)
- **Location**: Lines 27-34 (CORS definitions) and Lines 53-60 (middleware instantiation).
- **Core Issue**:
  1. **Wildcard Headers**: `allow_headers=["*"]` allows any custom headers to be sent in cross-origin requests.
  2. **Permissive Regex**: The default `_DEFAULT_ORIGIN_REGEX` (`r"^https://teamfair(?:-[a-z0-9-]+)*\.vercel\.app$"`) matches any subdomain of Vercel that starts with `teamfair-`. Anyone can create a Vercel project with a prefix of `teamfair-` (e.g. `teamfair-evil.vercel.app`) or create a branch named `evil` on their fork, resulting in an authorized preview URL that can make cross-origin requests to the agent server.
- **Blast Radius**: Cross-origin attacks and unauthorized API calls from external malicious pages hosted on Vercel preview domains.
- **Proposed Remediation**:
  - Restrict `allow_headers` to a precise, safe whitelist: `["Content-Type", "Authorization"]`.
  - Tighten `_DEFAULT_ORIGIN_REGEX` to prevent wildcard hijackings. Narrow the regex to match only official preview branch structures, or allow configuring a specific regex strictly via `STUDENT_AGENT_CORS_ORIGIN_REGEX`.

---

### HIGH-4: Error Responses Leak Internal Exception Details
- **Exact File**: [server.py](file:///d:/Python/Projects/Teamfair/python/student_workspace_agent/server.py)
- **Location**: Line 109 (`/chat`), Line 193 (`/analyze-contribution`), and Line 288 (`/verify-task`).
- **Core Issue**:
  - The catch blocks raise `HTTPException(status_code=500, detail=f"Agent error: {e}")` (or similar messages including `{e}`).
  - This exposes internal stack traces, directory paths, database structures, internal API URLs, and library versions in the response payload.
- **Blast Radius**: Information disclosure that aids attackers in map-building internal architectures, paths, and dependencies for target exploitation.
- **Proposed Remediation**:
  - Add standard python logging (`logger.exception("...")`) to capture full exceptions server-side.
  - Return a generic error message (e.g. `"Internal server error"`) to the client, concealing error details.

---

### HIGH-5: Indirect Prompt Injection via Unsanitized Workspace Data
- **Exact Files**: [server.py](file:///d:/Python/Projects/Teamfair/python/student_workspace_agent/server.py) and [guardrails.py](file:///d:/Python/Projects/Teamfair/python/student_workspace_agent/guardrails.py)
- **Location**: `server.py` lines 89-94 (workspace model validation) and `guardrails.py` (`validate_input` definition).
- **Core Issue**:
  - Input guardrails are only run on the user's `message` field (via `validate_input`).
  - The `body.workspace` dict contains user-supplied text fields (task names, descriptions, comments, logs) that are validated by Pydantic but never scanned for injection patterns.
  - When the LLM reads workspace data using tools, embedded prompt injections inside workspace fields will execute.
- **Blast Radius**: An attacker can insert an injection payload in a task description or comment, triggering unauthorized prompt execution or system prompt leaks when the assistant views the workspace.
- **Proposed Remediation**:
  - Create a recursive scanner function to traverse all string fields in `body.workspace`.
  - Scan each string field using the injection patterns/rules from `validate_input`.
  - Reject the chat request if any workspace field fails the security scan.

```python
def validate_workspace_strings(data: Any) -> tuple[bool, str | None]:
    """Recursively scan all string values in nested dictionaries/lists for injection patterns."""
    if isinstance(data, dict):
        for k, v in data.items():
            safe, reason = validate_workspace_strings(v)
            if not safe:
                return False, f"Key '{k}': {reason}"
    elif isinstance(data, list):
        for idx, item in enumerate(data):
            safe, reason = validate_workspace_strings(item)
            if not safe:
                return False, f"Index {idx}: {reason}"
    elif isinstance(data, str):
        res = validate_input(data)
        if not res["safe"]:
            return False, res["reason"]
    return True, None
```

---

## Rate Limit Keying Refactor

### Deno Edge Functions
Currently, rate limits are keyed by `${user.id}:${action}` (limit of 10 requests per 60 seconds).
To harden this, we propose a multi-layered keying structure:
1. **User Global Limit**: Add a check for `${user.id}:global` (e.g., limit of 30 requests per 60 seconds) to prevent a user from flooding all actions simultaneously.
2. **IP Global Limit**: Extract client IP from headers (`x-forwarded-for` or `cf-connecting-ip`) and check `ip:${clientIp}:global` (e.g., limit of 60 requests per 60 seconds) to mitigate DDoS/unauthenticated flooding.
3. **Sensitive Operations Limit**: Enforce tighter limits (e.g., 3 requests per 60 seconds) for sensitive actions like `create_invite` or `join_with_invite`, keyed by `${user.id}:${action}`.

### Python AI Agent Server
Currently, limits are keyed by the user-controlled `student_name`. We will:
1. **Key by Authenticated User**: Use the `user["sub"]` UUID from the JWT token validated by FastAPI.
2. **Key by Client IP**: Fall back to request client IP if needed.
3. **Cover all heavy endpoints**: Enforce this rate limit keying on both `/analyze-contribution` and `/verify-task`.

---

## Test Gaps & Verification Strategy

### Current Gaps
- There are **zero** automated tests for:
  - Supabase Edge Functions (`team-api`, `delete-user-auth`)
  - Python AI agent backend (`server.py`, `auth.py`, `guardrails.py`, etc.)
- There are no tests verifying:
  - Rate limiting behavior (fail-closed, header propagation).
  - CORS validations.
  - Exception sanitization.
  - Workspace input sanitization/injection validation.

### Proposed Verification Plan
To verify the implemented fixes, we will write:
1. **Python Unit Tests**:
   - Create a `python/tests/` folder with tests utilizing FastAPI's `TestClient`.
   - Test inputs with prompt injection inside workspace snapshots to verify they get rejected.
   - Test exception routes to ensure HTTP 500 error details are hidden.
   - Test CORS middleware with allowed and disallowed headers/origins.
   - Mock time and test that rate limiting triggers after exceeding the threshold (verifying client IP / user ID keying).
2. **Deno Edge Function Tests**:
   - Write unit tests under `supabase/functions/tests/` using Deno's built-in testing framework (`deno test`).
   - Mock the Redis database and test:
     - Rate limit success / 429 response.
     - Fallback to `InMemoryLimiter` when Redis errors/is unconfigured.
     - Custom `Retry-After` header propagation in responses.
     - Addition of HTTP security headers on all builder responses.
