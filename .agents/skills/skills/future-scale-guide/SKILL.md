---
name: future-scale-guide
description: >
  Decision guide for future scaling items: dedicated backend, RAG on materials, multi-region.
  Trigger when: planning for scale, evaluating architecture changes, or executing roadmap P3 items.
  This is a decision document, not an executable task — it provides criteria for when to act.
---

# P3: Future Scale Decision Guide

## Context
These items are NOT needed now. They become relevant when Teamfair exceeds ~500 concurrent users, expands to multiple universities, or adds advanced AI features. This guide documents the **trigger criteria** and **decision framework** for each item.

**Priority**: P3 — Future  
**Effort**: Varies  
**When to revisit**: After P0-P2 are complete and user base exceeds 500

---

## Item 1: Dedicated Backend Server

### Current State
All server-side logic runs in Supabase Edge Functions (Deno) and the Python AI agent (Railway). Business logic is split between client-side React and Edge Functions.

### When to Migrate
Trigger if ANY of these are true:
- Edge Functions hit the 500K invocations/mo free limit
- You need WebSocket connections beyond Supabase Realtime
- You need long-running operations (>30s) that Edge Functions can't handle
- You need to share complex business logic between multiple consumers (mobile app, external API)

### Recommended Approach
- **Framework**: Hono on Vercel Serverless (keeps existing deploy infra) OR Express on Railway (co-locate with AI agent)
- **Migration strategy**: Incremental — move one Edge Function at a time to the new backend
- **Keep Supabase for**: Auth, database, Storage, Realtime (use it as data layer, not app layer)

### Decision Matrix
| Signal | Stay with Edge Functions | Move to dedicated backend |
|--------|--------------------------|--------------------------|
| Invocations/mo | <500K | >500K |
| Avg response time | <1s | >1s (cold starts hurt) |
| Shared logic needed | No | Yes (mobile app, API consumers) |
| Team size | 1-3 | 4+ |

---

## Item 2: RAG on Materials (AI Enhancement)

### Current State
The AI agent uses a local `StudentWorkspaceStore` with seeded data. It cannot read uploaded materials or provide context-aware answers based on course content.

### When to Implement
Trigger if ALL of these are true:
- Supabase Storage is live (P0-2 complete)
- Users actively upload materials (>50 documents)
- Users request AI answers that require document context
- Budget allows embedding model costs (~$5-10/mo for OpenAI embeddings)

### Recommended Approach
1. **Embedding pipeline**: On material upload, extract text → chunk → embed via OpenAI `text-embedding-3-small`
2. **Vector storage**: Supabase `pgvector` extension (free, already in Postgres)
3. **Retrieval**: When AI chat receives a question, embed the query → similarity search → inject top-k chunks as context
4. **Implementation steps**:
   - Enable `pgvector` extension in Supabase
   - Create `material_embeddings` table with `vector(1536)` column
   - Add embedding pipeline to material upload flow (via Inngest background job)
   - Update Python agent to query embeddings before calling LLM

### Key Dependencies
- P0-2 (Supabase Storage) — materials must be uploadable
- P2-1 (Background Jobs) — embedding should be async

---

## Item 3: Multi-Region Deployment

### Current State
Single-region: Supabase in one region, Vercel serves globally via CDN (static assets only), Railway AI agent in one region.

### When to Implement
Trigger if ALL of these are true:
- Users span multiple continents (not just Vietnam)
- P99 latency for database queries exceeds 500ms for remote users
- Budget allows multi-region costs (~$50-100/mo additional)

### Recommended Approach
1. **Supabase Read Replicas** (Pro plan) — add replicas in regions close to users
2. **Fly.io multi-region** — deploy AI agent to multiple regions (already supports this)
3. **Vercel Edge** — already global for static assets; add Edge Functions for dynamic content

### NOT Recommended
- Multi-master database (too complex for current team size)
- Self-hosted Postgres replicas (use managed service)

---

## Item 4: Mobile App

### Current State
PWA provides basic mobile experience (P2-2). Native app does not exist.

### When to Implement
Trigger if:
- PWA limitations block key workflows (push notifications on iOS, offline data sync)
- University partners require a native app in app stores
- Budget allows mobile development effort

### Recommended Approach
- **React Native** or **Expo** — reuse React knowledge, share types and API patterns
- **Supabase client** — `@supabase/supabase-js` works in React Native
- Share authentication, API layer, and types with the web app

---

## Review Schedule

Revisit this guide:
- [ ] After all P0-P2 items are complete
- [ ] When monthly active users exceed 500
- [ ] When expanding to a second university
- [ ] When adding a mobile app requirement

## Post-Task Logging

This is a decision document. When any P3 item is actually implemented, create the corresponding `docs/tech_stack/<item>.md` at that time.
