---
name: setup-background-jobs
description: >
  Set up background jobs (Inngest) and Redis caching (Upstash) for Teamfair.
  Trigger when: adding background processing, scheduled tasks, caching, or executing roadmap item P2-1.
---

# P2-1: Background Jobs + Caching

## Context
Teamfair handles everything synchronously — notification emails, contribution recalculation, badge evaluation, and report generation all happen inline. As user count grows, this becomes a performance bottleneck and reliability risk. This task adds Inngest for background job processing and expands Upstash Redis for query caching.

**Priority**: P2 — Medium  
**Effort**: L (Large — ~5-6 hours)  
**Budget**: $0 (Inngest free: 25K runs/mo; Upstash free: 10K commands/day)  
**Depends on**: P1-2 (API Layer — Upstash already configured)

## Prerequisites
- P1-2 complete (Upstash Redis already provisioned and configured)
- Inngest account at https://inngest.com
- Read `docs/guides/state_and_data.md` — understand data mutations
- Read `docs/tech_stack/setup-api-layer.md` — confirm Upstash is available

## Step-by-Step Instructions

### Part A: Background Jobs with Inngest

#### Step 1: Create Inngest Edge Function

Inngest works by deploying a single Edge Function that registers all job handlers. The Inngest service calls this function when events are triggered.

Create `supabase/functions/inngest/index.ts`:

```typescript
import { Inngest } from "https://esm.sh/inngest@3";
import { serve } from "https://esm.sh/inngest@3/deno";

const inngest = new Inngest({ id: "teamfair" });

// Job: Send notification (e.g., email digest, in-app notification)
const sendNotification = inngest.createFunction(
  { id: "send-notification" },
  { event: "teamfair/notification.send" },
  async ({ event, step }) => {
    const { userId, title, body, type } = event.data;

    await step.run("insert-notification", async () => {
      // Insert into notifications table using service role
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await supabase.from("notifications").insert({
        user_id: userId, title, body, type, read: false,
      });
    });

    // Future: add email sending step here
    // await step.run("send-email", async () => { ... });
  }
);

// Job: Recalculate contribution scores for a group
const recalcContributions = inngest.createFunction(
  { id: "recalc-contributions" },
  { event: "teamfair/contributions.recalc" },
  async ({ event, step }) => {
    const { groupId } = event.data;
    await step.run("recalculate", async () => {
      // Fetch approved tasks, compute percentages, update member stats
      // Reuse logic from teamPersistence.ts recalcContributions
    });
  }
);

// Job: Evaluate badge eligibility
const evaluateBadges = inngest.createFunction(
  { id: "evaluate-badges" },
  { event: "teamfair/badges.evaluate" },
  async ({ event, step }) => {
    const { groupId } = event.data;
    await step.run("check-badge-criteria", async () => {
      // Check each member against badge criteria
      // Award badges if criteria met
    });
  }
);

// Serve all functions
const handler = serve({
  client: inngest,
  functions: [sendNotification, recalcContributions, evaluateBadges],
});

Deno.serve(handler);
```

#### Step 2: Deploy and register

```bash
supabase functions deploy inngest --project-ref <your-ref>
```

Then register the function URL with Inngest:
1. Go to Inngest Dashboard → Apps → Add App
2. URL: `https://<project-ref>.supabase.co/functions/v1/inngest`

#### Step 3: Trigger events from your app

In `teamPersistence.ts` or Edge Functions, send events to Inngest:

```typescript
// Using Inngest REST API from Edge Functions
await fetch("https://inn.gs/e/<INNGEST_EVENT_KEY>", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "teamfair/contributions.recalc",
    data: { groupId: group.id },
  }),
});
```

Add `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` to Supabase Edge Function secrets.

### Part B: Redis Caching with Upstash

#### Step 4: Create caching Edge Function helper

Add to `supabase/functions/_shared/cache.ts`:

```typescript
import { Redis } from "https://esm.sh/@upstash/redis@1.34.3";

const redis = new Redis({
  url: Deno.env.get("UPSTASH_REDIS_REST_URL")!,
  token: Deno.env.get("UPSTASH_REDIS_REST_TOKEN")!,
});

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const hit = await redis.get<T>(key);
  if (hit !== null) return hit;

  const fresh = await fetcher();
  await redis.set(key, JSON.stringify(fresh), { ex: ttlSeconds });
  return fresh;
}

export async function invalidate(pattern: string) {
  // For simple cases, delete known keys
  await redis.del(pattern);
}

export { redis };
```

#### Step 5: Cache hot queries

Create an Edge Function for cached group data:

```typescript
// Example: Cache group member stats (TTL 60s)
const stats = await cached(
  `group:${groupId}:member-stats`,
  60,
  async () => {
    const { data } = await supabase
      .from("group_members")
      .select("*, tasks(status, approved)")
      .eq("group_id", groupId);
    return computeStats(data);
  }
);
```

#### Step 6: Invalidate cache on mutations

When tasks are updated or members change, invalidate the relevant cache key:

```typescript
await invalidate(`group:${groupId}:member-stats`);
```

## Verification

- [ ] Inngest function registers and appears in Inngest dashboard
- [ ] Sending a test event triggers the notification job
- [ ] Contribution recalculation runs asynchronously
- [ ] Cache hits return data without DB query (verify with Redis CLI or Upstash console)
- [ ] Cache invalidation works on mutations
- [ ] `pnpm build` succeeds
- [ ] `pnpm test` passes

## Post-Task Logging

Create `docs/tech_stack/setup-background-jobs.md`:

```markdown
# setup-background-jobs
date: <today>
status: complete
files_changed:
  - supabase/functions/inngest/index.ts (NEW)
  - supabase/functions/_shared/cache.ts (NEW)
env_vars_added:
  - INNGEST_EVENT_KEY (supabase edge function secrets)
  - INNGEST_SIGNING_KEY (supabase edge function secrets)
blockers: none
notes: Inngest for async jobs (notifications, contribution recalc, badge eval). Upstash Redis caching with 60s TTL for group stats. Reuses existing Upstash credentials from P1-2.
```
