from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
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
    existing = [col.name for col in c.get_collections().collections]
    if name not in existing:
        c.create_collection(
            collection_name=name,
            vectors_config=VectorParams(size=dim, distance=Distance.COSINE)
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

def search(collection: str, vector: list[float], top_k: int = 5) -> list[dict]:
    c = get_client()
    results = c.query_points(collection_name=collection, query=vector, limit=top_k).points
    return [{"id": r.id, "score": r.score, "text": r.payload.get("text", ""), "payload": r.payload} for r in results]