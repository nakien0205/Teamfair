"""JWT authentication middleware for Supabase tokens."""

from __future__ import annotations

import os

from fastapi import Depends, HTTPException, Request
from jose import JWTError, jwt

_TESTING = os.environ.get("TESTING", "").lower() in ("1", "true", "yes")

SUPABASE_JWT_SECRET: str | None = os.environ.get("SUPABASE_JWT_SECRET")
if not SUPABASE_JWT_SECRET and not _TESTING:
    raise RuntimeError(
        "SUPABASE_JWT_SECRET environment variable is required. "
        "Set it to your Supabase project's JWT secret."
    )

_ALGORITHM = "HS256"


async def get_authenticated_user(request: Request) -> dict:
    """Extract and validate the Supabase JWT from the Authorization header.

    Returns the decoded payload on success.
    Raises HTTPException 401 on any auth failure — no internals leaked.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")

    token = auth_header[7:]  # strip "Bearer "

    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=[_ALGORITHM],
            options={"require_exp": True},
        )
    except JWTError:
        raise HTTPException(status_code=401, detail="Authentication required")

    return payload


require_auth = Depends(get_authenticated_user)
