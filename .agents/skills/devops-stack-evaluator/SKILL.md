---
name: devops-stack-evaluator
description: >
  Use this skill to evaluate Teamfair's current tech stack maturity, then produce a
  detailed, actionable improvement roadmap. Trigger whenever the user asks about stack
  health, gap analysis, modernization priorities, or "what should we improve next".
  Also trigger for: "evaluate our stack", "what's wrong with our setup", "DevOps maturity
  assessment", "should we add X", or any request to audit the current architecture.
  This skill is tailored for a serverless stack: Supabase (Auth, Postgres, Edge Functions,
  Storage, Realtime) + Vercel (SPA hosting) + Railway/Fly.io (Python services).
---

# Teamfair Stack Evaluator → Roadmap Generator

You are a senior architect evaluating a **serverless-first** stack. Your job is to:

1. **Gather** the current state across 8 dimensions
2. **Score** each dimension 1–5 with justification
3. **Produce** a phased, prioritized roadmap with actionable detail

---

## Stack Context (Read First)

Teamfair is a React SPA deployed on Vercel with Supabase as the sole backend (Auth, Postgres, RLS, Edge Functions). A Python FastAPI AI agent connects via OpenRouter. Read these docs before evaluating:

- `docs/guides/project_structure.md` — full architecture overview
- `docs/guides/how_to_run.md` — env vars, migrations, deploy checklist
- `docs/guides/state_and_data.md` — auth flow, RLS, data persistence
- `docs/guides/student_workspace_agent.md` — Python AI agent architecture

---

## Phase 1: Information Gathering

If the current state is not already known, inspect the codebase. Collect answers across:

| Category | What to Check |
|---|---|
| **Frontend** | Framework, bundler, UI library, state management, testing |
| **Auth & Security** | Auth provider, RLS policies, secrets handling, Edge Functions |
| **Database** | Schema maturity, migration count, RPC functions, connection patterns |
| **File Storage** | Upload/download mechanism, CDN, bucket policies |
| **API Architecture** | Direct client→DB vs API layer, Edge Functions usage, rate limiting |
| **CI/CD** | Pipeline existence, automated tests, preview deploys, migration checks |
| **Observability** | Error tracking, logging, analytics, alerting |
| **AI/ML Services** | Agent hosting, model provider, production readiness |

---

## Phase 2: Evaluation Matrix

Score each dimension **1–5** with a brief justification.

### Scoring Rubrics

#### 1. Authentication & Authorization (1–5)

- 1: No auth, public data access
- 2: Basic auth, no RLS, secrets in client code
- 3: Managed auth (Supabase/Auth0), some RLS policies, secrets in env vars
- 4: Full RLS coverage, server-side validation (Edge Functions/RPCs), proper secret scoping
- 5: Zero-trust patterns, automated RLS testing, security audit trail, pen-tested

#### 2. CI/CD Pipeline Health (1–5)

- 1: Manual deploys, no pipeline
- 2: Auto-deploy on push (Vercel), but no tests or checks
- 3: Lint + build checks in CI, preview deploys available
- 4: Full CI (lint + test + build + type-check), migration validation, preview deploys with branch DBs
- 5: Progressive delivery, E2E tests in CI, automated rollback, dependency scanning

#### 3. Observability & Error Tracking (1–5)

- 1: No error tracking, console.log only
- 2: Supabase dashboard logs only
- 3: Error tracking SDK (Sentry), basic Supabase log queries
- 4: Sentry + product analytics + Supabase log alerts + custom dashboards
- 5: Full telemetry, SLO tracking, proactive alerting, session replay

#### 4. Data Layer Maturity (1–5)

- 1: No schema management, ad-hoc queries
- 2: Some migrations, no RLS, no connection pooling
- 3: Versioned migrations, RLS enabled, manual application
- 4: Full migration chain, RLS coverage, typed client (generated types), connection pooling
- 5: Automated migration CI checks, RLS unit tests, read replicas, backup verification

#### 5. API Architecture (1–5)

- 1: SPA directly queries database with no abstraction
- 2: Direct Supabase client calls from browser, some RPC functions
- 3: Mix of direct calls and Edge Functions for sensitive operations
- 4: API layer (Edge Functions / serverless) for all mutations, rate limiting, validation
- 5: Full API gateway, request signing, circuit breakers, webhook support

#### 6. AI/ML Service Hosting (1–5)

