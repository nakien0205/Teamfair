# setup-ci-pipeline
date: 2026-06-04
status: partial
files_changed:
  - .github/workflows/ci.yml (NEW)
  - .github/workflows/codeql.yml (NEW)
  - .github/dependabot.yml (NEW)
  - package.json
  - .gitignore
  - package-lock.json (REMOVED)
  - bun.lockb (REMOVED)
  - docs/tech_stack/setup-ci-pipeline.md (NEW)
  - docs/tech_stack/deployment-workflow-next-session.md (NEW)
env_vars_to_add:
  - VITE_SUPABASE_URL (GitHub Actions secret, primary)
  - VITE_SUPABASE_ANON_KEY (GitHub Actions secret, primary)
  - SUPABASE_URL (GitHub Actions secret, optional fallback supported by vite.config.ts)
  - SUPABASE_ANON_KEY (GitHub Actions secret, optional fallback supported by vite.config.ts)
migrations_added: none
blockers:
  - GitHub repository settings still need the listed Actions secrets.
  - If Dependabot-triggered workflows cannot read normal Actions secrets, duplicate Supabase values as Dependabot secrets.
  - Branch protection for main still needs to require the "Frontend Quality" and "Python Agent Smoke Test" status checks.
notes:
  - Added a frontend GitHub Actions job for pnpm install, required Supabase secret validation, TypeScript type-check, lint, Vitest, and Vite build on pushes and pull requests to main.
  - Added a Python agent smoke job that installs `python/student_workspace_agent/requirements.txt`, compiles the package, and imports the FastAPI health handler.
  - Added CodeQL scanning for JavaScript/TypeScript and weekly Dependabot updates for npm and GitHub Actions.
  - Removed stale npm and Bun lockfiles so pnpm is the only package manager represented in version control.
  - The workflow uses pnpm 9.0.0, Node 20, Python 3.12, frozen lockfile installs, dependency caching, read-only permissions, and concurrency cancellation.
  - Local verification passed on 2026-06-04: pnpm typecheck, pnpm lint, pnpm test -- --reporter=verbose, pnpm build, Python compileall with a temporary pycache prefix, and Python health handler import. Lint currently reports warnings only; Vite build reports the existing large chunk warning.
