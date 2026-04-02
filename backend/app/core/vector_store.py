from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, PointIdsList
from app.config import settings
import uuid

client: QdrantClient | None = None

def get_client() -> QdrantClient:
    global client
    if client is None:
        client = QdrantClient(host=settings.qdrant_host, port=settings.qdrant_port)
    return client

def ensure_collection(name: str, dim: int):
    c = get_client()
    existing = {col.name for col in c.get_collections().collections}
    if name not in existing:
        c.create_collection(
            collection_name=name,
            vectors_config=VectorParams(size=dim, distance=Distance.COSINE)
        )
        return
    # Check dimension matches
    info = c.get_collection(name)
    existing_dim = info.config.params.vectors.size
    if existing_dim != dim:
        raise ValueError(
            f"Collection '{name}' has dimension {existing_dim} but current embedding model "
            f"produces {dim} dimensions. Delete the collection and re-ingest all documents."
        )

def upsert(collection: str, texts: list[str], vectors: list[list[float]], payloads: list[dict]) -> list[str]:
    c = get_client()
    ids = [str(uuid.uuid4()) for _ in texts]
    points = [
        PointStruct(id=ids[i], vector=vectors[i], payload={**payloads[i], "text": texts[i]})
        for i in range(len(texts))
    ]
    c.upsert(collection_name=collection, points=points)
    return ids

def get_collection_dim(collection: str) -> int | None:
    try:
        info = get_client().get_collection(collection)
        return info.config.params.vectors.size
    except Exception:
        return None

def delete_points(collection: str, ids: list[str]):
    c = get_client()
    c.delete(collection_name=collection, points_selector=PointIdsList(points=ids))

def search(collection: str, vector: list[float], top_k: int = 5) -> list[dict]:
    c = get_client()
    results = c.query_points(collection_name=collection, query=vector, limit=top_k).points
    return [{"id": r.id, "score": r.score, "text": r.payload.get("text", ""), "payload": r.payload} for r in results]