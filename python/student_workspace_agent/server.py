"""FastAPI server: POST /chat — keep OPENROUTER_API_KEY off the browser."""

from __future__ import annotations

import os
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .agent import run_agent_detailed
from .schemas import WorkspaceSnapshot
from .store import StudentWorkspaceStore

_DEFAULT_ORIGINS = (
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "https://teamfair.company",
    "https://www.teamfair.company",
    "https://teamfair.vercel.app",
)


def _cors_origins() -> list[str]:
    raw = os.environ.get("STUDENT_AGENT_CORS_ORIGINS", "").strip()
    if raw:
        return [o.strip().rstrip("/") for o in raw.split(",") if o.strip()]
    return list(_DEFAULT_ORIGINS)


app = FastAPI(title="Teamfair Student Workspace Agent", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
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
