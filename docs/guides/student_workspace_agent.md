See [index.md](index.md) for the docs routing map.

## Student workspace AI agent (Python)

This document describes the **offline Python agent** that mirrors the student dashboard feature areas from [student_workspace.md](student_workspace.md). It exists so an AI (or you) can reason about tasks, calendar, contribution, materials, and badges using **function tools** and a **local workspace store**—without reading every implementation file.

### Why this exists

- The web app keeps dashboard business data in React ([state_and_data.md](state_and_data.md): `TeamContext`, plus calendar state in `ProjectCalendar`). There is **no shared HTTP API** for that data yet.
- The Python package implements the **same concepts** as tools + JSON snapshots so agents can plan, answer questions, or simulate changes **deterministically** on a store you control.

### Where the code lives

All agent code is under **[`python/student_workspace_agent/`](../../python/student_workspace_agent/)**:

| Module | Responsibility |
|--------|----------------|
| `config.py` | Loads repo-root `.env`, OpenRouter base URL, allowed model IDs, optional OpenRouter headers (`HTTP-Referer`, `X-Title` via env overrides). |
| `schemas.py` | Pydantic models aligned with `TeamContext` types (`Task`, `Group`, `MemberStat`, …) and `ProjectCalendar` (`CalendarEvent`). |
| `store.py` | `StudentWorkspaceStore`: initial seed data, `load_json` / `save_json`, `recalc_contributions` (same idea as the React provider). |
| `tools.py` | OpenAI Chat Completions `tools` JSON (function names + JSON Schema for arguments). |
| `tool_handlers.py` | Maps each tool name to store reads/writes; returns **JSON strings** as tool results for the model. |
| `agent.py` | OpenAI SDK client pointed at OpenRouter; **tool loop** on the light model; optional **heavy** synthesis pass; `run_agent_detailed` returns answer + **tool_trace** + optional **reasoning** fragments. |
| `contribution_analyzer.py` | AI-powered contribution analysis. `analyze_contribution()` accepts student data (tasks, work logs, reviews, score), builds a structured Vietnamese prompt for DeepSeek, parses JSON into `AnalysisResult` dataclass (effort_summary, anomalies, timeline_assessment, recommendations, confidence_tag, reasoning). Fallback on LLM failure. |
| `server.py` | FastAPI app: `POST /chat`, `POST /analyze-contribution`, `GET /health`. The `/analyze-contribution` endpoint accepts student contribution data and returns AI analysis. Includes in-memory rate limiting (1 req/student/30s). CORS allows local Vite, **<https://teamfair.company>**, **<https://www.teamfair.company>**, and **<https://teamfair.vercel.app>** (override with `STUDENT_AGENT_CORS_ORIGINS`). |
| `__main__.py` | CLI entrypoint. |
| `requirements.txt` | `openai`, `python-dotenv`, `pydantic`, `fastapi`, `uvicorn`. |

### Environment variables

- **`OPENROUTER_API_KEY`** (required): read from the project `.env` at the repo root (see `config.py` path logic: two levels up from the package).
- Optional: **`OPENROUTER_HTTP_REFERER`**, **`OPENROUTER_X_TITLE`** for OpenRouter attribution headers. Default referer is **`https://teamfair.company`** so production traffic matches the custom Vercel domain.
- Optional: **`STUDENT_AGENT_CORS_ORIGINS`** — comma-separated list to replace the default CORS allowlist for the HTTP server.

### Models (hard rule in code)

Only these OpenRouter model IDs are used:

- **Light (tool orchestration):** `deepseek/deepseek-v4-flash`
- **Heavy (optional final answer polish):** `deepseek/deepseek-v4-pro` — enabled with CLI flag `--heavy` or `use_heavy=True` in `run_agent`.

### Mental model: what the agent actually touches

```text
User message → OpenRouter (flash) → maybe tool calls → Python handlers mutate/read StudentWorkspaceStore → loop until model returns text (no tools) → optional pro synthesis
```

