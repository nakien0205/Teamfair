# Teamfair — Tech Stack Analysis

## 1. Current Architecture (What You Have Today)

```mermaid
graph TB
    subgraph "Client — Browser"
        USER["👤 User (Browser)"]
        SPA["React 18 SPA<br/>Vite 7 + SWC + TypeScript"]
        UI["shadcn/ui + Radix UI<br/>Tailwind CSS 3"]
    end

    subgraph "Hosting — Vercel"
        VERCEL["Vercel Edge Network<br/>(Static SPA Deploy)"]
    end

    subgraph "Backend — Supabase (Managed)"
        SUPA_AUTH["Supabase Auth<br/>(Email + Google OAuth)"]
        SUPA_DB["PostgreSQL 15<br/>(Supabase Managed)"]
        SUPA_RLS["Row-Level Security<br/>(16 migration files)"]
        SUPA_RPC["RPC Functions<br/>(set_signup_role, delete_user_account,<br/>increment_invite_use)"]
        SUPA_EDGE["Edge Functions (Deno)<br/>(delete-user-auth)"]
        SUPA_RT["Realtime<br/>(Not actively used)"]
    end

    subgraph "AI Agent — Python Sidecar"
        AGENT["FastAPI Server :8010<br/>Python + Pydantic"]
        OR["OpenRouter API<br/>(DeepSeek v4 Flash/Pro)"]
    end

    USER --> SPA
    SPA --> UI
    SPA -->|"Static Assets"| VERCEL
    VERCEL -->|"CDN Serve"| USER

    SPA -->|"@supabase/supabase-js<br/>Direct Client Connection"| SUPA_AUTH
    SPA -->|"CRUD + RPC"| SUPA_DB
    SUPA_DB --- SUPA_RLS
    SUPA_DB --- SUPA_RPC
    SUPA_AUTH -->|"JWT"| SUPA_DB
    SUPA_RPC -->|"SECURITY DEFINER"| SUPA_EDGE

    SPA -->|"POST /chat<br/>(Vite proxy → :8010)"| AGENT
    AGENT -->|"OpenAI SDK"| OR

    style USER fill:#4f46e5,color:#fff
    style SPA fill:#1e293b,color:#fff
    style UI fill:#334155,color:#fff
    style VERCEL fill:#000,color:#fff
    style SUPA_AUTH fill:#3ecf8e,color:#000
    style SUPA_DB fill:#3ecf8e,color:#000
    style SUPA_RLS fill:#2d9d6f,color:#fff
    style SUPA_RPC fill:#2d9d6f,color:#fff
    style SUPA_EDGE fill:#2d9d6f,color:#fff
    style SUPA_RT fill:#888,color:#fff,stroke-dasharray: 5 5
    style AGENT fill:#f59e0b,color:#000
    style OR fill:#f97316,color:#000
```

### Current Stack — Component Breakdown

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Framework** | React | 18.3 | UI rendering |
| **Bundler** | Vite + SWC | 7.3 | Build tooling, HMR, dev proxy |
| **Language** | TypeScript | 5.8 | Type safety |
| **UI Library** | shadcn/ui + Radix UI | latest | Component primitives |
| **Styling** | Tailwind CSS | 3.4 | Utility-first CSS |
| **Routing** | React Router DOM | 6.30 | Client-side routing |
| **State** | React Context (TeamContext, AuthContext) | — | App state management |
| **Data Fetching** | TanStack React Query | 5.83 | Server state caching |
| **Charts** | Recharts | 2.15 | Contribution analytics |
| **Forms** | React Hook Form + Zod | 7.61 / 3.25 | Validation |
| **Auth** | Supabase Auth | 2.105 | Email + Google OAuth |
| **Database** | PostgreSQL (Supabase) | 15 | Primary data store |
| **Security** | Row-Level Security | — | 16 SQL migrations |
| **Edge Functions** | Deno (Supabase) | — | Account deletion |
| **AI Agent** | Python FastAPI | — | Student workspace AI chat |
| **AI Model** | DeepSeek v4 (via OpenRouter) | — | Tool-loop reasoning |
| **Hosting** | Vercel | — | Static SPA + edge CDN |
| **Testing** | Vitest + Testing Library | 3.2 | Unit tests |
| **Linting** | ESLint | 9.32 | Code quality |

