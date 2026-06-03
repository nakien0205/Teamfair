---
name: setup-api-layer
description: >
  Expand Supabase Edge Functions as an API layer and add Upstash Redis rate limiting.
  Trigger when: adding server-side validation, rate limiting, or executing roadmap items P1-2.
---

# P1-2: API Layer (Edge Functions) + Rate Limiting

## Context
Teamfair's SPA talks directly to Supabase from the browser for most operations. While RLS provides security, there's no server-side business logic validation, rate limiting, or abuse protection. This task expands Supabase Edge Functions to handle sensitive operations and adds Upstash Redis for rate limiting.

**Priority**: P1 — High  
**Effort**: L (Large — ~4-5 hours)  
**Budget**: $0 (Upstash free: 10K commands/day; Supabase Edge Functions: 500K invocations/mo free)  
**Depends on**: P0-1 (Sentry) recommended but not blocking

## Prerequisites
- Read `docs/guides/state_and_data.md` — understand current data flow
- Read `supabase/functions/delete-user-auth/index.ts` — understand existing Edge Function patterns
- Create Upstash account at https://console.upstash.com
- Create a Redis database in Upstash (Global region recommended)
- Note `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

## Step-by-Step Instructions

### Step 1: Identify operations to move server-side

Priority operations (currently client-side, should be server-side):

1. **Invite code validation** — currently validated client-side in `teamPersistence.ts`
2. **Contribution score calculation** — currently computed in the browser
3. **Badge awarding logic** — currently client-side
4. **Report submission** — sensitive, should have server-side validation

Start with **invite code validation** as the first Edge Function migration.

### Step 2: Create rate-limiting Edge Function helper

Create `supabase/functions/_shared/ratelimit.ts` (shared across Edge Functions):

```typescript
import { Redis } from "https://esm.sh/@upstash/redis@1.34.3";
import { Ratelimit } from "https://esm.sh/@upstash/ratelimit@2.0.5";

const redis = new Redis({
  url: Deno.env.get("UPSTASH_REDIS_REST_URL")!,
  token: Deno.env.get("UPSTASH_REDIS_REST_TOKEN")!,
});

// Default: 10 requests per 10 seconds per user
export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  analytics: true,
  prefix: "teamfair",
});

// Stricter limit for sensitive operations: 5 per minute
export const strictRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "60 s"),
  analytics: true,
  prefix: "teamfair:strict",
});
```

### Step 3: Create shared CORS + auth helper

Create `supabase/functions/_shared/cors.ts`:

```typescript
const ALLOWED_ORIGINS = [
  "https://teamfair.vercel.app",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

export function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };
}

export function optionsResponse(req: Request) {
  return new Response("ok", { headers: corsHeaders(req) });
}
```

Create `supabase/functions/_shared/auth.ts`:

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function getAuthUser(req: Request) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}
```

### Step 4: Create validate-invite Edge Function

Create `supabase/functions/validate-invite/index.ts`:

```typescript
import { corsHeaders, optionsResponse } from "../_shared/cors.ts";
import { getAuthUser, getSupabaseAdmin } from "../_shared/auth.ts";
import { strictRatelimit } from "../_shared/ratelimit.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  try {
    const user = await getAuthUser(req);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Rate limit
    const { success } = await strictRatelimit.limit(user.id);
    if (!success) {
      return new Response(JSON.stringify({ error: "Rate limited" }), {
        status: 429, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const { invite_code } = await req.json();
    if (!invite_code || typeof invite_code !== "string") {
      return new Response(JSON.stringify({ error: "Invalid invite code" }), {
        status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const admin = getSupabaseAdmin();

    // Validate invite
    const { data: invite, error: inviteError } = await admin
      .from("project_invites")
      .select("*")
      .eq("code", invite_code)
      .single();

    if (inviteError || !invite) {
      return new Response(JSON.stringify({ error: "Invalid invite code" }), {
        status: 404, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Check expiry
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Invite expired" }), {
        status: 410, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Check uses
    if (invite.max_uses && invite.uses_count >= invite.max_uses) {
      return new Response(JSON.stringify({ error: "Invite fully used" }), {
        status: 410, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      valid: true,
      group_id: invite.group_id,
      group_name: invite.group_name,
    }), {
      status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
```

### Step 5: Add Upstash env vars to Supabase

In Supabase Dashboard → Edge Functions → Secrets:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

### Step 6: Deploy the Edge Function

```bash
supabase functions deploy validate-invite --project-ref <your-ref>
```

### Step 7: Update the frontend to call the Edge Function

In `src/lib/teamPersistence.ts`, replace the direct client-side invite validation with a call to the Edge Function:

```typescript
export async function validateInviteCode(code: string): Promise<{ valid: boolean; group_id?: string; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { valid: false, error: "Not authenticated" };

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-invite`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ invite_code: code }),
    }
  );

  return response.json();
}
```

## Verification

- [ ] Edge Function deploys successfully
- [ ] Invite validation works through the Edge Function
- [ ] Rate limiting blocks excessive requests (test with rapid calls)
- [ ] CORS allows requests from `teamfair.vercel.app` and `localhost:8080`
- [ ] Unauthorized requests return 401
- [ ] `pnpm build` succeeds
- [ ] `pnpm test` passes

## Post-Task Logging

Create `docs/tech_stack/setup-api-layer.md`:

```markdown
# setup-api-layer
date: <today>
status: complete
files_changed:
  - supabase/functions/_shared/ratelimit.ts (NEW)
  - supabase/functions/_shared/cors.ts (NEW)
  - supabase/functions/_shared/auth.ts (NEW)
  - supabase/functions/validate-invite/index.ts (NEW)
  - src/lib/teamPersistence.ts
env_vars_added:
  - UPSTASH_REDIS_REST_URL (supabase edge function secrets)
  - UPSTASH_REDIS_REST_TOKEN (supabase edge function secrets)
blockers: none
notes: Shared Edge Function helpers (CORS, auth, rate limit). validate-invite migrated server-side with Upstash rate limiting (5 req/60s).
```
