---
name: setup-sentry
description: >
  Set up Sentry error tracking and performance monitoring for the Teamfair React SPA.
  Trigger when: implementing error tracking, adding Sentry, or executing roadmap item P0-1.
---

# P0-1: Sentry Error Tracking Setup

## Context
Teamfair has **zero error tracking** in production. When errors occur on `teamfair.vercel.app`, there is no way to know unless a user reports it. This is the highest-priority observability gap.

**Priority**: P0 — Critical  
**Effort**: S (Small — ~1 hour)  
**Budget**: $0 (Sentry Free: 5K errors/mo, 1 performance unit)

## Prerequisites
- Sentry account created at https://sentry.io
- Sentry project created (platform: React)
- DSN copied from project Settings → Client Keys

## Step-by-Step Instructions

### Step 1: Install Sentry packages

```bash
cd d:\Python\Projects\Teamfair
pnpm add @sentry/react @sentry/vite-plugin
```

### Step 2: Initialize Sentry in `src/main.tsx`

Add Sentry initialization **before** `createRoot()`. Read the current file first to find the exact insertion point.

```typescript
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

**Key decisions:**
- `enabled: import.meta.env.PROD` — prevents noise in dev mode
- `tracesSampleRate: 0.1` in production — keeps within free tier limits
- `replaysOnErrorSampleRate: 1.0` — always capture replay when error occurs

### Step 3: Add Error Boundary to `src/App.tsx`

Wrap the top-level component in `Sentry.ErrorBoundary`:

```tsx
import * as Sentry from "@sentry/react";

// Wrap the return of the App component:
<Sentry.ErrorBoundary fallback={<p>An error occurred. Please refresh.</p>}>
  {/* existing QueryClientProvider + routing tree */}
</Sentry.ErrorBoundary>
```

### Step 4: Add Sentry Vite plugin for source maps

Modify `vite.config.ts` to upload source maps on build:

```typescript
import { sentryVitePlugin } from "@sentry/vite-plugin";

// Add to plugins array (after react()):
sentryVitePlugin({
  org: "<your-sentry-org>",
  project: "<your-sentry-project>",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: {
    filesToDeleteAfterUpload: ["./dist/**/*.map"],
  },
}),
```

Also add to the Vite config:
```typescript
build: {
  sourcemap: true,
},
```

### Step 5: Update environment variables

Add to `.env.example`:
```
VITE_SENTRY_DSN=                    # Sentry project DSN (safe for client)
SENTRY_AUTH_TOKEN=                  # Sentry auth token (build-time only, NOT VITE_ prefixed)
```

Add to Vercel project environment variables:
- `VITE_SENTRY_DSN` — the DSN string
- `SENTRY_AUTH_TOKEN` — from Sentry Settings → Auth Tokens (build-time only)

### Step 6: Test the integration

1. Run `pnpm dev`
2. Open browser console and run: `throw new Error("Sentry test error")`
3. Check Sentry dashboard — error should appear within 30 seconds
4. Run `pnpm build` — source maps should upload (check Sentry → Settings → Source Maps)

## Verification

- [ ] `pnpm build` succeeds with no errors
- [ ] `pnpm test` passes (no regressions)
- [ ] Test error appears in Sentry dashboard
- [ ] Source maps are uploaded (stack traces show original TypeScript)
- [ ] No Sentry noise in development mode

## Post-Task Logging

Create `docs/tech_stack/setup-sentry.md`:

```markdown
# setup-sentry
date: <today>
status: complete
files_changed:
  - src/main.tsx
  - src/App.tsx
  - vite.config.ts
  - .env.example
  - package.json
env_vars_added:
  - VITE_SENTRY_DSN (vercel, .env)
  - SENTRY_AUTH_TOKEN (vercel — build-time only)
packages_added:
  - @sentry/react
  - @sentry/vite-plugin
blockers: none
notes: Sentry Free tier integrated with error boundary, performance tracing, session replay on errors, and source map uploads.
```
