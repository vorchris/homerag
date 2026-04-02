from fastapi import APIRouter, Depends, HTTPException
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


@router.post("/collections/{name}/reembed")
def reembed_collection(name: str, db: Session = Depends(get_db)):
    """Re-embed all chunks of a collection using its locked model."""
    from app.core.ingestion.pipeline import IngestionPipeline
    col = CollectionRepo(db).get_by_name(name)
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found.")
    if not col.embedding_provider:
        raise HTTPException(status_code=400, detail="No embedding model locked. Upload a file first.")
    pipeline = IngestionPipeline()
    result = pipeline.reembed_collection(name)
    return result
