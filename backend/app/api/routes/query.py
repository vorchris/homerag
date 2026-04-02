from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from app.core.embedding.factory import get_embedding_provider, get_provider_for
from app.core import vector_store
from app.db.session import get_db
from app.db.repository import CollectionRepo
from sqlalchemy.orm import Session

import hmac
import json
from pathlib import Path
import os

router = APIRouter()
bearer = HTTPBearer(auto_error=False)

CONFIG_PATH = Path(os.getenv("HOMERAG_CONFIG", "homerag_config.json"))
SESSION_COOKIE = "homerag_session"


def verify_auth(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
):
    if not CONFIG_PATH.exists():
        raise HTTPException(status_code=503, detail="Not configured.")
    cfg = json.loads(CONFIG_PATH.read_text())

    # Accept Bearer token (extension)
    if credentials:
        if hmac.compare_digest(credentials.credentials, cfg.get("api_token", "")):
            return
        raise HTTPException(status_code=401, detail="Invalid token.")

    # Accept session cookie (frontend)
    session = request.cookies.get(SESSION_COOKIE, "")
    if session and hmac.compare_digest(session, cfg.get("session_secret", "")):
        return

    raise HTTPException(status_code=401, detail="Not authenticated.")


class QueryRequest(BaseModel):
    query: str
    collection: str = "default"
    top_k: int = 5


@router.post("/query", dependencies=[Depends(verify_auth)])
async def query(req: QueryRequest, db: Session = Depends(get_db)):
    cfg = json.loads(CONFIG_PATH.read_text()) if CONFIG_PATH.exists() else {}
    api_key = cfg.get("embedding", {}).get("api_key")

    col = CollectionRepo(db).get_by_name(req.collection)
    if col and col.embedding_provider:
        embedder = get_provider_for(col.embedding_provider, col.embedding_model, api_key)
    else:
        embedder = get_embedding_provider()

    # Detect dim mismatch against actual Qdrant collection before querying
    qdrant_dim = vector_store.get_collection_dim(req.collection)
    if qdrant_dim is not None and embedder.get_dim() != qdrant_dim:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Dimension mismatch: collection '{req.collection}' has {qdrant_dim}-dim vectors "
                f"but the current model produces {embedder.get_dim()} dims. "
                f"Go to Collections and click 're-embed' to fix this."
            ),
        )

    vector = embedder.embed([req.query])[0]
    results = vector_store.search(req.collection, vector, req.top_k)
    context = "\n---\n".join(r["text"] for r in results)
    return {
        "query": req.query,
        "context": context,
        "chunks": results,
    }