"""Dispatch tool calls to mutations / reads on StudentWorkspaceStore."""

import json
import time
from datetime import datetime, timezone
from typing import Any

from .schemas import (
    ActivityLogEntry,
    CalendarEvent,
    EvidenceItem,
    MaterialFile,
    StudentReport,
    Task,
)
from .store import StudentWorkspaceStore


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _json(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2)


def _status_log_label(status: str) -> str:
    # Mirrors TeamContext.tsx wording pattern
    if status == "In Progress":
        return "bắt đầu"
    return "hoàn thành"


def handle_tool(store: StudentWorkspaceStore, name: str, arguments: dict[str, Any]) -> str:
    try:
        return _dispatch(store, name, arguments)
    except Exception as e:
        return _json({"ok": False, "error": type(e).__name__, "message": str(e)})


def _dispatch(store: StudentWorkspaceStore, name: str, a: dict[str, Any]) -> str:
    idx = store.snapshot.current_group_index
    g = store.current_group()

    if name == "list_groups":
        rows = [{"index": i, "id": grp.id, "name": grp.name} for i, grp in enumerate(store.snapshot.groups)]
        return _json({"ok": True, "current_group_index": store.snapshot.current_group_index, "groups": rows})

    if name == "set_current_group":
        store.set_current_group_index(int(a["index"]))
        return _json({"ok": True, "current_group_index": store.snapshot.current_group_index})

    if name == "list_tasks":
        tasks = g.tasks
        st = a.get("status")
        if st:
            tasks = [t for t in tasks if t.status == st]
        return _json({"ok": True, "tasks": [t.model_dump(mode="json", by_alias=True) for t in tasks]})

    if name == "create_task":
        tid = str(int(time.time() * 1000))
        desc = a.get("description")
        pr = a.get("priority")
        task = Task(
            id=tid,
            name=a["name"],
            assignedTo=a["assignedTo"],
            status="Todo",
            contributionPercent=int(a["contributionPercent"]),
            approved=False,
            deadline=a["deadline"],
            description=desc if desc else None,
            priority=pr if pr else None,
            evidence=[],
        )
        log = ActivityLogEntry(
            timestamp=_now_iso(),
            description=f'Task "{task.name}" được tạo và giao cho {task.assignedTo}',
        )
        new_g = g.model_copy(
            update={"tasks": [*g.tasks, task], "activityLog": [log, *g.activityLog]}
        )
        store.replace_group(idx, new_g)
        return _json({"ok": True, "task": task.model_dump(mode="json", by_alias=True)})

    if name == "update_task_status":
        tid = a["task_id"]
        status = a["status"]
        actor = a["actor"]
        task = next((t for t in g.tasks if t.id == tid), None)
        if not task:
            return _json({"ok": False, "error": "task_not_found", "task_id": tid})
        label = _status_log_label(status)
        log = ActivityLogEntry(
            timestamp=_now_iso(),
            description=f'{actor} đã {label} task "{task.name}"',
        )
        new_tasks = [t.model_copy(update={"status": status}) if t.id == tid else t for t in g.tasks]
        new_g = g.model_copy(update={"tasks": new_tasks, "activityLog": [log, *g.activityLog]})
        store.replace_group(idx, new_g)
        return _json({"ok": True, "task_id": tid, "status": status})

    if name == "update_task_fields":
        tid = a["task_id"]
        task = next((t for t in g.tasks if t.id == tid), None)
        if not task:
            return _json({"ok": False, "error": "task_not_found", "task_id": tid})
        updates: dict[str, Any] = {}
        for key in ("name", "assignedTo", "deadline", "description", "priority", "contributionPercent", "approved"):
            if key in a and a[key] is not None:
                updates[key] = a[key]
        merged = task.model_copy(update=updates)
        new_tasks = [merged if t.id == tid else t for t in g.tasks]
        new_g = g.model_copy(update={"tasks": new_tasks})
        if "approved" in updates:
            new_g = store.recalc_contributions(new_g)
        store.replace_group(idx, new_g)
        return _json({"ok": True, "task": merged.model_dump(mode="json", by_alias=True)})

    if name == "append_task_evidence_meta":
        tid = a["task_id"]
        fn = a["fileName"]
        task = next((t for t in g.tasks if t.id == tid), None)
        if not task:
            return _json({"ok": False, "error": "task_not_found", "task_id": tid})
        ev = list(task.evidence or [])
        ev.append(EvidenceItem(fileName=fn, uploadTime=_now_iso()))
        merged = task.model_copy(update={"evidence": ev})
        new_tasks = [merged if t.id == tid else t for t in g.tasks]
        store.replace_group(idx, g.model_copy(update={"tasks": new_tasks}))
        return _json({"ok": True, "task": merged.model_dump(mode="json", by_alias=True)})

    if name == "approve_task":
        tid = a["task_id"]
        task = next((t for t in g.tasks if t.id == tid), None)
        if not task:
            return _json({"ok": False, "error": "task_not_found", "task_id": tid})
        log = ActivityLogEntry(timestamp=_now_iso(), description=f'Task "{task.name}" đã được duyệt')
        new_tasks = [t.model_copy(update={"approved": True}) if t.id == tid else t for t in g.tasks]
        new_g = store.recalc_contributions(g.model_copy(update={"tasks": new_tasks, "activityLog": [log, *g.activityLog]}))
        store.replace_group(idx, new_g)
        return _json({"ok": True, "task_id": tid})

    if name == "delete_task":
        tid = a["task_id"]
        task = next((t for t in g.tasks if t.id == tid), None)
        if not task:
            return _json({"ok": False, "error": "task_not_found", "task_id": tid})
        log = ActivityLogEntry(timestamp=_now_iso(), description=f'Task "{task.name}" đã bị xóa')
        new_tasks = [t for t in g.tasks if t.id != tid]
        new_g = store.recalc_contributions(g.model_copy(update={"tasks": new_tasks, "activityLog": [log, *g.activityLog]}))
        store.replace_group(idx, new_g)
        return _json({"ok": True, "deleted_task_id": tid})

    if name == "list_calendar_events":
        events = list(store.snapshot.calendar_events)
        fd, td = a.get("from_date"), a.get("to_date")
        if fd:
            events = [e for e in events if e.date >= fd]
        if td:
            events = [e for e in events if e.date <= td]
        return _json({"ok": True, "events": [e.model_dump(mode="json", by_alias=True) for e in events]})

    if name == "create_calendar_event":
        eid = str(int(time.time() * 1000))
        ev = CalendarEvent(
            id=eid,
            title=a["title"],
            type=a["type"],
            date=a["date"],
            time=a["time"],
            description=a["description"],
            createdBy=a["createdBy"],
        )
        snap = store.snapshot.model_copy(update={"calendar_events": [*store.snapshot.calendar_events, ev]})
        store.snapshot = snap
        return _json({"ok": True, "event": ev.model_dump(mode="json", by_alias=True)})

    if name == "update_calendar_event":
        eid = a["event_id"]
        found = False
        new_list: list[CalendarEvent] = []
        for e in store.snapshot.calendar_events:
            if e.id != eid:
                new_list.append(e)
                continue
            found = True
            patch = e.model_dump()
            for key in ("title", "type", "date", "time", "description", "createdBy"):
                if key in a and a[key] is not None:
                    patch[key] = a[key]
            new_list.append(CalendarEvent.model_validate(patch))
        if not found:
            return _json({"ok": False, "error": "event_not_found", "event_id": eid})
        store.snapshot = store.snapshot.model_copy(update={"calendar_events": new_list})
        return _json({"ok": True, "event_id": eid})

    if name == "delete_calendar_event":
        eid = a["event_id"]
        before = len(store.snapshot.calendar_events)
        new_list = [e for e in store.snapshot.calendar_events if e.id != eid]
        store.snapshot = store.snapshot.model_copy(update={"calendar_events": new_list})
        return _json({"ok": True, "removed": before - len(new_list) == 1})

    if name == "get_contribution_snapshot":
        approved = [t for t in g.tasks if t.approved]
        return _json(
            {
                "ok": True,
                "group": g.name,
                "members": [m.model_dump(mode="json", by_alias=True) for m in g.members],
                "approved_task_count": len(approved),
                "pending_approval_task_count": len([t for t in g.tasks if not t.approved]),
            }
        )

    if name == "list_activity_log":
        limit = int(a.get("limit", 20))
        limit = max(1, min(100, limit))
        entries = g.activityLog[:limit]
        return _json({"ok": True, "entries": [e.model_dump(mode="json", by_alias=True) for e in entries]})

    if name == "draft_peer_report":
        payload = {
            "from": a["from_student"],
            "to": a["to_student"],
            "reason": a["reason"],
            "notes": a["notes"],
        }
        return _json({"ok": True, "draft": payload, "persisted": False})

    if name == "submit_student_report":
        rid = str(int(time.time() * 1000))
        rep = StudentReport.model_validate(
            {
                "id": rid,
                "from": a["from_student"],
                "to": a["to_student"],
                "reason": a["reason"],
                "notes": a["notes"],
                "timestamp": _now_iso(),
                "reviewed": False,
            }
        )
        snap = store.snapshot.model_copy(update={"reports": [*store.snapshot.reports, rep]})
        store.snapshot = snap
        return _json({"ok": True, "report": rep.model_dump(mode="json", by_alias=True)})

    if name == "list_materials":
        return _json(
            {
                "ok": True,
                "materials": [m.model_dump(mode="json", by_alias=True) for m in store.snapshot.materials],
            }
        )

    if name == "add_material":
        mid = str(int(time.time() * 1000))
        mat = MaterialFile(
            id=mid,
            fileName=a["fileName"],
            size=int(a["size"]),
            uploadedBy=a["uploadedBy"],
            uploadTime=_now_iso(),
        )
        snap = store.snapshot.model_copy(update={"materials": [*store.snapshot.materials, mat]})
        store.snapshot = snap
        return _json({"ok": True, "material": mat.model_dump(mode="json", by_alias=True)})

    if name == "delete_material":
        mid = a["material_id"]
        snap = store.snapshot.model_copy(
            update={"materials": [m for m in store.snapshot.materials if m.id != mid]}
        )
        store.snapshot = snap
        return _json({"ok": True})

    if name == "list_verified_badges":
        badges = [b.model_dump(mode="json", by_alias=True) for b in store.snapshot.student_badges]
        return _json({"ok": True, "badges": badges})

    if name == "summarize_badge_status":
        return _json(
            {
                "ok": True,
                "badges": [b.model_dump(mode="json", by_alias=True) for b in store.snapshot.student_badges],
                "lecturer_reviews": [
                    r.model_dump(mode="json", by_alias=True) for r in store.snapshot.lecturer_student_reviews
                ],
            }
        )

    return _json({"ok": False, "error": "unknown_tool", "name": name})
