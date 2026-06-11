# Teamfair Technical Roadmap (Detailed Validation Draft)

This document details the upcoming engineering phases, architectural patterns, and structural decisions for the Teamfair platform. It is designed to be fully comprehensive so that another AI agent can validate the technical choices, review security implications, and execute the steps.

---

## Technical Decisions Audit

Following the guidelines in [role.md](file:///d:/Python/Projects/Teamfair/docs/guides/role.md), every major architectural change proposed in this roadmap is evaluated with its confidence level, trade-offs, failure scenarios, and alternatives.

### 1. Serverless Background Job Orchestration (Inngest)
We will run background tasks asynchronously using **Inngest** via a dedicated Deno Edge Function at `supabase/functions/inngest/index.ts`.

* **CONFIDENCE**: **HIGH** — This is the most optimal approach for a serverless web app hosted on Vercel and Supabase.
* **WHAT YOU'RE TRADING AWAY**: We depend on an external third-party service (Inngest) to manage the state machine and trigger the webhook endpoints. If Inngest suffers an outage, background triggers will fail or delay.
* **WHEN THIS BREAKS**: This breaks if we require low-latency (sub-millisecond) synchronous task completion, or if the system runs in an offline intranet environment (since Inngest needs public HTTPS callbacks to reach Supabase Edge Functions).
* **ALTERNATIVES SKIPPED**:
  * *Dedicated VM with BullMQ/Redis*: Skipped because it requires managing an always-on Docker container (e.g. on Railway/AWS ECS) just to process small queues, which introduces maintenance overhead and significantly raises monthly hosting costs.
  * *Database Triggers with PG_Cron*: Skipped because running heavy calculations (like contribution metrics or AI audits) directly inside PostgreSQL triggers slows down database operations and degrades overall performance.

### 2. Upstash Redis Caching (Hybrid TTL + Active Invalidation)
We will cache expensive database reads (e.g., student member stats, rubric templates) in **Upstash Redis** with a default 5-minute TTL, while actively purging relevant keys during data mutations.

* **CONFIDENCE**: **HIGH** — Caching is critical to protect the database layer from high-frequency queries as the user base grows.
* **WHAT YOU'RE TRADING AWAY**: Code complexity. Developers must write explicit `invalidate` calls inside all mutation operations in `teamPersistence.ts` and Edge Functions.
* **WHEN THIS BREAKS**: If a developer forgets to add an invalidation call on a new data mutation, or if a network failure prevents the invalidation command from reaching Upstash. In this scenario, users will see stale data for up to 5 minutes until the TTL expires naturally.
* **ALTERNATIVES SKIPPED**:
  * *Simple TTL-only Caching*: Skipped because a 60-second delay in seeing task approvals or member scores creates a poor user experience, while a longer TTL without invalidation is unacceptable for collaborative grading.
  * *No Caching (Direct-to-Postgres)*: Skipped because the group contribution percentage recalculation performs complex aggregates over multiple tables (tasks, members, logs), which will bottleneck database CPU under concurrent class-wide usage.

### 3. Isolated Staging Environment
We will configure a separate free-tier Supabase project for staging, and configure Vercel to load the staging database credentials for all non-production branch deployments (`preview` environments).

* **CONFIDENCE**: **HIGH** — Separation of test and live data is standard practice to prevent accidental corruption.
* **WHAT YOU'RE TRADING AWAY**: Overhead of syncing schema migrations and environment secrets across two different Supabase projects.
* **WHEN THIS BREAKS**: If the developer fails to apply database migrations to the staging project before pushing a preview branch, causing runtime exceptions during preview testing.
* **ALTERNATIVES SKIPPED**:
  * *Supabase Database Branching*: Skipped because native branching is a paid team feature that exceeds our current budget constraints.
  * *No Staging Database (Direct-to-Prod)*: Skipped because applying SQL schema migrations directly to the live production database without verification can cause fatal downtime and data corruption.

### 4. PWA (Progressive Web App) Offline Mode
We will add a service worker (using Vite PWA plugin) to cache the static application shell and store local edits in IndexedDB when offline, syncing changes once connectivity is restored.

* **CONFIDENCE**: **MEDIUM** — Offline support is important for students with unreliable internet, but adds significant state synchronization complexity.
* **WHAT YOU'RE TRADING AWAY**: Increased bundle size and the risk of synchronization conflicts (e.g., if two students edit the same task offline and reconnect at different times).
* **WHEN THIS BREAKS**: When complex merge conflicts occur between offline writes. If Student A changes a task description offline and Student B deletes the task online, the sync worker must handle the conflict gracefully without crashing.
* **ALTERNATIVES SKIPPED**:
  * *Native iOS/Android App*: Skipped because building native apps requires separate Kotlin/Swift codebases, doubling development effort and time-to-market.

---

## Detailed Execution Checklist

### Phase 1: Asynchronous Processing & Performance (P2)
This phase addresses performance bottlenecks by implementing background queues and hot-query caching.

#### Task 1.1: Inngest Background Queue Integration
1. **Initialize Inngest client**: Create `supabase/functions/inngest/index.ts` and declare the Inngest app instance.
2. **Define event-driven functions**:
   * `teamfair/contributions.recalc`: Recalculates student contribution scores using task states and peer feedback.
   * `teamfair/notification.send`: Dispatches notifications (in-app and future email triggers).
   * `teamfair/badges.evaluate`: Periodic batch evaluation to grant badges based on member achievements.
3. **Register Edge Function**: Deploy the Deno function via `supabase functions deploy inngest` and configure the URL webhook inside the Inngest dashboard.
4. **Refactor persistence layer**: Update `src/lib/teamPersistence.ts` to trigger Inngest events via POST requests to `https://inn.gs/e/<INNGEST_EVENT_KEY>` instead of running heavy computations synchronously.

#### Task 1.2: Redis Cache Layer (Upstash)
1. **Create caching client**: Implement `supabase/functions/_shared/cache.ts` using `@upstash/redis`.
2. **Implement `cached` helper**: Define a wrapper function that queries Redis first, falls back to Postgres on cache misses, and writes the result to Redis with a 300-second TTL.
3. **Cache heavy queries**: Apply caching to `group_members` statistics and rubric schemas.
4. **Trigger Active Invalidation**: Add `redis.del(key)` instructions inside all update/delete functions in `teamPersistence.ts` and `teamApi.ts` to purge obsolete cache keys on data changes.

#### Task 1.3: Isolated Staging Setup
1. **Staging Supabase Project**: Provision a separate free-tier Supabase database.
2. **Vercel Environments**: Map staging environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) strictly to Vercel's `Preview` and `Development` scopes.
3. **CI Pipeline Integration**: Update `.github/workflows/ci.yml` to automatically apply migrations against the staging database before running builds.

