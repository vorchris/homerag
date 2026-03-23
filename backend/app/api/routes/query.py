from fastapi import APIRouter
from pydantic import BaseModel
from app.core.embedding.factory import get_embedding_provider
from app.core import vector_store

router = APIRouter()

class QueryRequest(BaseModel):
    query: str
    collection: str = "default"
    top_k: int = 5

@router.post("/query")
async def query(req: QueryRequest):
    embedder = get_embedding_provider()
    vector = embedder.embed([req.query])[0]
    results = vector_store.search(req.collection, vector, req.top_k)
    context = "\n---\n".join(r["text"] for r in results)
    return {
        "query": req.query,
        "context": context,
        "chunks": results
    }