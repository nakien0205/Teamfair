# Implementation Plans:  Agent Mutations → Live UI

> [!IMPORTANT]
> The implementer must read each file listed under "Files to inspect" before writing any code.

## Background

The Python agent runs tool calls against a **throwaway `StudentWorkspaceStore`** that is discarded after each HTTP response. Mutations (e.g. create_task, approve_task) exist only in that temporary store and never reach the browser. The goal is to close this loop so the UI reflects what the agent did.

## Design Decisions (already resolved)

| Decision | Choice |
|----------|--------|
| Auto-apply vs confirm? | **Confirm** — show a diff UI (red = removed, green = added) before applying. A per-user setting enables auto-apply. |
| Conflict handling? | **Full snapshot replace** — the mutated snapshot returned from the server is the source of truth; it replaces the in-memory `TeamContext` state after user confirmation. This is simpler and more maintainable than replaying individual operations. |
| UI locking while agent works? | **Lock only the section the agent is touching** (e.g. KanbanBoard if the agent is doing task tools). Other sections remain interactive. |

## Architecture Overview

```
UI sends snapshot → POST /chat → agent mutates store → 
response includes mutated_workspace + tool_trace → 
UI shows diff panel → user confirms → TeamContext state replaced
```

## Files to Inspect (in this order)

### Python side

1. `python/student_workspace_agent/schemas.py` — `WorkspaceSnapshot`, `Task`, `Group`, etc. The implementer needs to understand the full snapshot shape.
2. `python/student_workspace_agent/store.py` — `StudentWorkspaceStore`, `replace_group`, `recalc_contributions`. After the agent runs, serialise `store.snapshot` to send back.
3. `python/student_workspace_agent/agent.py` — `AgentRunResult.to_json_dict()`. Add a `workspace` field here containing the final serialised store snapshot.
4. `python/student_workspace_agent/server.py` — `chat()` endpoint. After `run_agent_detailed`, call `store.snapshot.model_dump(mode="json", by_alias=True)` and include it in the return dict.
5. `python/student_workspace_agent/tool_handlers.py` — understand which tools mutate the store so the diff logic on the frontend knows which UI sections to flag as "agent was here".

### TypeScript/React side

6. `src/lib/workspaceSnapshot.ts` — `WorkspaceSnapshotJson` type and `buildWorkspaceSnapshotFromTeam`. The response `workspace` from the server must match this shape. Also write a reverse function `applySnapshotToTeamState(snapshot, setGroups, setReports, …)` here.
2. `src/context/TeamContext.tsx` — Add a new context method `applyAgentSnapshot(snapshot: WorkspaceSnapshotJson): void` that replaces groups, reports, materials, etc. from the snapshot. It must also call `persist()` for Supabase mode (same pattern as `loadPersistedState`). Be careful with Date deserialization (ISO strings → `Date` objects).
3. `src/components/feature-groups/StudentAgentSidebar.tsx` — The main surface for all UI changes in this task.
4. `src/pages/StudentDashboard.tsx` — UI section locking: pass an `agentLockedSection` state down. The active section components (KanbanBoard, ProjectCalendar, etc.) need to receive a `disabled` or `locked` prop.
5. `src/components/KanbanBoard.tsx` — Add a `locked?: boolean` prop; when true, disable drag-and-drop and all interactive buttons.
6. `src/components/ProjectCalendar.tsx` — Same: `locked?: boolean` prop.

### Docs

12. `docs/guides/student_workspace_agent.md` — Full agent mental model; read lines 41–47 (the store-not-browser warning) and lines 85–105 (HTTP server contract) before touching server.py.
2. `docs/guides/state_and_data.md` — Understand `canPersist`, `dataSource`, and the demo/supabase branch in `TeamContext` before adding `applyAgentSnapshot`.

## Proposed Changes

### Python — `agent.py`

#### [MODIFY] [agent.py](file:///d:/Python/Projects/Teamfair/python/student_workspace_agent/agent.py)

- `AgentRunResult` dataclass: add `workspace: dict[str, Any] | None = None`.
- `to_json_dict()`: include `"workspace": self.workspace`.
- `run_agent_detailed`: after the loop, serialize `store.snapshot.model_dump(mode="json", by_alias=True)` and assign to `AgentRunResult.workspace`.

### Python — `server.py`

#### [MODIFY] [server.py](file:///d:/Python/Projects/Teamfair/python/student_workspace_agent/server.py)

