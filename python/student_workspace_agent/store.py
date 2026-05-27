"""In-memory workspace + JSON snapshot load/save."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .schemas import (
    ActivityLogEntry,
    CalendarEvent,
    Group,
    MaterialFile,
    MemberStat,
    Task,
    WorkspaceSnapshot,
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def default_seed_snapshot() -> WorkspaceSnapshot:
    """Demo-like data aligned with TeamContext / ProjectCalendar seeds."""
    g1_members = [
        MemberStat(name="Nguyễn Văn A", role="Leader", completedTasks=0, contributionPercent=0, lecturerScore=None),
        MemberStat(name="Trần Thị B", role="Member", completedTasks=0, contributionPercent=0, lecturerScore=None),
        MemberStat(name="Lê Văn C", role="Member", completedTasks=0, contributionPercent=0, lecturerScore=None),
        MemberStat(name="Phạm Thị D", role="Member", completedTasks=0, contributionPercent=0, lecturerScore=None),
    ]
    t0 = _now_iso()
    g1_tasks = [
        Task(
            id="1",
            name="Thiết kế giao diện",
            assignedTo="Trần Thị B",
            status="Todo",
            contributionPercent=25,
            approved=False,
            deadline="2026-03-15",
        ),
        Task(
            id="2",
            name="Viết báo cáo",
            assignedTo="Lê Văn C",
            status="Todo",
            contributionPercent=20,
            approved=False,
            deadline="2026-03-20",
        ),
        Task(
            id="3",
            name="Nghiên cứu tài liệu",
            assignedTo="Phạm Thị D",
            status="In Progress",
            contributionPercent=15,
            approved=False,
            deadline="2026-03-10",
        ),
    ]
    g1 = Group(
        id="g1",
        name="Nhóm 1 - Dự án Web",
        members=g1_members,
        tasks=g1_tasks,
        activityLog=[
            ActivityLogEntry(timestamp=t0, description='Nhóm được tạo'),
            ActivityLogEntry(timestamp=t0, description='Task "Thiết kế giao diện" được giao cho Trần Thị B'),
        ],
    )
    g2 = Group(
        id="g2",
        name="Nhóm 2 - Dự án Mobile",
        members=[
            MemberStat(name="Hoàng Văn E", role="Leader", completedTasks=1, contributionPercent=30, lecturerScore=None),
            MemberStat(name="Đỗ Thị F", role="Member", completedTasks=2, contributionPercent=40, lecturerScore=None),
            MemberStat(name="Vũ Văn G", role="Member", completedTasks=0, contributionPercent=10, lecturerScore=None),
        ],
        tasks=[
            Task(
                id="g2-1",
                name="Thiết kế UI Mobile",
                assignedTo="Đỗ Thị F",
                status="Done",
                contributionPercent=30,
                approved=True,
                deadline="2026-03-12",
            ),
            Task(
                id="g2-2",
                name="Backend API",
                assignedTo="Hoàng Văn E",
                status="In Progress",
                contributionPercent=30,
                approved=False,
                deadline="2026-03-18",
            ),
        ],
        activityLog=[ActivityLogEntry(timestamp=t0, description="Nhóm được tạo")],
    )
    g3 = Group(
        id="g3",
        name="Nhóm 3 - Dự án AI",
        members=[
            MemberStat(name="Ngô Văn H", role="Leader", completedTasks=0, contributionPercent=0, lecturerScore=None),
            MemberStat(name="Bùi Thị I", role="Member", completedTasks=0, contributionPercent=0, lecturerScore=None),
        ],
        tasks=[],
        activityLog=[ActivityLogEntry(timestamp=t0, description="Nhóm được tạo")],
    )
    events = [
        CalendarEvent(
            id="demo-1",
            title="Team Meeting",
            type="Meeting",
            date="2026-03-18",
            time="19:00",
            description="Weekly progress review",
            createdBy="Leader",
        ),
        CalendarEvent(
            id="demo-2",
            title="Milestone 1 – Proposal Submission",
            type="Milestone",
            date="2026-03-25",
            time="",
            description="Submit project proposal to lecturer",
            createdBy="Leader",
        ),
        CalendarEvent(
            id="demo-3",
            title="Sprint Review",
            type="Meeting",
            date="2026-03-12",
            time="14:00",
            description="Review sprint deliverables",
            createdBy="Leader",
        ),
    ]
    materials = [
        MaterialFile(
            id="demo-1",
            fileName="ProjectGuidelines.pdf",
            size=245760,
            uploadedBy="Lecturer",
            uploadTime=_now_iso(),
        ),
        MaterialFile(
            id="demo-2",
            fileName="TeamworkRubric.docx",
            size=102400,
            uploadedBy="Lecturer",
            uploadTime=_now_iso(),
        ),
    ]
    return WorkspaceSnapshot(
        current_group_index=0,
        groups=[g1, g2, g3],
        reports=[],
        materials=materials,
        lecturer_student_reviews=[],
        student_badges=[],
        calendar_events=events,
    )


class StudentWorkspaceStore:
    """Mutable store the tool handlers update."""

    def __init__(self, snapshot: WorkspaceSnapshot | None = None):
        self.snapshot = snapshot or default_seed_snapshot()

    @classmethod
    def load_json(cls, path: Path | str) -> StudentWorkspaceStore:
        raw = Path(path).read_text(encoding="utf-8")
        data: Any = json.loads(raw)
        snap = WorkspaceSnapshot.model_validate(data)
        return cls(snap)

    def save_json(self, path: Path | str) -> None:
        Path(path).write_text(
            self.snapshot.model_dump_json(indent=2, by_alias=True),
            encoding="utf-8",
        )

    def current_group(self) -> Group:
        idx = max(0, min(self.snapshot.current_group_index, len(self.snapshot.groups) - 1))
        return self.snapshot.groups[idx]

    def set_current_group_index(self, idx: int) -> None:
        if idx < 0 or idx >= len(self.snapshot.groups):
            raise ValueError("current_group_index out of range")
        self.snapshot.current_group_index = idx

    def replace_group(self, idx: int, group: Group) -> None:
        groups = list(self.snapshot.groups)
        groups[idx] = group
        self.snapshot = self.snapshot.model_copy(update={"groups": groups})

    @staticmethod
    def recalc_contributions(group: Group) -> Group:
        approved = [t for t in group.tasks if t.approved]
        total_percent = sum(t.contributionPercent for t in approved)
        new_members: list[MemberStat] = []
        for m in group.members:
            member_approved = [t for t in approved if t.assignedTo == m.name]
            member_percent = sum(t.contributionPercent for t in member_approved)
            contrib = round((member_percent / total_percent) * 100) if total_percent > 0 else 0
            new_members.append(
                m.model_copy(
                    update={
                        "completedTasks": len(member_approved),
                        "contributionPercent": contrib,
                    }
                )
            )
        return group.model_copy(update={"members": new_members})
