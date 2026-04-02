import json
import os
from pathlib import Path
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from app.core.embedding.factory import reset_embedding_provider
import hmac

router = APIRouter()

CONFIG_PATH = Path(os.getenv("HOMERAG_CONFIG", "homerag_config.json"))
SESSION_COOKIE = "homerag_session"
bearer = HTTPBearer(auto_error=False)


def _load() -> dict:
    if CONFIG_PATH.exists():
        return json.loads(CONFIG_PATH.read_text())
    return {}


def _save(data: dict):
    CONFIG_PATH.write_text(json.dumps(data, indent=2))


def require_auth(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
):
    cfg = _load()
    if credentials:
        if hmac.compare_digest(credentials.credentials, cfg.get("api_token", "")):
            return
        raise HTTPException(status_code=401, detail="Invalid token.")
    session = request.cookies.get(SESSION_COOKIE, "")
    if session and hmac.compare_digest(session, cfg.get("session_secret", "")):
        return
    raise HTTPException(status_code=401, detail="Not authenticated.")


class ConfigUpdate(BaseModel):
    embedding_provider: str | None = None
    embedding_model: str | None = None
    embedding_api_key: str | None = None
    chunk_size: int | None = None
    chunk_overlap: int | None = None
    api_token: str | None = None


@router.get("/config", dependencies=[Depends(require_auth)])
def get_config():
    cfg = _load()
    return {
        "embedding_provider": cfg.get("embedding", {}).get("provider", "local"),
        "embedding_model": cfg.get("embedding", {}).get("model", "all-MiniLM-L6-v2"),
        "embedding_api_key": cfg.get("embedding", {}).get("api_key") or "",
        "chunk_size": cfg.get("chunking", {}).get("chunk_size", 512),
        "chunk_overlap": cfg.get("chunking", {}).get("chunk_overlap", 64),
        "api_token": cfg.get("api_token", ""),
    }


@router.put("/config", dependencies=[Depends(require_auth)])
def update_config(body: ConfigUpdate):
    cfg = _load()
    if not cfg:
        raise HTTPException(status_code=503, detail="Not configured.")

    if body.embedding_provider is not None:
        cfg.setdefault("embedding", {})["provider"] = body.embedding_provider
    if body.embedding_model is not None:
        cfg.setdefault("embedding", {})["model"] = body.embedding_model
    if body.embedding_api_key is not None:
        cfg.setdefault("embedding", {})["api_key"] = body.embedding_api_key
    if body.chunk_size is not None:
        cfg.setdefault("chunking", {})["chunk_size"] = body.chunk_size
    if body.chunk_overlap is not None:
        cfg.setdefault("chunking", {})["chunk_overlap"] = body.chunk_overlap
    if body.api_token is not None:
        cfg["api_token"] = body.api_token

    _save(cfg)
    reset_embedding_provider()
    return {"ok": True}
