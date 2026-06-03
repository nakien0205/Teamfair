---
name: setup-analytics
description: >
  Integrate PostHog product analytics into the Teamfair React SPA.
  Trigger when: adding analytics, user tracking, or executing roadmap item P1-3.
---

# P1-3: Product Analytics (PostHog)

## Context
Teamfair has no visibility into how users interact with the app — which features are used, where users drop off, what flows are confusing. PostHog provides product analytics, session replay, and feature flags on a generous free tier (1M events/mo).

**Priority**: P1 — High  
**Effort**: S (Small — ~1-2 hours)  
**Budget**: $0 (PostHog free: 1M events/mo, 5K session recordings/mo)  
**Depends on**: Nothing

## Prerequisites
- PostHog account created at https://us.posthog.com (or EU instance)
- PostHog project created
- Project API key copied from Settings → Project → API Key

## Step-by-Step Instructions

### Step 1: Install PostHog

```bash
cd d:\Python\Projects\Teamfair
pnpm add posthog-js
```

### Step 2: Create PostHog wrapper

Create `src/lib/analytics.ts`:

```typescript
import posthog from "posthog-js";

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";

let initialized = false;

export function initAnalytics() {
  if (!POSTHOG_KEY || !import.meta.env.PROD) return;
  if (initialized) return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: true,
    capture_pageleave: true,
    persistence: "localStorage",
    autocapture: true,  // Auto-captures clicks, form submits, page views
    disable_session_recording: false,
  });

  initialized = true;
}

export function identifyUser(userId: string, traits?: Record<string, any>) {
  if (!initialized) return;
  posthog.identify(userId, traits);
}

export function trackEvent(event: string, properties?: Record<string, any>) {
  if (!initialized) return;
  posthog.capture(event, properties);
}

export function resetAnalytics() {
  if (!initialized) return;
  posthog.reset();
}
```

### Step 3: Initialize in `src/main.tsx`

Add after Sentry init (or at the top if Sentry isn't set up yet):

```typescript
import { initAnalytics } from "@/lib/analytics";
initAnalytics();
```

### Step 4: Identify users on login

In `src/context/AuthContext.tsx`, after successful authentication:

```typescript
import { identifyUser } from "@/lib/analytics";

// After profile is loaded:
if (user && profile) {
  identifyUser(user.id, {
    email: profile.email,
    role: profile.role,
    name: profile.full_name,
  });
}
```

### Step 5: Reset on logout

In the `signOut` function in `AuthContext.tsx`:

```typescript
import { resetAnalytics } from "@/lib/analytics";

// In signOut:
resetAnalytics();
```

### Step 6: Add key event tracking

Track high-value events across the app. Add `trackEvent` calls to these locations:

| Event | Where | Properties |
|-------|-------|------------|
| `task_created` | TeamContext `createTask` | `{ group_id, status }` |
| `task_status_changed` | TeamContext `updateTaskStatus` | `{ group_id, from_status, to_status }` |
| `report_submitted` | TeamContext `submitReport` | `{ group_id }` |
| `material_uploaded` | MaterialsSection upload handler | `{ group_id, file_type }` |
| `group_created` | TeamContext `createGroup` | `{ role }` |
| `group_joined` | TeamContext `joinProject` | `{ method: "invite" \| "request" }` |
| `ai_chat_sent` | AIChatWidget send handler | `{ group_id }` |
| `badge_awarded` | Badge award handler | `{ badge_type }` |

Example:

```typescript
import { trackEvent } from "@/lib/analytics";

// In createTask:
trackEvent("task_created", { group_id: currentGroup.id, status: "todo" });
```

### Step 7: Update environment variables

Add to `.env.example`:
```
VITE_POSTHOG_KEY=                   # PostHog project API key
VITE_POSTHOG_HOST=                  # PostHog instance URL (default: https://us.i.posthog.com)
```

Add `VITE_POSTHOG_KEY` to Vercel environment variables.

## Verification

- [ ] PostHog initializes only in production mode
- [ ] User is identified after login (check PostHog → Persons)
- [ ] Page views are captured automatically
- [ ] Custom events appear in PostHog → Events
- [ ] Session recordings work (if enabled)
- [ ] Analytics reset on logout
- [ ] No analytics noise in development
- [ ] `pnpm build` succeeds
- [ ] `pnpm test` passes

## Post-Task Logging

Create `docs/tech_stack/setup-analytics.md`:

```markdown
# setup-analytics
date: <today>
status: complete
files_changed:
  - src/lib/analytics.ts (NEW)
  - src/main.tsx
  - src/context/AuthContext.tsx
  - src/context/TeamContext.tsx
  - .env.example
packages_added:
  - posthog-js
env_vars_added:
  - VITE_POSTHOG_KEY (vercel, .env)
  - VITE_POSTHOG_HOST (vercel, .env — optional)
blockers: none
notes: PostHog Free integrated with user identification, auto page views, session replay, and 8 custom event types.
```