---

## 2. Key Gaps in the Current Architecture

> [!WARNING]
> These are **real issues**, not theoretical. They will affect you as you scale.

| Gap | Risk | Severity |
|-----|------|----------|
| **No API layer** — SPA talks directly to Supabase | Business logic leaks into client; no place for server-side validation, rate limiting, or webhooks | 🔴 Critical |
| **No file storage abstraction** — materials metadata only | Users can't actually upload/download files in production | 🔴 Critical |
| **AI agent has no production hosting** — runs locally or needs manual deploy | AI chat won't work on Vercel unless you host the Python server separately | 🔴 Critical |
| **No background jobs** — everything is synchronous | Can't send notification emails, run batch analytics, or schedule reports | 🟡 High |
| **No monitoring/observability** — no error tracking, no logs, no metrics | You won't know when things break in production | 🟡 High |
| **No CI/CD pipeline** — manual deploy | No automated tests before deploy, no staging environment | 🟡 High |
| **No caching layer** — every read hits Postgres | Performance will degrade as user count grows | 🟠 Medium |
| **Supabase Realtime unused** — notifications poll or require refresh | Missed opportunity for live updates (task changes, chat) | 🟠 Medium |
| **No rate limiting** — client can hammer Supabase directly | Abuse vector; billing risk on Supabase | 🟠 Medium |

---

## 3. Recommended Production Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        USER["👤 Users"]
        SPA["React 18 SPA<br/>Vite + TypeScript"]
        PWA["PWA Service Worker<br/>(Offline Support)"]
    end

    subgraph "Edge / CDN"
        CDN["Vercel Edge Network<br/>+ Edge Middleware"]
        WAF["Rate Limiting<br/>+ Bot Protection"]
    end

    subgraph "API Gateway"
        GW["Supabase Edge Functions<br/>(Expanded) OR<br/>Vercel Serverless Functions"]
    end

    subgraph "Backend Services"
        API["Next.js API Routes or<br/>Dedicated Express/Hono Server<br/>(Business Logic Layer)"]
        AGENT_SVC["AI Agent Service<br/>(Python FastAPI on Railway/Fly.io)"]
    end

    subgraph "Data Layer — Supabase"
        AUTH["Supabase Auth<br/>(Email + Google + GitHub)"]
        DB["PostgreSQL 15<br/>(Primary DB)"]
        RLS["Row-Level Security"]
        RPC["Server-side RPCs"]
        STORAGE["Supabase Storage<br/>(Files: Materials, Evidence, Exports)"]
        RT["Supabase Realtime<br/>(Live Subscriptions)"]
    end

    subgraph "Caching & Jobs"
        REDIS["Upstash Redis<br/>(Session cache, rate limits)"]
        QUEUE["Inngest / Trigger.dev<br/>(Background Jobs)"]
    end

    subgraph "AI / LLM"
        OR["OpenRouter API<br/>(DeepSeek v4)"]
        EMBED["Embedding Model<br/>(Future: RAG on materials)"]
    end

    subgraph "Observability"
        SENTRY["Sentry<br/>(Error Tracking)"]
        LOGS["Vercel / Supabase Logs"]
        ANALYTICS["PostHog / Plausible<br/>(Product Analytics)"]
    end

    subgraph "CI/CD"
        GH["GitHub Actions"]
        PREVIEW["Vercel Preview Deploys"]
        STAGING["Staging Environment<br/>(Supabase Branch DB)"]
    end

    USER --> SPA
    SPA --> PWA
    SPA --> CDN
    CDN --> WAF
    WAF --> GW

    GW --> API
    GW --> AUTH
    API --> DB
    API --> STORAGE
    API --> REDIS
    API --> QUEUE
    DB --- RLS
    DB --- RPC
    DB --> RT
    RT -->|"WebSocket"| SPA

    SPA -->|"Direct Auth Only"| AUTH
    API --> AGENT_SVC
    AGENT_SVC --> OR
    AGENT_SVC --> EMBED

    QUEUE -->|"Email notifications<br/>Report generation<br/>Badge computation"| DB

    SPA --> SENTRY
    API --> SENTRY
    API --> LOGS
    SPA --> ANALYTICS

    GH -->|"Test + Lint + Build"| PREVIEW
    GH -->|"Migration check"| STAGING

    style USER fill:#4f46e5,color:#fff
    style SPA fill:#1e293b,color:#fff
    style PWA fill:#334155,color:#fff
    style CDN fill:#000,color:#fff
    style WAF fill:#1a1a2e,color:#fff
    style GW fill:#7c3aed,color:#fff
    style API fill:#2563eb,color:#fff
    style AGENT_SVC fill:#f59e0b,color:#000
    style AUTH fill:#3ecf8e,color:#000
    style DB fill:#3ecf8e,color:#000
    style RLS fill:#2d9d6f,color:#fff
    style RPC fill:#2d9d6f,color:#fff
    style STORAGE fill:#3ecf8e,color:#000
    style RT fill:#3ecf8e,color:#000
    style REDIS fill:#dc2626,color:#fff
    style QUEUE fill:#8b5cf6,color:#fff
    style OR fill:#f97316,color:#000
    style EMBED fill:#f97316,color:#000
    style SENTRY fill:#362d59,color:#fff
    style LOGS fill:#334155,color:#fff
    style ANALYTICS fill:#334155,color:#fff
    style GH fill:#24292e,color:#fff
    style PREVIEW fill:#000,color:#fff
    style STAGING fill:#2d9d6f,color:#fff