The store is **not** the browser. Changes do **not** appear in the Vite app unless you later build a bridge (e.g. export/import the same JSON shape from the UI or a backend).

### Snapshot JSON (workspace file)

`StudentWorkspaceStore.save_json` / `load_json` persist a **`WorkspaceSnapshot`** (see `schemas.py`):

- `current_group_index`, `groups[]` (each group: `id`, `name`, `members`, `tasks`, `activityLog`)
- Global lists (not per-group in the mirror, matching app structure): `reports`, `materials`, `lecturer_student_reviews`, `student_badges`
- `calendar_events[]` (calendar is separate from `Group` in the TypeScript app too)

Student reports use the JSON key **`from`** (alias in Pydantic); dumps use `by_alias=True` for compatibility.

### Tool surface vs the five student UI areas

Tools are grouped to match [student_workspace.md](student_workspace.md):

1. **Kanban / tasks** — `list_tasks`, `create_task`, `update_task_status`, `update_task_fields`, `append_task_evidence_meta`, `approve_task`, `delete_task` (activity log lines mirror Vietnamese phrasing used in `TeamContext` where relevant).
2. **Calendar / timeline** — `list_calendar_events`, `create_calendar_event`, `update_calendar_event`, `delete_calendar_event`.
3. **Contribution / fairness** — `get_contribution_snapshot`, `list_activity_log`, `draft_peer_report` (preview only), `submit_student_report` (persists to local `reports`).
4. **Materials** — `list_materials`, `add_material`, `delete_material` (metadata only; no file bytes).
5. **Verified badges** — `list_verified_badges`, `summarize_badge_status` (badges + lecturer reviews in store).

Additionally, **`list_groups`** and **`set_current_group`** exist because the seeded store has multiple groups; the rest of the tools operate on the **current** group for task/activity/contribution data.

Authoritative list of names and parameters: **`python/student_workspace_agent/tools.py`**.

### Running the Agent and Server

For installation prerequisites, running the CLI agent, starting the local FastAPI server, or production deployment steps, see **[how_to_run.md](how_to_run.md#python-ai-agent-server)**.

### Programmatic use

```python
from student_workspace_agent import run_agent, run_agent_detailed, StudentWorkspaceStore

store = StudentWorkspaceStore()
answer = run_agent("Summarize tasks for the current group.", store=store, use_heavy=False)

result = run_agent_detailed("List materials.", store=store, use_heavy=False)
print(result.answer, result.tool_trace, result.reasoning)
```

### AI Contribution Analysis

Added in June 2026. The `contribution_analyzer.py` module provides AI-powered analysis of student contributions:

- **Endpoint**: `POST /analyze-contribution` — accepts student name, group name, deterministic score, tasks, work logs, leader reviews, peer review average.
- **Response**: `AnalysisResult` with `effort_summary`, `anomalies`, `timeline_assessment` (regular/front_loaded/back_loaded/sporadic), `recommendations`, `confidence_tag` (well_supported/partially_supported/insufficient_evidence), `reasoning`.
- **Rate limit**: 1 request per student_name per 30 seconds (in-memory).
- **Frontend integration**: `src/lib/contributionAi.ts` handles fetching, caching (Supabase `contribution_ai_analysis` table), and hash-based staleness detection.
- **Page integration**: `src/pages/StudentMyContribution.tsx` loads AI analysis in a separate non-blocking `useEffect` and shows effort summary, anomalies, recommendations, and confidence badges.
- **Scoring fix**: `src/lib/studentContribution.ts` no longer fabricates 60% defaults when peer review or leader evaluation data is missing; weight is redistributed proportionally.

### Related docs

- Student UI map: [student_workspace.md](student_workspace.md)
- Where real app state lives: [state_and_data.md](state_and_data.md)
- Env and app run: [how_to_run.md](how_to_run.md)
