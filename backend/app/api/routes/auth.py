"""
app/api/routes/auth.py

Web UI:
  POST /api/auth/login   – username + password → sets session cookie
  POST /api/auth/logout  – clears session cookie
  GET  /api/auth/me      – returns current user (requires session cookie)

External API:
  POST /api/auth/verify  – Bearer token → 200 ok / 401  (for API clients)

Setup:
  GET  /api/setup/status – {"configured": bool}
  POST /api/setup        – first-time setup
"""

import json
import os
import hashlib
import hmac
import secrets
from pathlib import Path

from fastapi import APIRouter, HTTPException, Response, Request
from pydantic import BaseModel

router = APIRouter()

CONFIG_PATH = Path(os.getenv("HOMERAG_CONFIG", "homerag_config.json"))
SESSION_COOKIE = "homerag_session"


def _load() -> dict:
    if CONFIG_PATH.exists():
        return json.loads(CONFIG_PATH.read_text())
    return {}


def _save(data: dict):
    CONFIG_PATH.write_text(json.dumps(data, indent=2))


def _hash_password(password: str, salt: str) -> str:
    return hmac.new(salt.encode(), password.encode(), hashlib.sha256).hexdigest()


def _check_session(request: Request) -> bool:
    cfg = _load()
    session = request.cookies.get(SESSION_COOKIE, "")
    return hmac.compare_digest(session, cfg.get("session_secret", ""))


# ── Schemas ───────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenRequest(BaseModel):
    token: str


class SetupRequest(BaseModel):
    username: str
    password: str
    embedding_provider: str = "local"
    embedding_model: str = "all-MiniLM-L6-v2"
    embedding_api_key: str | None = None
    chunk_size: int = 512
    chunk_overlap: int = 64
    api_token: str


# ── Setup ─────────────────────────────────────────────────────────────────────

@router.get("/setup/status")
def setup_status():
    cfg = _load()
    return {"configured": bool(cfg.get("configured"))}


@router.post("/setup")
def setup(req: SetupRequest):
    cfg = _load()
    if cfg.get("configured"):
        raise HTTPException(400, "Already configured. Use settings to change.")
    if len(req.password) < 8:
        raise HTTPException(422, "Password must be at least 8 characters.")

    salt = secrets.token_hex(16)
    _save({
        "configured": True,
        "admin": {
            "username": req.username.strip(),
            "salt": salt,
            "password_hash": _hash_password(req.password, salt),
        },
        "api_token": req.api_token,
        "session_secret": secrets.token_hex(32),
        "embedding": {
            "provider": req.embedding_provider,
            "model": req.embedding_model,
            "api_key": req.embedding_api_key,
        },
        "chunking": {
            "chunk_size": req.chunk_size,
            "chunk_overlap": req.chunk_overlap,
        },
    })
    return {"ok": True}


# ── Web UI Auth ───────────────────────────────────────────────────────────────

@router.post("/auth/login")
def login(req: LoginRequest, response: Response):
    cfg = _load()
    if not cfg.get("configured"):
        raise HTTPException(400, "Not configured yet.")

    admin = cfg["admin"]
    expected = _hash_password(req.password, admin["salt"])
    if req.username.strip() != admin["username"] or \
       not hmac.compare_digest(expected, admin["password_hash"]):
        raise HTTPException(401, "Invalid credentials.")

    response.set_cookie(
        SESSION_COOKIE,
        cfg["session_secret"],
        httponly=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,  # 7 days
    )
    return {"ok": True}


@router.post("/auth/logout")
def logout(response: Response):
    response.delete_cookie(SESSION_COOKIE)
    return {"ok": True}


@router.get("/auth/me")
def me(request: Request):
    if not _check_session(request):
        raise HTTPException(401, "Not authenticated.")
    cfg = _load()
    return {"username": cfg["admin"]["username"]}


# ── External API Token Auth ───────────────────────────────────────────────────

@router.post("/auth/verify")
def verify_token(req: TokenRequest):
    """For API clients — verify Bearer token."""
    cfg = _load()
    if not cfg.get("configured"):
        raise HTTPException(400, "Not configured yet.")
    if not hmac.compare_digest(req.token.strip(), cfg.get("api_token", "")):
        raise HTTPException(401, "Invalid token.")
    return {"ok": True}