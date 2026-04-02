import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.repository import CollectionRepo

router = APIRouter()

PROVIDER_DEFAULTS = {
    "local": "all-MiniLM-L6-v2",
    "openai": "text-embedding-3-small",
}


class CreateCollectionRequest(BaseModel):
    name: str
    description: str = ""
    embedding_provider: str = "local"
    embedding_model: str = ""


@router.get("/collections")
def list_collections(db: Session = Depends(get_db)):
    return CollectionRepo(db).get_all()


@router.post("/collections")
def create_collection(req: CreateCollectionRequest, db: Session = Depends(get_db)):
    repo = CollectionRepo(db)
    if repo.get_by_name(req.name):
        raise HTTPException(status_code=400, detail="Collection already exists.")
    model = req.embedding_model or PROVIDER_DEFAULTS.get(req.embedding_provider, "all-MiniLM-L6-v2")
    col = repo.create(name=req.name, description=req.description)
    # Pre-set the embedding so it's locked from the start
    repo.set_embedding(req.name, req.embedding_provider, model, dim=None)
    return col


class ReembedRequest(BaseModel):
    embedding_provider: str | None = None
    embedding_model: str | None = None


@router.post("/collections/{name}/reembed")
def reembed_collection(name: str, req: ReembedRequest = ReembedRequest(), db: Session = Depends(get_db)):
    """Stream re-embed progress as SSE."""
    from app.core.ingestion.pipeline import IngestionPipeline
    repo = CollectionRepo(db)
    col = repo.get_by_name(name)
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found.")

    if req.embedding_provider or req.embedding_model:
        provider = req.embedding_provider or col.embedding_provider or "local"
        model = req.embedding_model or col.embedding_model or PROVIDER_DEFAULTS.get(provider, "")
        repo.set_embedding(name, provider, model, dim=None)
        db.refresh(col)

    if not (col.embedding_provider or req.embedding_provider):
        raise HTTPException(status_code=400, detail="No embedding model set. Upload a file first.")

    pipeline = IngestionPipeline()

    def event_stream():
        for progress in pipeline.reembed_collection_stream(name):
            yield f"data: {json.dumps(progress)}\n\n"
        yield "data: {\"done\": true}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
