---
name: deploy-ai-agent
description: >
  Deploy the Python FastAPI AI agent to Railway or Fly.io for production use.
  Trigger when: deploying the AI agent, hosting the Python service, or executing roadmap item P0-3.
---

# P0-3: Deploy Python AI Agent to Production

## Context
The Python FastAPI student workspace agent (`python/student_workspace_agent/`) currently only runs locally on port 8010, accessed via Vite's dev proxy. In production on Vercel, the AI chat sidebar doesn't work because there's no hosted agent. The `VITE_STUDENT_AGENT_URL` env var exists but points nowhere.

**Priority**: P0 — Critical  
**Effort**: M (Medium — ~2-3 hours)  
**Budget**: ~$5/mo (Railway Starter plan)

## Prerequisites
- Railway account created at https://railway.com (recommended) OR Fly.io account at https://fly.io
- `OPENROUTER_API_KEY` available (already in `.env`)
- Read `docs/guides/student_workspace_agent.md` — understand the agent architecture
- Read `python/student_workspace_agent/server.py` — understand the FastAPI endpoints

## Step-by-Step Instructions (Railway — Recommended)

### Step 1: Create Dockerfile for the agent

Create `python/Dockerfile`:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install dependencies first for layer caching
COPY student_workspace_agent/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY student_workspace_agent/ ./student_workspace_agent/

# Security: run as non-root
RUN adduser --disabled-password --no-create-home appuser
USER appuser

# Railway injects PORT env var
ENV PORT=8010
EXPOSE ${PORT}

# Health check
HEALTHCHECK --interval=30s --timeout=5s \
  CMD python -c "import urllib.request; urllib.request.urlopen(f'http://localhost:{__import__(\"os\").environ.get(\"PORT\", 8010)}/health')" || exit 1

CMD ["python", "-m", "uvicorn", "student_workspace_agent.server:app", "--host", "0.0.0.0", "--port", "8010"]
```

### Step 2: Create `.dockerignore` in `python/`

Create `python/.dockerignore`:

```
__pycache__
*.pyc
*.pyo
.env
.venv
*.egg-info
.git
```

### Step 3: Update CORS in `server.py`

Read `python/student_workspace_agent/server.py` and verify the CORS configuration includes:
- `https://teamfair.vercel.app`
- `http://localhost:8080`

The code already supports `STUDENT_AGENT_CORS_ORIGINS` env var override. Verify this is correctly implemented.

### Step 4: Deploy to Railway

1. Go to https://railway.com → New Project → Deploy from GitHub Repo
2. Select the Teamfair repository
3. Set the **Root Directory** to `python/`
4. Set **Dockerfile Path** to `Dockerfile` (relative to root directory)
5. Add environment variables:
   - `OPENROUTER_API_KEY` — your API key
   - `OPENROUTER_HTTP_REFERER` — `https://teamfair.vercel.app`
   - `OPENROUTER_X_TITLE` — `Teamfair`
   - `PORT` — `8010` (Railway may override this)
6. Set up health check: path `/health`, interval 30s
7. Deploy and note the generated public URL (e.g., `https://teamfair-ai-agent-production.up.railway.app`)

### Step 5: Update Vercel environment variable

In the Vercel dashboard for teamfair:
- Add `VITE_STUDENT_AGENT_URL` = the Railway public URL (no trailing slash)

### Step 6: Verify the agent's client-side integration

Read the frontend code that calls the agent (likely in `AIChatWidget.tsx` or similar). Verify it:
1. Uses `VITE_STUDENT_AGENT_URL` as the base URL when available
2. Falls back to `/api/student-agent` for local dev (Vite proxy)
3. Passes the user's auth token in requests

If the frontend code hardcodes localhost or the proxy path without checking the env var, update it:

```typescript
const agentBaseUrl = import.meta.env.VITE_STUDENT_AGENT_URL || "/api/student-agent";
```

### Step 7: Test end-to-end

1. Deploy to Railway → verify `GET /health` returns 200
2. Deploy updated Vercel env var → redeploy the frontend
3. Open `https://teamfair.vercel.app` → log in → open AI chat sidebar
4. Send a test message → verify response comes back from the hosted agent

## Alternative: Fly.io Deployment

If using Fly.io instead of Railway:

### Create `python/fly.toml`:

```toml
app = "teamfair-ai-agent"
primary_region = "sin"

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
```

### Deploy commands:

```bash
cd python
fly launch --copy-config
fly secrets set OPENROUTER_API_KEY=<key>
fly secrets set OPENROUTER_HTTP_REFERER=https://teamfair.vercel.app
fly deploy
```

## Verification

- [ ] `GET /health` on the deployed URL returns `200 OK`
- [ ] `POST /chat` with a test message returns an AI response
- [ ] CORS headers allow `https://teamfair.vercel.app`
- [ ] AI chat works from the production frontend
- [ ] Agent auto-sleeps when not in use (Railway/Fly.io free behavior)
- [ ] `pnpm build` succeeds on the frontend (no broken env vars)

## Post-Task Logging

Create `docs/tech_stack/deploy-ai-agent.md`:

```markdown
# deploy-ai-agent
date: <today>
status: complete
files_changed:
  - python/Dockerfile (NEW)
  - python/.dockerignore (NEW)
  - python/student_workspace_agent/server.py (if CORS updated)
env_vars_added:
  - OPENROUTER_API_KEY (railway)
  - OPENROUTER_HTTP_REFERER (railway)
  - OPENROUTER_X_TITLE (railway)
  - VITE_STUDENT_AGENT_URL (vercel)
blockers: none
notes: Python agent deployed to Railway. Public URL set as VITE_STUDENT_AGENT_URL on Vercel.
```