```

---

## 4. Production Stack — What Each New Layer Does

### 4a. API Gateway / Backend Layer

| Option | Tradeoff |
|--------|----------|
| **Expand Supabase Edge Functions** (Deno) | Lowest friction — you already have one. But Deno ecosystem is smaller, no Python. |
| **Vercel Serverless Functions** (Node.js) | Zero-config with your Vercel deploy. Good for thin API routes. Cold starts on free tier. |
| **Dedicated server (Hono/Express on Railway)** | Full control. Best if you need WebSocket, long-running requests, or complex middleware. |

> [!IMPORTANT]
> **My recommendation:** Start with **Supabase Edge Functions** for simple things (you already deploy there) and add **Vercel Serverless** for anything that needs Node.js packages. Only move to a dedicated server when you outgrow both.

### 4b. File Storage

Use **Supabase Storage** — it integrates with your existing RLS policies and Auth tokens. You already pay for Supabase; adding Storage is free up to 1 GB on the free tier.

Use it for:

- Material uploads (student + lecturer)
- Task evidence attachments
- Export report downloads (CSV/XLS)

### 4c. AI Agent Hosting

Your Python FastAPI agent needs a **real host**. Best options:

| Platform | Cost | Why |
|----------|------|-----|
| **Railway** | $5/mo | One-click Python deploy, auto-sleep, generous free tier |
| **Fly.io** | Free tier | Containers, good for always-on, multi-region |
| **Render** | Free tier | Simple, but cold starts on free |
| **Google Cloud Run** | Pay-per-use | Scales to zero, best for sporadic traffic |

### 4d. Background Jobs

| Tool | Why |
|------|-----|
| **Inngest** | Event-driven, works with Vercel/Supabase, generous free tier |
| **Trigger.dev** | Similar to Inngest, open-source option |

Use for: notification emails, batch contribution recalculation, scheduled badge evaluation, report generation.

### 4e. Observability

| Tool | Free Tier | Purpose |
|------|-----------|---------|
| **Sentry** | 5K errors/mo | Error tracking + performance |
| **PostHog** | 1M events/mo | Product analytics + session replay |
| **Plausible** | N/A (self-host free) | Privacy-first web analytics |
| **Supabase Logs** | Built-in | Database + Edge Function logs |

### 4f. CI/CD

| Tool | What it does |
|------|-------------|
| **GitHub Actions** | Run `vitest`, `eslint`, `tsc`, `vite build` on every PR |
| **Vercel Preview Deploys** | Automatic preview URL per PR (already available) |
| **Supabase Branching** | Creates a branch database for PR-scoped testing |

---

## 5. Migration Priority Roadmap

### P0 — Do Now (before adding more features)

- [ ] **Sentry integration** — Add `@sentry/react` to the SPA. Takes 10 minutes. You need this yesterday.
- [ ] **Supabase Storage** — Replace metadata-only materials with real file upload/download.
- [ ] **Host the Python AI agent** — Deploy to Railway or Fly.io. Set `VITE_STUDENT_AGENT_URL` on Vercel.
- [ ] **GitHub Actions CI** — Add a workflow that runs `pnpm lint && pnpm test && pnpm build` on PRs.

### P1 — Do Soon (next 2–4 weeks)

- [ ] **Expand Edge Functions** — Move sensitive business logic (invite validation, contribution calc) server-side.
- [ ] **Supabase Realtime** — Subscribe to task/notification changes for live dashboard updates.
- [ ] **Rate limiting** — Use Upstash Redis or Vercel Edge Middleware to throttle API calls.
- [ ] **Basic analytics** — Add PostHog or Plausible for user behavior tracking.

### P2 — Do Before Scale (before 500+ users)

- [ ] **Background job system** — Inngest or Trigger.dev for email notifications and batch processing.
- [ ] **Caching** — Upstash Redis for hot queries (group member lists, contribution scores).
- [ ] **Staging environment** — Supabase branch DB + Vercel preview for safe testing.
- [ ] **PWA** — Add service worker for offline task viewing (students in poor connectivity).

### P3 — Do When Needed

- [ ] **Dedicated backend server** — Only if Edge Functions + Serverless hit limits.
- [ ] **RAG on materials** — Embed uploaded documents for smarter AI agent answers.
- [ ] **Multi-region** — Supabase read replicas if you serve users across continents.

---

## 6. Summary: Current vs Production at a Glance

| Concern | Current | Production |
|---------|---------|------------|
| Frontend | React SPA on Vercel ✅ | Same + PWA + Sentry |
| Auth | Supabase Auth ✅ | Same + GitHub OAuth option |
| Database | Supabase Postgres + RLS ✅ | Same + read replica (scale) |
| API Layer | ❌ Direct client → DB | Edge Functions + Serverless |
| File Storage | ❌ Metadata only | Supabase Storage |
| AI Agent | ❌ Local only | Hosted on Railway/Fly.io |
| Realtime | ❌ Not used | Supabase Realtime subscriptions |
| Background Jobs | ❌ None | Inngest / Trigger.dev |
| Caching | ❌ None | Upstash Redis |
| Monitoring | ❌ None | Sentry + PostHog |
| CI/CD | ❌ Manual | GitHub Actions + Preview Deploys |
| Rate Limiting | ❌ None | Edge Middleware + Redis |

> [!TIP]
> The good news: your **core stack choices are solid** — React, Supabase, Vite, TypeScript, Tailwind, shadcn/ui are all production-grade. The gaps are mostly about **operational maturity** (monitoring, CI/CD, hosting the agent) rather than fundamental architecture problems. You don't need to rewrite anything — you need to add layers around what you already have.
