---
name: setup-staging-pwa
description: >
  Set up a staging environment (Supabase branching + Vercel preview) and basic PWA support.
  Trigger when: adding staging, preview deploys, offline support, or executing roadmap item P2-2.
---

# P2-2: Staging Environment + PWA

## Context
Teamfair deploys directly to production without a staging environment. There's no safe place to test database migrations or new features before they hit real users. Additionally, students in Vietnam may have unreliable internet — a basic PWA with offline task viewing improves usability.

**Priority**: P2 — Medium  
**Effort**: M (Medium — ~3-4 hours)  
**Budget**: $0 (Vercel preview deploys are free; Supabase branching free on Pro plan; PWA is just code)  
**Depends on**: P0-4 (CI Pipeline — preview deploys build on CI)

## Prerequisites
- P0-4 complete (GitHub Actions CI in place)
- Supabase project on Pro plan (for database branching) OR willingness to use a separate free-tier project as staging
- Read `docs/guides/how_to_run.md` — understand current deploy checklist

## Step-by-Step Instructions

### Part A: Staging Environment

#### Step 1: Vercel Preview Deploys (already available)

Vercel automatically creates preview deploys for every PR. Verify this is working:
1. Create a test PR
2. Vercel should comment with a preview URL
3. If not, check Vercel project settings → Git → ensure "Preview Deployments" is enabled

#### Step 2: Staging Supabase project

**Option A — Supabase Branching (Pro plan):**

If on Supabase Pro plan, enable database branching:
1. Supabase Dashboard → Settings → Branching → Enable
2. Each PR will automatically get a branch database
3. Migrations in `supabase/migrations/` auto-apply to the branch

**Option B — Separate staging project (Free plan):**

Create a second Supabase project (e.g., `teamfair-staging`):
1. Create at https://supabase.com → New Project
2. Apply all migrations in order
3. Note the staging `SUPABASE_URL` and `SUPABASE_ANON_KEY`

#### Step 3: Vercel staging env vars

In Vercel → Project Settings → Environment Variables:
- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for "Preview" environment
- Set these to the staging/branch Supabase credentials
- Production values stay for "Production" environment

This ensures preview deploys use the staging database automatically.

#### Step 4: Update CI to validate migrations

Add a step to the CI workflow (`.github/workflows/ci.yml`) that validates SQL syntax:

```yaml
- name: Validate SQL migrations
  run: |
    for f in supabase/migrations/*.sql; do
      echo "Checking $f..."
      # Basic syntax check — ensure file is valid UTF-8 and not empty
      if [ ! -s "$f" ]; then
        echo "ERROR: Empty migration file $f"
        exit 1
      fi
    done
    echo "All migrations look good"
```

For deeper validation, install `supabase` CLI and run:
```yaml
- name: Supabase migration check
  run: |
    npx supabase db lint --project-ref ${{ secrets.SUPABASE_STAGING_REF }}
```

### Part B: Basic PWA Support

#### Step 5: Create service worker

Create `public/sw.js`:

```javascript
const CACHE_NAME = "teamfair-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
];

// Install: cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for static assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and Supabase API calls
  if (request.method !== "GET") return;
  if (url.hostname.includes("supabase.co")) return;
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses for static assets
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))  // Offline fallback
  );
});
```

#### Step 6: Create web app manifest

Create `public/manifest.json`:

```json
{
  "name": "Teamfair",
  "short_name": "Teamfair",
  "description": "Fair team contribution tracking for students",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#3b82f6",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**Note**: You need to create the icon files. Use any PNG icon generator or the app's logo.

#### Step 7: Register service worker in `index.html`

Add before the closing `</body>` tag in `index.html`:

```html
<script>
  if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
    navigator.serviceWorker.register('/sw.js');
  }
</script>
```

#### Step 8: Add manifest link to `index.html`

In the `<head>`:

```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#3b82f6">
```

## Verification

- [ ] Vercel preview deploys work for PRs
- [ ] Preview deploys use staging Supabase credentials (not production)
- [ ] CI validates SQL migration files
- [ ] Service worker registers in production (not localhost)
- [ ] App loads offline after first visit (static shell)
- [ ] Supabase API calls are NOT cached by service worker
- [ ] PWA can be "installed" on mobile (Add to Home Screen)
- [ ] `pnpm build` succeeds
- [ ] `pnpm test` passes

## Post-Task Logging

Create `docs/tech_stack/setup-staging-pwa.md`:

```markdown
# setup-staging-pwa
date: <today>
status: complete
files_changed:
  - .github/workflows/ci.yml (migration validation step added)
  - public/sw.js (NEW)
  - public/manifest.json (NEW)
  - index.html (manifest link + SW registration)
env_vars_added:
  - VITE_SUPABASE_URL (vercel preview env)
  - VITE_SUPABASE_ANON_KEY (vercel preview env)
blockers: none
notes: Staging via Vercel preview + separate Supabase project. Basic PWA with network-first strategy, offline static shell. Supabase API calls bypass service worker cache.
```
