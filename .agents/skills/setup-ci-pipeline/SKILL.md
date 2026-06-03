---
name: setup-ci-pipeline
description: >
  Set up a GitHub Actions CI pipeline for the Teamfair project with lint, test, build,
  and type-check steps. Trigger when: adding CI/CD, creating a GitHub Actions workflow,
  or executing roadmap item P0-4.
---

# P0-4: GitHub Actions CI Pipeline

## Context
Teamfair has no automated checks before deploy. Code pushes to `main` auto-deploy to Vercel without linting, testing, or type-checking. Bugs and regressions reach production unchecked.

**Priority**: P0 — Critical  
**Effort**: S (Small — ~1 hour)  
**Budget**: $0 (GitHub Actions free for public repos; 2,000 min/mo for private repos)

## Prerequisites
- Repository hosted on GitHub
- `pnpm` as package manager (see `packageManager` in `package.json`)
- Existing scripts: `pnpm lint`, `pnpm test`, `pnpm build`
- Supabase env vars available as GitHub Secrets (for build step)

## Step-by-Step Instructions

### Step 1: Create the CI workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI

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
  quality:
    name: Lint, Test & Build
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: TypeScript type-check
        run: pnpm exec tsc --noEmit

      - name: Lint
        run: pnpm lint

      - name: Run tests
        run: pnpm test -- --reporter=verbose

      - name: Build
        run: pnpm build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
```

**Key decisions:**
- `timeout-minutes: 10` — fail fast if something hangs
- `pnpm install --frozen-lockfile` — exact lockfile reproduction, no mutations
- `tsc --noEmit` — type-check without emitting, catches type errors lint misses
- Build step needs Supabase env vars because `supabaseClient.ts` reads them at build time
- Single job (not parallel) — keeps within free tier minutes budget

### Step 2: Add GitHub Secrets

In the GitHub repo Settings → Secrets and variables → Actions, add:
- `VITE_SUPABASE_URL` — your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — your Supabase anon key

These are the same values as in your `.env` and Vercel config. They're safe as "secrets" even though they're public keys — this prevents them from being hardcoded in the workflow file.

### Step 3: Add branch protection (optional but recommended)

In GitHub repo Settings → Branches → Add rule for `main`:
- [x] Require status checks to pass before merging
- [x] Require the "quality" check
- [x] Require branches to be up to date before merging

### Step 4: Verify the pipeline

1. Create a test branch: `git checkout -b test/ci-pipeline`
2. Commit the workflow file and push
3. Open a PR → verify the CI job runs and passes
4. Intentionally break a test or introduce a lint error → verify CI fails
5. Merge the PR

## Verification

- [ ] CI workflow runs on push to `main`
- [ ] CI workflow runs on pull requests to `main`
- [ ] TypeScript type-check passes
- [ ] Linting passes
- [ ] Tests pass
- [ ] Build succeeds with Supabase env vars from secrets
- [ ] Concurrent runs are cancelled (test by pushing twice quickly)
- [ ] Pipeline completes in under 5 minutes

## Post-Task Logging

Create `docs/tech_stack/setup-ci-pipeline.md`:

```markdown
# setup-ci-pipeline
date: <today>
status: complete
files_changed:
  - .github/workflows/ci.yml (NEW)
env_vars_added:
  - VITE_SUPABASE_URL (github secrets)
  - VITE_SUPABASE_ANON_KEY (github secrets)
blockers: none
notes: GitHub Actions CI with pnpm cache, TypeScript type-check, lint, test, and build. ~3-5 min per run.
```
