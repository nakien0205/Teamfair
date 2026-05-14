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
| `store.py` | `StudentWorkspaceStore`: demo seed data, `load_json` / `save_json`, `recalc_contributions` (same idea as the React provider). |
| `tools.py` | OpenAI Chat Completions `tools` JSON (function names + JSON Schema for arguments). |
| `tool_handlers.py` | Maps each tool name to store reads/writes; returns **JSON strings** as tool results for the model. |
| `agent.py` | OpenAI SDK client pointed at OpenRouter; **tool loop** on the light model; optional **heavy** synthesis pass; `run_agent_detailed` returns answer + **tool_trace** + optional **reasoning** fragments. |
| `server.py` | FastAPI app: `POST /chat`, `GET /health`. CORS allows local Vite and **https://teamfair.vercel.app** (override with `STUDENT_AGENT_CORS_ORIGINS`). |
| `__main__.py` | CLI entrypoint. |
| `requirements.txt` | `openai`, `python-dotenv`, `pydantic`, `fastapi`, `uvicorn`. |

### Environment variables

- **`OPENROUTER_API_KEY`** (required): read from the project `.env` at the repo root (see `config.py` path logic: two levels up from the package).
- Optional: **`OPENROUTER_HTTP_REFERER`**, **`OPENROUTER_X_TITLE`** for OpenRouter attribution headers. Default referer is **`https://teamfair.vercel.app`** so production traffic matches your deployed domain.
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

### How to run (CLI)

From the **`python/`** directory so imports resolve:

```bash
cd python
pip install -r student_workspace_agent/requirements.txt
python -m student_workspace_agent -m "Your instruction"
```

Useful flags (see `__main__.py`): `--snapshot`, `--save-snapshot`, `--heavy`, `--max-rounds`.

### HTTP server (Vite + production)

The student dashboard calls the agent through **your own backend** so `OPENROUTER_API_KEY` never ships to the browser.

1. Install deps (includes FastAPI + uvicorn): `pip install -r student_workspace_agent/requirements.txt` from the `python/` directory.
2. Start the API (default port **8010**):

```bash
cd python
python -m uvicorn student_workspace_agent.server:app --host 127.0.0.1 --port 8010
```

3. **Local Vite:** [vite.config.ts](../../vite.config.ts) proxies `/api/student-agent` → `http://127.0.0.1:8010`, and the UI posts to **`/api/student-agent/chat`** (rewritten to `/chat` on the Python side).

4. **Vercel static app** ([https://teamfair.vercel.app/](https://teamfair.vercel.app/)): the Python process is **not** hosted by the Vite build. Deploy the FastAPI app elsewhere (Railway, Fly, a small VM, etc.), then set **`VITE_STUDENT_AGENT_URL`** in Vercel to that base URL (no trailing slash). The UI will call `{VITE_STUDENT_AGENT_URL}/chat`.

**`POST /chat` JSON body:** `{ "message": string, "workspace": WorkspaceSnapshot, "use_heavy"?: boolean, "max_tool_rounds"?: number }`

**Response:** `{ "answer": string, "tool_trace": [...], "reasoning": string | null, "used_heavy_synthesis": boolean }`

The React app builds `workspace` from `TeamContext` via [src/lib/workspaceSnapshot.ts](../../src/lib/workspaceSnapshot.ts). Calendar tab state is still **not** in that snapshot (empty `calendar_events` until shared state exists).

### Programmatic use

```python
from student_workspace_agent import run_agent, run_agent_detailed, StudentWorkspaceStore

store = StudentWorkspaceStore()
answer = run_agent("Summarize tasks for the current group.", store=store, use_heavy=False)

result = run_agent_detailed("List materials.", store=store, use_heavy=False)
print(result.answer, result.tool_trace, result.reasoning)
```

### Windows note

The CLI tries to reconfigure **stdout to UTF-8** so Vietnamese strings in tool JSON print correctly in consoles that default to a legacy code page.

### What to build next (not implemented here)

- Write agent tool results **back** into `TeamContext` from the UI (requires careful UX and validation).
- Lift **calendar** state into shared context so snapshots match the calendar tab.
- Automated tests for tools/agent (intentionally deferred earlier; another pass can add them).

### Related docs

- Student UI map: [student_workspace.md](student_workspace.md)
- Where real app state lives: [state_and_data.md](state_and_data.md)
- Env and app run: [how_to_run.md](how_to_run.md)