- No structural change needed; `result.to_json_dict()` will automatically include `workspace` once agent.py is updated.

### TypeScript — `workspaceSnapshot.ts`

#### [MODIFY] [workspaceSnapshot.ts](file:///d:/Python/Projects/Teamfair/src/lib/workspaceSnapshot.ts)

- Add `applySnapshotToTeamContext(snapshot: WorkspaceSnapshotJson)` helper that deserializes ISO date strings back to `Date` objects and returns objects compatible with `TeamContext` state setters.

### TypeScript — `TeamContext.tsx`

#### [MODIFY] [TeamContext.tsx](file:///d:/Python/Projects/Teamfair/src/context/TeamContext.tsx)

- Add `applyAgentSnapshot` to `TeamContextType` interface.
- Implement it: deserialize the snapshot, call `setGroups`, `setReports`, `setMaterialsByGroupId`, `setLecturerStudentReviews`, `setStudentBadges`. In `supabase` mode, call `persist(() => loadPersistedState())` afterward to write back to Supabase (or skip and just update state — decide at implementation time).

### TypeScript — `StudentAgentSidebar.tsx`

#### [MODIFY] [StudentAgentSidebar.tsx](file:///d:/Python/Projects/Teamfair/src/components/feature-groups/StudentAgentSidebar.tsx)

**New state:**

```ts
const [pendingSnapshot, setPendingSnapshot] = useState<WorkspaceSnapshotJson | null>(null);
const [diffOpen, setDiffOpen] = useState(false);
```

**After agent responds:** if `data.workspace` exists, set `pendingSnapshot` and open diff panel. Do NOT apply automatically yet.

**Diff panel UI** (inside the Sheet, above the input area):

- Show a collapsible section "Thay đổi của AI / AI changes"
- For tasks: compare `snapshot.groups[i].tasks` (before) vs `data.workspace.groups[i].tasks` (after)
  - Green background row = added task (id not in before list)
  - Red background row = removed task (id not in after list)
  - Yellow background row = modified task (same id, different fields)
- For calendar_events, materials: same diff pattern
- Two buttons: **"Áp dụng / Apply"** and **"Bỏ qua / Discard"**
- If `autoApply` setting is `true`, skip the panel and call apply immediately

**On apply:** call `team.applyAgentSnapshot(pendingSnapshot)`, clear `pendingSnapshot`.

**UI locking:** add `lockedSection` state. Parse the `tool_trace` tool names to determine which section the agent worked on:

- `create_task / update_task_status / approve_task / delete_task` → lock `'work'`
- `create_calendar_event / update_calendar_event / delete_calendar_event` → lock `'calendar'`
- `add_material / delete_material` → lock `'materials'`
- Multiple sections touched → lock all of them
Pass `lockedSection` up via a prop or context to `StudentDashboard`.

**Auto-apply setting:** Add a simple `localStorage`-backed boolean `agentAutoApply`. Add a toggle in the sidebar header or Sheet footer.

### TypeScript — `StudentDashboard.tsx`

#### [MODIFY] [StudentDashboard.tsx](file:///d:/Python/Projects/Teamfair/src/pages/StudentDashboard.tsx)

- Accept `lockedSection: string | null` from `StudentAgentSidebar` (lift state up or use a shared atom/context).
- Pass `locked={lockedSection === 'work'}` to `<KanbanBoard>`.
- Pass `locked={lockedSection === 'calendar'}` to `<ProjectCalendar>`.

### TypeScript — `KanbanBoard.tsx` and `ProjectCalendar.tsx`

#### [MODIFY] both files

- Add `locked?: boolean` prop. When true, apply `pointer-events-none opacity-60` to the card/board and show a small overlay badge "AI đang làm việc / AI working…".

## Verification Plan

### Manual

1. Start the Python agent server locally (`uvicorn`).
2. Open the student dashboard, open the AI sidebar.
3. Send: *"Tạo task mới tên 'Test AI Bridge' giao cho Trần Thị B deadline 2026-06-01 30% contribution"*.
4. Verify the diff panel appears showing the new task in green.
5. Click Apply. Verify the task appears in the Kanban board.
6. Verify the Kanban board was locked while the agent was running.
7. Send: *"Xóa task 'Test AI Bridge'"*. Verify diff shows it in red. Discard. Verify it still exists.
8. Enable auto-apply. Repeat step 3. Verify task appears without a confirmation dialog.