- 1: No AI integration
- 2: AI exists but runs locally only, no production deployment
- 3: Hosted on a PaaS (Railway/Fly.io), basic health checks
- 4: Auto-scaling, structured logging, error tracking, fallback models
- 5: Multi-model routing, RAG pipeline, cost optimization, A/B testing

#### 7. Developer Experience (1–5)

- 1: Days to onboard, no documentation
- 2: README exists, many manual steps to set up
- 3: Documented setup, `.env.example`, local dev works
- 4: One-command setup, fast HMR, comprehensive docs, test suite
- 5: Dev containers, automated seed data, local Supabase emulator, contribution guides

#### 8. Cost & Operational Efficiency (1–5)

- 1: No cost visibility, unknown spend
- 2: Know the plan tier, no optimization
- 3: Right-sized plans, some free-tier usage tracked
- 4: Budget alerts, cost-per-feature awareness, optimized queries
- 5: FinOps practice, unit economics, automated scaling policies

---

## Phase 3: Evaluation Output Format

```
## Current Stack Summary
[Brief 3–5 sentence description of what was analyzed]

## Evaluation Scores
| Dimension | Score | Status |
|---|---|---|
| Authentication & Authorization | X/5 | 🔴/🟡/🟢 |
| CI/CD Pipeline Health | X/5 | ... |
| Observability & Error Tracking | X/5 | ... |
| Data Layer Maturity | X/5 | ... |
| API Architecture | X/5 | ... |
| AI/ML Service Hosting | X/5 | ... |
| Developer Experience | X/5 | ... |
| Cost & Operational Efficiency | X/5 | ... |
| **Overall Score** | **X/40** | ... |

Score key: 🔴 Critical (1–2) · 🟡 Needs Work (3) · 🟢 Healthy (4–5)

## Key Findings
### Strengths (Keep & Build On)
- [strength 1]

### Critical Gaps (Fix First)
- [gap 1 — why it's critical, what's at risk]

### Quick Wins (Low effort, high value)
- [quick win 1]
```

---

## Phase 4: Roadmap Generation

Generate a **3-phase roadmap**. For each item include:

- **Goal**: What it achieves
- **Why now**: Prioritization rationale
- **Effort**: T-shirt size (S/M/L/XL)
- **Owner role**: Who typically leads this
- **Tools**: Specific tool with pricing tier
- **Success metric**: How you'll know it's done
- **Dependencies**: What must be done first
- **Skill guide**: Reference the `.agents/skills/<name>/SKILL.md` if one exists

### Roadmap Template

```
## Roadmap

### Phase 1 — Stabilize & De-Risk (Weeks 1–4)
Focus: Fix critical gaps before adding features.

#### 1.1 [Item Name]
- **Goal**: ...
- **Why now**: ...
- **Effort**: S
- **Owner**: Frontend / DevOps / Full-stack
- **Tools**: [tool + tier, e.g. "Sentry Free (5K errors/mo)"]
- **Success metric**: ...
- **Depends on**: Nothing / [item X]
- **Skill guide**: `.agents/skills/<name>/SKILL.md`

---

### Phase 2 — Harden & Automate (Weeks 5–12)
Focus: Add operational maturity, improve DX.

---

### Phase 3 — Scale & Optimize (Weeks 13–24)
Focus: Performance, cost optimization, advanced features.

---

### Roadmap Summary Table
| # | Item | Phase | Effort | Owner | Priority |
|---|---|---|---|---|---|
| 1.1 | ... | 1 | S | Frontend | 🔴 Critical |

### Recommended Tool Stack (After Roadmap)
| Category | Tool | Tier | Monthly Cost |
|---|---|---|---|
| Error Tracking | Sentry | Team | $0–26 |
```

---

## Guardrails & Quality Checks

Before producing the final output:

- [ ] Every score has a 1–2 sentence justification
- [ ] Phase 1 only contains 🔴 Critical items or dependency blockers
- [ ] Every roadmap item has a measurable success metric
- [ ] Tool recommendations include specific pricing tiers within $20–50/mo total budget
- [ ] Effort sizes are realistic for a small team (1–3 developers)
- [ ] No item in Phase 3 depends on something not addressed in Phase 1 or 2
- [ ] Every item references its `.agents/skills/` guide if one exists

## Output Handoff

At the end, always offer:
> "Want me to execute any part of this roadmap? Point me to the skill guide in `.agents/skills/<name>/` and I'll implement it using the DevOps Stack Executor skill."
