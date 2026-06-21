import { assertEquals, assertRejects } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { enforceRateLimit } from "../_shared/ratelimit.ts";
import { jsonOk, jsonError, ApiError } from "../_shared/responses.ts";

Deno.test("Deno Rate Limiter - Fails Closed when Unconfigured", async () => {
  // strictLimiter will be null if env vars are missing
  await assertRejects(
    async () => {
      await enforceRateLimit("test-user-id");
    },
    ApiError,
    "Rate limiting is unconfigured."
  );
});

Deno.test("Deno Responses - Security Headers injected", () => {
  const req = new Request("https://example.com");
  const res = jsonOk(req, { foo: "bar" });
  
  assertEquals(res.headers.get("Cache-Control"), "no-store");
  assertEquals(res.headers.get("X-Content-Type-Options"), "nosniff");
  assertEquals(res.headers.get("Strict-Transport-Security"), "max-age=31536000; includeSubDomains");
  assertEquals(res.headers.get("X-Frame-Options"), "DENY");
});

Deno.test("Deno Responses - Retry-After added on 429", () => {
  const req = new Request("https://example.com");
  const error = new ApiError("rate_limited", "Too fast", 429, 45);
  const res = jsonError(req, error);
  
  assertEquals(res.status, 429);
  assertEquals(res.headers.get("Retry-After"), "45");
  assertEquals(res.headers.get("Cache-Control"), "no-store");
});
