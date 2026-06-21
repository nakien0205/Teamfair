"""FastAPI server: POST /chat, POST /analyze-contribution — keep OPENROUTER_API_KEY off the browser."""

from __future__ import annotations

import ipaddress
import os
import socket
import time
import uuid
from typing import Any
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException

from .auth import require_auth
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import logging
import httpx
from .agent import run_agent_detailed
from .guardrails import validate_input, validate_output, validate_workspace_strings
from .contribution_analyzer import AnalysisResult, analyze_contribution, verify_task_submission
from .document_parser import extract_text_from_bytes
from .schemas import WorkspaceSnapshot
from .store import StudentWorkspaceStore

logger = logging.getLogger("student_workspace_agent")

_DEFAULT_ORIGINS = (
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "https://teamfair.company",
    "https://www.teamfair.company",
    "https://teamfair.vercel.app",
)
_DEFAULT_ORIGIN_REGEX = r"^https://teamfair(?:-git-[a-z0-9-]+)?-nakien0205\.vercel\.app$"


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
    allow_headers=["Content-Type", "Authorization"],
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
def chat(body: ChatRequest, user: dict = require_auth) -> dict[str, Any]:
    # 1. Run Input Guardrails
    input_res = validate_input(body.message.strip())
    if not input_res["safe"]:
        return {
            "answer": "Tôi không thể hoàn thành yêu cầu này do phát hiện dữ liệu đầu vào không hợp lệ hoặc chứa nội dung không an toàn.",
            "tool_trace": [],
            "reasoning": f"Blocked by guardrails: {input_res['reason']}",
            "used_heavy_synthesis": False,
            "workspace": None,
        }

    # Run Workspace Input Guardrails
    workspace_res = validate_workspace_strings(body.workspace)
    if not workspace_res["safe"]:
        return {
            "answer": "Tôi không thể hoàn thành yêu cầu này do phát hiện dữ liệu đầu vào không hợp lệ hoặc chứa nội dung không an toàn.",
            "tool_trace": [],
            "reasoning": f"Blocked by guardrails (workspace): {workspace_res['reason']}",
            "used_heavy_synthesis": False,
            "workspace": None,
        }

    try:
        snapshot = WorkspaceSnapshot.model_validate(body.workspace)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid workspace snapshot: {e}") from e

    store = StudentWorkspaceStore(snapshot)
    
    # 2. Generate security canary token
    canary_token = str(uuid.uuid4())
    
    try:
        result = run_agent_detailed(
            input_res["sanitized_input"],
            store=store,
            use_heavy=body.use_heavy,
            max_tool_rounds=body.max_tool_rounds,
            canary_token=canary_token,
        )
    except RuntimeError as e:
        logger.exception("Service unavailable error during chat execution")
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        logger.exception("Agent error during chat execution")
        raise HTTPException(status_code=500, detail="An internal error occurred during agent execution.") from e

    # 3. Run Output Guardrails
    output_res = validate_output(result.answer, canary_token=canary_token)
    if not output_res["safe"]:
        result.answer = output_res["validated_response"]
        result.reasoning = (result.reasoning or "") + "\n[SECURITY WARNING: Response blocked due to canary leakage or policy violation.]"

    return result.to_json_dict()


# ---------------------------------------------------------------------------
# POST /analyze-contribution — AI contribution analysis
# ---------------------------------------------------------------------------

_RATE_LIMIT_WINDOW_SECS = 30.0
_rate_limit_store: dict[str, float] = {}


def _check_rate_limit(user_id: str) -> None:
    """Enforce max 1 request per user_id per 30 seconds."""
    now = time.monotonic()
    last = _rate_limit_store.get(user_id)
    if last is not None and (now - last) < _RATE_LIMIT_WINDOW_SECS:
        remaining = _RATE_LIMIT_WINDOW_SECS - (now - last)
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit: please wait {remaining:.0f}s before requesting again.",
        )
    _rate_limit_store[user_id] = now

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
def analyze_contribution_endpoint(body: ContributionAnalysisRequest, user: dict = require_auth) -> dict[str, Any]:
    _check_rate_limit(user.get("sub", ""))

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
        logger.exception("Error during contribution analysis")
        raise HTTPException(status_code=500, detail="An internal error occurred during contribution analysis.") from e

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


# ---------------------------------------------------------------------------
# SSRF protection for signed-URL fetching
# ---------------------------------------------------------------------------

_SIGNED_URL_ALLOWED_SUFFIXES: list[str] = [
    s.strip()
    for s in os.environ.get(
        "SIGNED_URL_ALLOWED_HOSTS", ".supabase.co,.supabase.in"
    ).split(",")
    if s.strip()
]


def _validate_signed_url(url: str) -> str:
    """Validate URL against SSRF and return a safe URL using a verified IP.

    Resolves DNS once, validates the IP is not private/loopback/reserved,
    and rewrites the URL to use the verified IP directly. This eliminates
    TOCTOU DNS rebinding attacks where a second resolution could return
    a different (malicious) IP.
    """
    parsed = urlparse(url)

    # 1. Scheme must be HTTPS
    if parsed.scheme != "https":
        raise HTTPException(status_code=400, detail="Invalid or disallowed URL")

    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(status_code=400, detail="Invalid or disallowed URL")

    # 2. Host allowlist
    if not any(hostname.endswith(suffix) for suffix in _SIGNED_URL_ALLOWED_SUFFIXES):
        raise HTTPException(status_code=400, detail="Invalid or disallowed URL")

    # 3. DNS resolution — reject private / loopback / link-local / reserved IPs
    try:
        addrinfos = socket.getaddrinfo(hostname, 443, proto=socket.IPPROTO_TCP)
    except socket.gaierror:
        raise HTTPException(status_code=400, detail="Invalid or disallowed URL")

    if not addrinfos:
        raise HTTPException(status_code=400, detail="Invalid or disallowed URL")

    verified_ip: str | None = None
    for family, _type, _proto, _canonname, sockaddr in addrinfos:
        ip = ipaddress.ip_address(sockaddr[0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            raise HTTPException(status_code=400, detail="Invalid or disallowed URL")
        if verified_ip is None:
            verified_ip = sockaddr[0]

    # 4. Rewrite URL to use verified IP, preserving path/query
    port = parsed.port or 443
    safe_url = parsed._replace(netloc=f"{verified_ip}:{port}").geturl()
    return safe_url


@app.post("/verify-task")
def verify_task_endpoint(body: VerifyTaskRequest, user: dict = require_auth) -> dict[str, Any]:
    _check_rate_limit(user.get("sub", ""))

    # Download and extract text from evidence files
    evidence_payload = []
    for ev in body.evidence_files:
        content = ""
        safe_url = _validate_signed_url(ev.signedUrl)
        # Parse original hostname for Host header (required by TLS/SNI)
        original_hostname = urlparse(ev.signedUrl).hostname
        try:
            r = httpx.get(
                safe_url,
                timeout=10.0,
                headers={"Host": original_hostname} if original_hostname else {},
                verify=True,
            )
            if r.status_code == 200:
                content = extract_text_from_bytes(r.content, ev.fileName)
            else:
                content = f"[Lỗi: Không tải được file, HTTP {r.status_code}]"
        except HTTPException:
            raise
        except Exception as err:
            logger.exception("Evidence file download failed for %s", ev.fileName)
            content = "[Lỗi: Không thể tải file minh chứng]"

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
        logger.exception("Error during task verification")
        raise HTTPException(status_code=500, detail="An internal error occurred during task verification.") from e
