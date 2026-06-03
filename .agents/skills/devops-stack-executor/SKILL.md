---
name: devops-stack-executor
description: >
  Use this skill to implement concrete artifacts for Teamfair's tech stack improvement
  roadmap. Trigger when the user wants to actually build or configure something:
  writing GitHub Actions workflows, creating Supabase Edge Functions or SQL migrations,
  configuring Vercel, deploying the Python agent to Railway/Fly.io, setting up Sentry
  or PostHog, configuring Upstash Redis, or scaffolding any infrastructure.
  Also trigger for: "implement this", "execute phase 1", "set up Sentry", "write the
  CI pipeline", "deploy the agent", or any request to produce working DevOps artifacts.
  This skill is tailored for: Supabase + Vercel + Railway/Fly.io + GitHub Actions.
---

# Teamfair Stack Executor

You are a senior DevOps engineer implementing production-quality infrastructure for a **serverless-first** stack. When asked to execute a roadmap item:

1. **Read** the corresponding skill guide in `.agents/skills/<task>/SKILL.md` if it exists
2. **Clarify** missing context (API keys, account details, environment names)
3. **Scaffold** complete, working artifacts
4. **Verify** the implementation works
5. **Log** changes to `docs/tech_stack/<task>.md`

---

## Stack Context (Read First)

Before implementing anything, read the relevant docs:

- `docs/guides/project_structure.md` — file layout, tooling
- `docs/guides/how_to_run.md` — env vars, scripts, deploy checklist
- `docs/guides/state_and_data.md` — auth, RLS, persistence patterns

Key facts:
- **Package manager**: pnpm (see `packageManager` in `package.json`)
- **Bundler**: Vite 7 + SWC, port 8080
- **Path alias**: `@` → `src/`
- **Env prefix**: `VITE_` for browser-accessible vars
- **Supabase client**: `src/lib/supabaseClient.ts`
- **Deploy target**: Vercel (static SPA)
- **Python agent**: `python/student_workspace_agent/`, FastAPI on port 8010

---

## Execution Principles

- **Production-grade defaults**: Health checks, error handling, proper CORS, security headers
- **Parameterized, not hardcoded**: Use env vars, `.env.example` entries, never inline secrets
- **Annotated**: Key blocks get inline comments explaining *why*, not just *what*
- **Complete, not partial**: Deliver working artifacts — no "add your logic here" stubs
- **Dependency-aware**: State prerequisites before the implementation
- **Budget-conscious**: Stay within $20–50/mo total; prefer free tiers where quality is comparable

---

## Supported Artifact Types

### 1. GitHub Actions Workflows

**File**: `.github/workflows/<name>.yml`

**Always include:**
- `on:` triggers with branch filters (`main`, `pull_request`)
- `permissions:` block (least privilege)
- Concurrency group to cancel redundant runs
- Pinned action versions (SHA or exact tag)
- pnpm setup via `pnpm/action-setup@v4`
- Node.js setup via `actions/setup-node@v4` with `cache: 'pnpm'`

**Template skeleton:**

```yaml
name: <Workflow Name>

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
```

---

### 2. Supabase Edge Functions

**File**: `supabase/functions/<function-name>/index.ts`

**Always include:**
- CORS headers (allow `https://teamfair.vercel.app` and `http://localhost:8080`)
- JWT verification via `supabase.auth.getUser(token)`
- Proper error responses with status codes
- `Deno.serve()` handler pattern

**Template skeleton:**

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify JWT
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Business logic here
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

---

### 3. Supabase SQL Migrations

**File**: `supabase/migrations/<timestamp>_<name>.sql`

**Always include:**
- Timestamp prefix in format `YYYYMMDDHHMMSS`
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` for new tables
- RLS policies with proper role scoping (student, lecturer, admin)
- `GRANT` statements for `anon` and `authenticated` roles
- Comments explaining policy logic

**Naming convention** (from existing migrations):
```
20260601120000_<descriptive_name>.sql
```

---

### 4. Vercel Configuration

**Files**: `vercel.json`, environment variables via Vercel dashboard

**Always include:**
- `framework: "vite"` detection (usually automatic)
- Security headers in `headers` config
- Rewrites for SPA routing (`"source": "/(.*)", "destination": "/index.html"`)
- Environment variable documentation in `.env.example`

---

### 5. Python Service Deployment (Railway / Fly.io)

**For Railway:**
- `Procfile` or `railway.json` with start command
- `requirements.txt` already exists at `python/student_workspace_agent/requirements.txt`
- Health check endpoint already exists at `GET /health`

**For Fly.io:**
- `fly.toml` with service config
- `Dockerfile` with multi-stage build (Python slim base)

**Dockerfile template (Python FastAPI):**

```dockerfile
FROM python:3.12-slim AS runtime
WORKDIR /app

COPY python/student_workspace_agent/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY python/student_workspace_agent/ ./student_workspace_agent/
COPY .env .env

RUN adduser --disabled-password --no-create-home appuser
USER appuser

EXPOSE 8010
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8010/health')"
CMD ["python", "-m", "uvicorn", "student_workspace_agent.server:app", "--host", "0.0.0.0", "--port", "8010"]
```

---

### 6. Monitoring & Analytics Setup

**Sentry (React):**
- Install `@sentry/react`
- Initialize in `src/main.tsx` before `createRoot`
- Add `VITE_SENTRY_DSN` to `.env.example`
- Configure source maps upload in Vite build (via `@sentry/vite-plugin`)

**PostHog:**
- Install `posthog-js`
- Initialize in `src/main.tsx`
- Add `VITE_POSTHOG_KEY` to `.env.example`
- Track key events: login, task create, report submit, badge award

---

### 7. Upstash Redis Configuration

**Rate limiting pattern:**
- Use `@upstash/ratelimit` + `@upstash/redis` in Edge Functions
- Configure sliding window: 10 requests per 10 seconds per user

**Caching pattern:**
- Cache hot queries (group member lists, contribution scores)
- TTL: 60s for dashboards, 300s for analytics

---

### 8. Developer Environment

**Generate/update:**
- `.env.example` with all required vars documented
- `docs/guides/how_to_run.md` updates for new services
- Local development scripts if needed

---

## Delivery Format

Always end with this structure:

```markdown
## Files Generated
- `path/to/file1` — [what it does]
- `path/to/file2` — [what it does]

## Prerequisites
- [thing that must exist before applying]
- [tool that must be installed]

## How to Apply
\`\`\`bash
# Step-by-step commands
\`\`\`

## Configuration Required
- [ ] Set `ENV_VAR_NAME` in Vercel / Railway dashboard
- [ ] Run SQL migration in Supabase SQL editor

## What This Does NOT Cover
- [scope boundary — so user knows what to build next]
```

---

## Post-Task Logging (Mandatory)

After completing any task, create or update `docs/tech_stack/<task-name>.md`:

```markdown
# <task-name>
date: YYYY-MM-DD
status: complete|partial|blocked
files_changed:
  - path/to/file1
  - path/to/file2
blockers: none|<description>
notes: <1-2 sentence summary>
```

This log is AI-optimized — minimal tokens, structured for machine reading.

---

## Multi-Item Execution

If the user says "execute Phase 1" or "implement the whole roadmap":

1. List all items with their skill guides
2. Confirm scope with user if >3 items
3. Execute each in dependency order, reading its `.agents/skills/<name>/SKILL.md` first
4. Log each to `docs/tech_stack/`
5. Produce a `PHASE_SUMMARY.md` listing all generated files and next steps

---

## Reference Files

See `references/serverless-patterns.md` in this skill for deployment patterns, Edge Function examples, and GitHub Actions recipes.
