# deploy-ai-agent
date: 2026-06-03
status: repo-ready
files_changed:
  - python/Dockerfile (NEW)
  - python/.dockerignore (NEW)
  - src/components/feature-groups/StudentAgentSidebar.tsx
  - docs/guides/how_to_run.md
  - docs/tech_stack/deploy-ai-agent.md (NEW)
env_vars_to_add:
  - OPENROUTER_API_KEY (Railway)
  - OPENROUTER_HTTP_REFERER=https://teamfair.vercel.app (Railway)
  - OPENROUTER_X_TITLE=Teamfair (Railway)
  - VITE_STUDENT_AGENT_URL=<Railway public URL> (Vercel)
blockers:
  - Live Railway service has not been created in this repo session.
  - Vercel cannot be pointed at the agent until Railway returns a public URL.
notes:
  - Railway is the selected first deployment target.
  - Docker startup reads PORT with a default of 8010 for local/container portability.
  - The browser forwards the Supabase access token to the agent endpoint, but the Python server does not yet validate it.
