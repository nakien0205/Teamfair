# Deployment Workflow

This project uses Vercel's GitHub integration for frontend deployments and GitHub Actions for merge quality gates.

## Current Model

- Pull request branches create Vercel Preview Deployments.
- Merges to `main` create Vercel Production Deployments.
- GitHub branch protection should prevent merging to `main` unless required checks pass.
- Vercel remains the deployment authority; do not add a separate GitHub Actions Vercel deploy workflow unless the team needs custom deploy artifacts, release approvals outside Vercel, or deployment comments from CI.

## Frontend Release Flow

1. Create a branch and open a pull request into `main`.
2. Wait for GitHub Actions to pass:
   - `CI / Frontend Quality`
   - `CI / Python Agent Smoke Test`
   - `CodeQL / Analyze JavaScript and TypeScript` if CodeQL is required for the repository.
3. Validate the Vercel Preview Deployment for the pull request.
4. Merge to `main` after review.
5. Confirm the Vercel Production Deployment completes.

## Required Repository Settings

### GitHub Actions Secrets

Add these under GitHub repository Settings -> Secrets and variables -> Actions:

| Secret | Required | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL used by Vite during CI builds. |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon public key used by Vite during CI builds. |
| `SUPABASE_URL` | Optional | Fallback name supported by [vite.config.ts](../../vite.config.ts). |
| `SUPABASE_ANON_KEY` | Optional | Fallback name supported by [vite.config.ts](../../vite.config.ts). |

Dependabot pull request workflows may not be allowed to read normal Actions secrets, depending on repository settings. If Dependabot CI fails during the build environment validation step, duplicate the Supabase values under GitHub repository Settings -> Secrets and variables -> Dependabot.

### Branch Protection

Add or update the `main` branch protection rule:

- Require a pull request before merging.
- Require status checks to pass before merging.
- Require branches to be up to date before merging when the repository has frequent parallel PRs.
- Require `CI / Frontend Quality`.
- Require `CI / Python Agent Smoke Test`.
- Keep CodeQL advisory at first, then require `CodeQL / Analyze JavaScript and TypeScript` once the team is comfortable treating security scan failures as merge blockers.
- Review Dependabot PRs manually; do not enable auto-merge until dependency update failures are low-noise and rollback ownership is clear.

GitHub may display required checks with or without the workflow prefix. Use the exact names GitHub offers after each check has run at least once.

## Vercel Project Settings

The Vercel project should stay linked to the GitHub repository:

- Production branch: `main`.
- Install command: Vercel default for pnpm, or `pnpm install --frozen-lockfile` if explicitly configured.
- Build command: `pnpm build`.
- Output directory: `dist`.

Add these Vercel environment variables for Production and Preview:

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | Browser Supabase project URL. |
| `VITE_SUPABASE_ANON_KEY` | Yes | Browser Supabase anon public key. |
| `VITE_STUDENT_AGENT_URL` | Production required when the hosted AI sidebar is enabled | HTTPS base URL for the Python student agent, without a trailing slash. |
| `VITE_POSTHOG_KEY` | Optional | Product analytics key when analytics is enabled. |
| `VITE_POSTHOG_HOST` | Optional | Product analytics host; defaults to `https://us.i.posthog.com` when unset. |
| `VITE_SENTRY_DSN` | Optional | Client-side Sentry reporting. |
| `SENTRY_AUTH_TOKEN` | Optional | Upload source maps during Vercel builds. |
| `SENTRY_ORG` | Optional | Sentry organization slug; defaults are documented in [setup_sentry.md](setup_sentry.md). |
| `SENTRY_PROJECT` | Optional | Sentry project slug; defaults are documented in [setup_sentry.md](setup_sentry.md). |

The Vite config also maps Vercel integration variables named `SUPABASE_URL` and `SUPABASE_ANON_KEY` into their `VITE_` equivalents at build time. Prefer the explicit `VITE_` names in Vercel so the browser contract is obvious.

## Python Agent Deployment

Keep the Python student agent deployment separate from the frontend Vercel deployment. The current recommended target is Railway from the `python/` directory, using [how_to_run.md](how_to_run.md) and [student_workspace_agent.md](student_workspace_agent.md) as the source of truth.

After the Railway service is healthy, set `VITE_STUDENT_AGENT_URL` in Vercel and redeploy the frontend.

## Rollback

Prefer Vercel dashboard rollback for production incidents:

1. Open the Vercel project.
2. Go to Deployments.
3. Select the last known-good production deployment.
4. Use Promote or Rollback to move the production alias back.
5. Open a follow-up issue or hotfix PR with the failing deployment URL, commit SHA, observed behavior, and any Sentry errors.

For frontend-only regressions, rollback Vercel first and investigate after service is restored. For data or migration regressions, pause and assess the Supabase state before rolling back the frontend because old code may not match newly changed data shape.

## Explicit GitHub Actions Deployment Option

Only move deployment into GitHub Actions if the team needs a custom deployment gate that Vercel's Git integration cannot provide. That workflow would need these additional GitHub Actions secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

If this option is adopted, disable or narrow Vercel's automatic Git deployments to avoid duplicate preview and production deployments for the same commit.
