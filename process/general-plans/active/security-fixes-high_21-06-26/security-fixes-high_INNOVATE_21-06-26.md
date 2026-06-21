# Innovation and Decisions: Security Vulnerabilities HIGH-1 to HIGH-6

## Decision Summary

### HIGH-1: Fail-Closed Deno Rate Limiter
- **Option A**: Check if `strictLimiter` is null, log and throw standard `ApiError`. Catch other Redis/Upstash errors and map to `ApiError` with 429 status and dynamic `Retry-After`.
- **Option B**: Implement in-memory fallback.
- **Selected**: **Option A**. Since the system relies on Upstash for accurate cross-instance rate limiting and the prompt specifies "fails closed (deny request on error/unconfigured)", we will strictly deny requests if rate limiting cannot be performed. This prevents bypass attacks by intentionally causing Redis errors.

### HIGH-2: Python In-Memory Rate Limiter JWT Keying
- **Option A**: Retrieve user ID from `user["sub"]` claim. Use this as the dictionary key. Fall back to client IP only if JWT token lacks a `sub` claim. Add verification on `/analyze-contribution` and `/verify-task`.
- **Selected**: **Option A**. This aligns with the requirement "Python rate limiter keys by authenticated user ID (JWT sub claim)".

### HIGH-3: Python CORS Restrictions
- **Option A**: Set `allow_headers=["Content-Type", "Authorization"]` and update the default regex to match official preview paths for the username `nakien0205`.
- **Selected**: **Option A**. This restricts wildcards while retaining support for local development and authorized Vercel deployments.

### HIGH-4: Exception Sanitization
- **Option A**: Use standard `logging.getLogger` to log the trace to server logs. Change `HTTPException` detail to generic messages.
- **Selected**: **Option A**. Prevents details disclosure.

### HIGH-5: Indirect Prompt Injection Prevention
- **Option A**: Recursively traverse incoming workspace dicts. Match all string properties against the existing regex patterns from `validate_input` before invoking the model.
- **Selected**: **Option A**. Comprehensive scanning blocks indirect payloads in metadata/task attributes.

### HIGH-6: HTTP Security Headers
- **Option A**: Inject security headers (`Cache-Control`, `X-Content-Type-Options`, `Strict-Transport-Security`, `X-Frame-Options`) directly inside `jsonOk` and `jsonError` helpers in `responses.ts`.
- **Selected**: **Option A**. Centralized response builders ensure all API endpoints return security headers automatically.
