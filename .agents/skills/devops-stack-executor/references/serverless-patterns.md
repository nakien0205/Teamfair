# Serverless Patterns Reference

Common patterns for Teamfair's stack: Supabase Edge Functions, Vercel, Railway, GitHub Actions.

---

## Supabase Edge Function Patterns

### CORS Helper (reuse across all Edge Functions)

```typescript
const ALLOWED_ORIGINS = [
  "https://teamfair.vercel.app",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };
}
```

### Auth Guard Pattern

```typescript
async function getAuthUser(req: Request, supabase: SupabaseClient) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}
```

### Service Role Client (for admin operations)

```typescript
// Use SUPABASE_SERVICE_ROLE_KEY for operations that bypass RLS
// NEVER expose this key to the client
const adminClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
```

---

## GitHub Actions Patterns

### pnpm + Vite Build

```yaml
- uses: pnpm/action-setup@v4
  with:
    version: 9

- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: 'pnpm'

- run: pnpm install --frozen-lockfile
- run: pnpm lint
- run: pnpm test -- --reporter=verbose
- run: pnpm build
  env:
    VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
    VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
```

### Supabase Type Generation Step

```yaml
- name: Generate Supabase Types
  run: |
    npx supabase gen types typescript \
      --project-id ${{ secrets.SUPABASE_PROJECT_ID }} \
      > src/types/supabase.ts
  env:
    SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

### Concurrency + Permissions Block

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read
  pull-requests: write  # Only if posting PR comments
```

---

## Railway Deployment Patterns

### railway.json

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "python -m uvicorn student_workspace_agent.server:app --host 0.0.0.0 --port $PORT",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 10,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

### Minimal Dockerfile for Python FastAPI

```dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY python/student_workspace_agent/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY python/student_workspace_agent/ ./student_workspace_agent/

RUN adduser --disabled-password --no-create-home appuser
USER appuser

ENV PORT=8010
EXPOSE $PORT
CMD ["python", "-m", "uvicorn", "student_workspace_agent.server:app", "--host", "0.0.0.0", "--port", "8010"]
```

---

## Fly.io Deployment Patterns

### fly.toml

```toml
app = "teamfair-ai-agent"
primary_region = "sin"  # Singapore for Vietnam users

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 8010
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0

[[http_service.checks]]
  interval = "30s"
  timeout = "5s"
  grace_period = "10s"
  method = "GET"
  path = "/health"

[env]
  PYTHONUNBUFFERED = "1"
```

---

## Upstash Redis Patterns

### Rate Limiting in Supabase Edge Function

```typescript
import { Ratelimit } from "https://esm.sh/@upstash/ratelimit";
import { Redis } from "https://esm.sh/@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),  // UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
  limiter: Ratelimit.slidingWindow(10, "10 s"),  // 10 requests per 10 seconds
  analytics: true,
});

// In your handler:
const { success, limit, remaining } = await ratelimit.limit(user.id);
if (!success) {
  return new Response(JSON.stringify({ error: "Rate limited" }), {
    status: 429,
    headers: {
      ...corsHeaders,
      "X-RateLimit-Limit": limit.toString(),
      "X-RateLimit-Remaining": remaining.toString(),
    },
  });
}
```

### Simple Cache Pattern

```typescript
import { Redis } from "https://esm.sh/@upstash/redis";

const redis = Redis.fromEnv();

async function cachedQuery<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  const cached = await redis.get<T>(key);
  if (cached) return cached;

  const fresh = await fetcher();
  await redis.set(key, fresh, { ex: ttlSeconds });
  return fresh;
}
```

---

## Sentry React Integration Pattern

```typescript
// src/main.tsx — BEFORE createRoot
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
  ],
  tracesSampleRate: import.meta.env.MODE === "production" ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enabled: import.meta.env.PROD,
});
```

---

## PostHog Integration Pattern

```typescript
// src/main.tsx
import posthog from "posthog-js";

if (import.meta.env.VITE_POSTHOG_KEY) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: "https://us.i.posthog.com",
    capture_pageview: true,
    capture_pageleave: true,
    persistence: "localStorage",
  });
}
```

### Event Tracking Convention

```typescript
// Use snake_case for event names, include relevant context
posthog.capture("task_created", { group_id: group.id, status: "todo" });
posthog.capture("report_submitted", { group_id: group.id, type: "peer" });
posthog.capture("badge_awarded", { badge_type: "contributor" });
```
