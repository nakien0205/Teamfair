"""FastAPI server: POST /chat, POST /analyze-contribution — keep OPENROUTER_API_KEY off the browser."""

from __future__ import annotations

import os
import time
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import httpx
from .agent import run_agent_detailed
from .contribution_analyzer import AnalysisResult, analyze_contribution, verify_task_submission
from .document_parser import extract_text_from_bytes
from .schemas import WorkspaceSnapshot
from .store import StudentWorkspaceStore

_DEFAULT_ORIGINS = (
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "https://teamfair.company",
    "https://www.teamfair.company",
    "https://teamfair.vercel.app",
)
_DEFAULT_ORIGIN_REGEX = r"^https://teamfair(?:-[a-z0-9-]+)*\.vercel\.app$"


def _cors_origins() -> list[str]:
    raw = os.environ.get("STUDENT_AGENT_CORS_ORIGINS", "").strip()
    if raw:
        return [o.strip().rstrip("/") for o in raw.split(",") if o.strip()]
    return list(_DEFAULT_ORIGINS)


def _cors_origin_regex() -> str | None:
    raw = os.environ.get("STUDENT_AGENT_CORS_ORIGIN_REGEX")
    if raw is not None:
        normalized = raw.strip()
        return normalized or None
    return _DEFAULT_ORIGIN_REGEX


app = FastAPI(title="Teamfair Student Workspace Agent", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_origin_regex=_cors_origin_regex(),
    allow_credentials=False,
    allow_methods=["POST", "OPTIONS", "GET"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=16000)
    workspace: dict[str, Any]
    use_heavy: bool = False
    max_tool_rounds: int = Field(default=12, ge=1, le=24)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/chat")
def chat(body: ChatRequest) -> dict[str, Any]:
    try:
        snapshot = WorkspaceSnapshot.model_validate(body.workspace)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid workspace snapshot: {e}") from e

    store = StudentWorkspaceStore(snapshot)
    try:
        result = run_agent_detailed(
            body.message.strip(),
            store=store,
            use_heavy=body.use_heavy,
            max_tool_rounds=body.max_tool_rounds,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent error: {e}") from e

    return result.to_json_dict()


# ---------------------------------------------------------------------------
# POST /analyze-contribution — AI contribution analysis
# ---------------------------------------------------------------------------

_RATE_LIMIT_WINDOW_SECS = 30.0
_rate_limit_store: dict[str, float] = {}


def _check_rate_limit(student_name: str) -> None:
    """Enforce max 1 request per student_name per 30 seconds."""
    now = time.monotonic()
    last = _rate_limit_store.get(student_name)
    if last is not None and (now - last) < _RATE_LIMIT_WINDOW_SECS:
        remaining = _RATE_LIMIT_WINDOW_SECS - (now - last)
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit: please wait {remaining:.0f}s before requesting again for this student.",
        )
    _rate_limit_store[student_name] = now

    # Evict stale entries to prevent memory growth
    stale_keys = [k for k, v in _rate_limit_store.items() if (now - v) > _RATE_LIMIT_WINDOW_SECS * 2]
    for k in stale_keys:
        del _rate_limit_store[k]


class TaskItem(BaseModel):
    name: str = ""
    status: str = ""
    deadline: str = ""
    description: str = ""
    evidence_count: int = 0
    approved: bool = False


class WorkLogItem(BaseModel):
    date: str = ""
    hours: float = 0
    description: str = ""


class LeaderReviewItem(BaseModel):
    rating: float = 0
    comment: str = ""


class ContributionAnalysisRequest(BaseModel):
    student_name: str = Field(min_length=1, max_length=200)
    group_name: str = Field(min_length=1, max_length=200)
    deterministic_score: int = Field(ge=0, le=100)
    tasks: list[TaskItem] = Field(default_factory=list)
    work_logs: list[WorkLogItem] = Field(default_factory=list)
    leader_reviews: list[LeaderReviewItem] = Field(default_factory=list)
    peer_review_average: float | None = None


@app.post("/analyze-contribution")
def analyze_contribution_endpoint(body: ContributionAnalysisRequest) -> dict[str, Any]:
    _check_rate_limit(body.student_name)

    payload = {
        "student_name": body.student_name,
        "group_name": body.group_name,
        "deterministic_score": body.deterministic_score,
        "tasks": [t.model_dump() for t in body.tasks],
        "work_logs": [w.model_dump() for w in body.work_logs],
        "leader_reviews": [r.model_dump() for r in body.leader_reviews],
        "peer_review_average": body.peer_review_average,
    }

    try:
        result: AnalysisResult = analyze_contribution(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {e}") from e

    return result.to_dict()


class EvidenceFileItem(BaseModel):
    fileName: str
    signedUrl: str


class VerifyTaskRequest(BaseModel):
    task_id: str
    task_name: str
    task_description: str = ""
    student_name: str
    work_logs: list[WorkLogItem] = Field(default_factory=list)
    evidence_files: list[EvidenceFileItem] = Field(default_factory=list)


@app.post("/verify-task")
def verify_task_endpoint(body: VerifyTaskRequest) -> dict[str, Any]:
    # Download and extract text from evidence files
    evidence_payload = []
    for ev in body.evidence_files:
        content = ""
        try:
            r = httpx.get(ev.signedUrl, timeout=10.0)
            if r.status_code == 200:
                content = extract_text_from_bytes(r.content, ev.fileName)
            else:
                content = f"[Lỗi: Không tải được file, HTTP {r.status_code}]"
        except Exception as err:
            content = f"[Lỗi tải file: {err}]"

        evidence_payload.append({
            "file_name": ev.fileName,
            "content": content
        })

    payload = {
        "task_name": body.task_name,
        "task_description": body.task_description,
        "student_name": body.student_name,
        "work_logs": [{"date": w.date, "hours": w.hours, "description": w.description} for w in body.work_logs],
        "evidence_files": evidence_payload,
    }

    try:
        res = verify_task_submission(payload)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Verification error: {e}") from e