---

### Phase 2: Offline Resilience (P2)
This phase ensures the app remains functional under unstable network conditions.

#### Task 2.1: Service Worker (Vite PWA)
1. **Install Plugin**: Add `vite-plugin-pwa` to the dev dependencies and configure it in `vite.config.ts`.
2. **Cache Assets**: Define a caching strategy for static routes, JS/CSS bundles, and image/icon assets.
3. **Offline Fallback UI**: Design a subtle header banner indicating when the application is running in "Offline Mode".

#### Task 2.2: IndexedDB Local Persistence & Sync
1. **Local Writes**: When the client attempts to mutate tasks or submit comments while offline, intercept the call and write the operation log to IndexedDB.
2. **Background Sync**: Register a service worker listener that triggers once `navigator.onLine` returns true.
3. **Conflict Resolution**: Implement a last-write-wins (LWW) conflict strategy with validation checks against the database RLS policies.

---

### Phase 3: Advanced AI Capabilities (P3)
This phase introduces semantic document processing and intelligent grading.

#### Task 3.1: Retrieval-Augmented Generation (RAG) on Thesis Materials
1. **Database Vector Store**: Enable the `pgvector` extension in Supabase Postgres.
2. **Embedding Pipeline**: Create a Supabase Edge Function that listens to `materials` insertions, extracts document text, generates vector embeddings using an OpenAI/DeepSeek embedding model, and saves them to `public.material_embeddings`.
3. **Contextual AI Chat**: Update the Python FastAPI server (`student_workspace_agent/`) to query the vector store for relevant thesis segments before synthesizing a response.

#### Task 3.2: AI-Assisted Rubric Grading
1. **Context Compilation**: Extract task descriptions, student-submitted evidence (file paths, text logs), and rubric criteria definitions.
2. **Synthesis Pass**: Query DeepSeek via OpenRouter to analyze the alignment between student evidence and rubric rating levels.
3. **Draft Generation**: Present the lecturer with pre-filled grading drafts and AI justifications, which the lecturer must manually review and lock.
