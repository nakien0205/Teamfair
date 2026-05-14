"""Pydantic shapes aligned with src/context/TeamContext.tsx and ProjectCalendar.tsx."""

from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


TaskStatus = Literal["Todo", "In Progress", "Done"]
TaskPriority = Literal["Low", "Medium", "High"]
StudentRole = Literal["Leader", "Member"]
EventType = Literal["Meeting", "Task Deadline", "Milestone"]


class EvidenceItem(BaseModel):
    fileName: str
    uploadTime: str = Field(description="ISO 8601 datetime")


class Task(BaseModel):
    id: str
    name: str
    assignedTo: str
    status: TaskStatus
    contributionPercent: int = Field(ge=0, le=100)
    approved: bool
    deadline: str = Field(description="YYYY-MM-DD")
    description: str | None = None
    priority: TaskPriority | None = None
    evidence: list[EvidenceItem] | None = None


class MemberStat(BaseModel):
    name: str
    role: str
    completedTasks: int = 0
    contributionPercent: int = 0
    lecturerScore: float | None = None


class ActivityLogEntry(BaseModel):
    timestamp: str = Field(description="ISO 8601 datetime")
    description: str


class Group(BaseModel):
    id: str
    name: str
    members: list[MemberStat]
    tasks: list[Task]
    activityLog: list[ActivityLogEntry]


class StudentReport(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    from_: str = Field(alias="from")
    to: str
    reason: str
    notes: str
    timestamp: str
    reviewed: bool


class MaterialFile(BaseModel):
    id: str
    fileName: str
    size: int
    uploadedBy: str
    uploadTime: str


class LecturerStudentReview(BaseModel):
    id: str
    lecturer: Literal["lecturer"] = "lecturer"
    studentName: str
    rating: int
    comment: str
    awardBadge: bool
    timestamp: str


class VerifiedBadge(BaseModel):
    id: str
    studentName: str
    rating: int
    comment: str
    awardedAt: str
    link: str


class CalendarEvent(BaseModel):
    id: str
    title: str
    type: EventType
    date: str = Field(description="YYYY-MM-DD")
    time: str = Field(description="HH:MM or empty string")
    description: str
    createdBy: StudentRole


class WorkspaceSnapshot(BaseModel):
    """Serializable workspace mirror (optional JSON file)."""

    current_group_index: int = 0
    groups: list[Group]
    reports: list[StudentReport] = Field(default_factory=list)
    materials: list[MaterialFile] = Field(default_factory=list)
    lecturer_student_reviews: list[LecturerStudentReview] = Field(default_factory=list)
    student_badges: list[VerifiedBadge] = Field(default_factory=list)
    calendar_events: list[CalendarEvent] = Field(default_factory=list)
