# Tool Selection Matrix (Serverless Stack)

Pick tools based on: budget ($20–50/mo total), team size (1–3 devs), serverless-first architecture.

## Backend-as-a-Service (BaaS)

| Tool | Best For | Monthly Cost | Avoid When |
|---|---|---|---|
| **Supabase** | Full BaaS: Auth, Postgres, Storage, Realtime, Edge Functions | Free–$25 | Need NoSQL or non-Postgres DB |
| **Firebase** | Google ecosystem, real-time heavy, mobile-first | Free–$25 | Need relational DB, SQL |
| **Neon** | Serverless Postgres only (no auth/storage bundle) | Free–$19 | Need auth+storage+realtime bundle |
| **PlanetScale** | MySQL at scale, branching | Free–$29 | Using PostgreSQL |

## Hosting & CDN

| Tool | Best For | Monthly Cost |
|---|---|---|
| **Vercel** | React/Next.js SPA, preview deploys, edge middleware | Free–$20 |
| **Netlify** | Static sites, form handling, identity | Free–$19 |
| **Cloudflare Pages** | Global edge, Workers integration, cheapest at scale | Free |

## Python/Backend Service Hosting

| Tool | Best For | Monthly Cost | Avoid When |
|---|---|---|---|
| **Railway** | One-click Python deploy, auto-sleep, simple | $5–$20 | Need multi-region |
| **Fly.io** | Multi-region containers, always-on | Free–$10 | Want simplest possible setup |
| **Render** | Simple deploys, managed Postgres option | Free–$7 | Need fast cold starts on free tier |
| **Google Cloud Run** | Pay-per-use, scales to zero, GCP ecosystem | Pay-per-use | Budget-constrained, want predictability |

## CI/CD

| Tool | Best For | Avoid When |
|---|---|---|
| **GitHub Actions** | GitHub repos, simple-medium complexity, free for public repos | High build volume (cost), complex DAGs |
| **Vercel Auto-Deploy** | Zero-config deploy on push to main | Need pre-deploy checks (tests, linting) |

## Error Tracking & Monitoring

| Tool | Best For | Monthly Cost |
|---|---|---|
| **Sentry** | Error tracking, performance, session replay | Free (5K errors) / $26 (Team) |
| **LogRocket** | Session replay focused | Free (1K sessions) |
| **Highlight.io** | Open-source Sentry alternative | Free (self-host) / $0–$50 |

## Product Analytics

| Tool | Best For | Monthly Cost |
|---|---|---|
| **PostHog** | Full analytics + session replay + feature flags | Free (1M events) |
| **Plausible** | Privacy-first, lightweight, GDPR-compliant | $9/mo or self-host free |
| **Mixpanel** | Event analytics, funnels, retention | Free (20M events) |

## Caching & Rate Limiting

| Tool | Best For | Monthly Cost |
|---|---|---|
| **Upstash Redis** | Serverless Redis, rate limiting, Edge-compatible | Free (10K commands/day) / $10 |
| **Vercel KV** | Vercel-native Redis (Upstash under the hood) | Free (30K requests) |

## Background Jobs & Queues

| Tool | Best For | Monthly Cost |
|---|---|---|
| **Inngest** | Event-driven, Vercel/Supabase integration | Free (25K runs) |
| **Trigger.dev** | Open-source, TypeScript-native jobs | Free (25K runs) |
| **Supabase pg_cron** | Simple scheduled SQL jobs, no extra service | Free (included) |

## File Storage

| Tool | Best For | Monthly Cost |
|---|---|---|
| **Supabase Storage** | Integrated with Supabase Auth/RLS, S3-compatible | Free (1GB) / included in plan |
| **Cloudflare R2** | No egress fees, S3-compatible | Free (10GB) |
| **AWS S3** | Maximum flexibility, ecosystem | Pay-per-use |

## Security & Secrets

| Tool | Best For |
|---|---|
| **Supabase Vault** | Database-level secret storage (beta) |
| **Vercel Environment Variables** | Build-time and runtime secrets for frontend |
| **Railway/Fly.io env vars** | Runtime secrets for Python services |
| **GitHub Actions Secrets** | CI/CD pipeline secrets |
| **Doppler** | Centralized secret management across services ($0 free tier) |

## Recommended Budget Allocation ($20–50/mo)

| Service | Tier | Cost |
|---|---|---|
| Supabase | Free or Pro ($25) | $0–25 |
| Vercel | Hobby (free) or Pro ($20) | $0–20 |
| Sentry | Free (5K errors/mo) | $0 |
| Railway | Starter ($5) for AI agent | $5 |
| PostHog | Free (1M events) | $0 |
| Upstash Redis | Free (10K cmd/day) | $0 |
| Inngest | Free (25K runs/mo) | $0 |
| **Total** | | **$5–50** |
