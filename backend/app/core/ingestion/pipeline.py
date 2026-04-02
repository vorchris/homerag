import json
import os
import shutil
from pathlib import Path

from app.config import settings
from app.core.ingestion.chunker import Chunker
from app.core.embedding.factory import get_embedding_provider, get_provider_for
from app.core import vector_store
from app.db.repository import DocumentRepo, ChunkRepo, CollectionRepo
from app.db.session import SessionLocal
from app.db.models import Chunk

PARSERS = {
    ".pdf": "pdf",
    ".txt": "text",
    ".md":  "text",
    ".csv": "text",
}

CONFIG_PATH = Path(os.getenv("HOMERAG_CONFIG", "homerag_config.json"))


def get_parser(ext: str):
    from app.core.ingestion.parsers import pdf, text
    return {"pdf": pdf.parse, "text": text.parse}.get(ext)


def _api_key_from_config() -> str | None:
    if CONFIG_PATH.exists():
        return json.loads(CONFIG_PATH.read_text()).get("embedding", {}).get("api_key")
    return None


def _provider_name(embedder) -> str:
    name = embedder.__class__.__name__.lower()
    if "openai" in name:
        return "openai"
    return "local"


class IngestionPipeline:
    def __init__(self):
        self.chunker = Chunker()

    def _get_embedder_for(self, col_repo: CollectionRepo, collection: str):
        """Return the embedding provider locked to this collection.
        If the collection has no model locked yet, use the global config and lock it."""
        col = col_repo.get_or_create(collection)
        if col.embedding_provider:
            return get_provider_for(
                col.embedding_provider,
                col.embedding_model,
                _api_key_from_config(),
            )
        # Lock global config onto this collection
        global_embedder = get_embedding_provider()
        col_repo.set_embedding(
            collection,
            _provider_name(global_embedder),
            getattr(global_embedder, "model_name", getattr(global_embedder, "model", "")),
            global_embedder.get_dim(),
        )
        return global_embedder

    def reembed_collection(self, collection: str) -> dict:
        """Re-embed all existing chunks using the collection's locked model."""
        db = SessionLocal()
        try:
            col_repo = CollectionRepo(db)
            col = col_repo.get_by_name(collection)
            embedder = get_provider_for(col.embedding_provider, col.embedding_model, _api_key_from_config())

            # Load all chunks from DB
            doc_ids = [d.id for d in DocumentRepo(db).get_by_collection(collection)]
            chunks = db.query(Chunk).filter(Chunk.document_id.in_(doc_ids)).all()
            if not chunks:
                return {"reembedded": 0}

            texts = [c.content for c in chunks]
            vectors = embedder.embed(texts)
            dim = embedder.get_dim()

            # Recreate Qdrant collection with correct dim
            from app.core.vector_store import get_client, delete_points
            from qdrant_client.models import VectorParams, Distance, PointStruct
            import uuid as _uuid
            c = get_client()
            existing = {col_.name for col_ in c.get_collections().collections}
            if collection in existing:
                c.delete_collection(collection)
            c.create_collection(
                collection_name=collection,
                vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
            )

            # Upsert new vectors
            new_ids = [str(_uuid.uuid4()) for _ in chunks]
            points = [
                PointStruct(
                    id=new_ids[i],
                    vector=vectors[i],
                    payload={**({k: v for k, v in chunks[i].__dict__.items() if k == "content"}),
                             "text": texts[i], "collection": collection},
                )
                for i in range(len(chunks))
            ]
            c.upsert(collection_name=collection, points=points)

            # Update qdrant_ids in DB
            for chunk, new_id in zip(chunks, new_ids):
                chunk.qdrant_id = new_id
            db.commit()

            # Update collection dim
            col_repo.set_embedding(collection, col.embedding_provider, col.embedding_model, dim)

        finally:
            db.close()

        return {"reembedded": len(chunks)}

    def ingest_file(self, tmp_path: str, filename: str, collection: str) -> dict:
        ext = os.path.splitext(filename)[1].lower()
        source_type = PARSERS.get(ext, "text")
        parser = get_parser(source_type)

        text = parser(tmp_path)
        if not text.strip():
            raise ValueError("No text extracted")

        dest = os.path.join(settings.storage_path, collection, filename)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copy(tmp_path, dest)

        chunks = self.chunker.chunk(text)

        db = SessionLocal()
        try:
            embedder = self._get_embedder_for(CollectionRepo(db), collection)
            vectors = embedder.embed([c.content for c in chunks])

            vector_store.ensure_collection(collection, embedder.get_dim())
            payloads = [{"filename": filename, "chunk_index": c.index, "collection": collection} for c in chunks]
            qdrant_ids = vector_store.upsert(collection, [c.content for c in chunks], vectors, payloads)

            doc = DocumentRepo(db).create(
                collection_id=collection,
                filename=filename,
                source_type=source_type,
                storage_path=dest,
                chunk_count=len(chunks),
            )
            for i, (chunk, qid) in enumerate(zip(chunks, qdrant_ids)):
                ChunkRepo(db).create(
                    document_id=doc.id,
                    qdrant_id=qid,
                    chunk_index=i,
                    content=chunk.content,
                    token_count=chunk.token_count,
                )
        finally:
            db.close()

        return {"document_id": doc.id, "chunks": len(chunks)}

    def ingest_url(self, url: str, collection: str) -> dict:
        from app.core.ingestion.parsers.web import parse
        text = parse(url)
        if not text.strip():
            raise ValueError("No text extracted from URL")

        chunks = self.chunker.chunk(text)

        db = SessionLocal()
        try:
            embedder = self._get_embedder_for(CollectionRepo(db), collection)
            vectors = embedder.embed([c.content for c in chunks])

            vector_store.ensure_collection(collection, embedder.get_dim())
            payloads = [{"url": url, "chunk_index": c.index, "collection": collection} for c in chunks]
            qdrant_ids = vector_store.upsert(collection, [c.content for c in chunks], vectors, payloads)

            doc = DocumentRepo(db).create(
                collection_id=collection,
                filename=url,
                source_type="url",
                storage_path=url,
                chunk_count=len(chunks),
            )
            for i, (chunk, qid) in enumerate(zip(chunks, qdrant_ids)):
                ChunkRepo(db).create(
                    document_id=doc.id,
                    qdrant_id=qid,
                    chunk_index=i,
                    content=chunk.content,
                    token_count=chunk.token_count,
                )
        finally:
            db.close()

        return {"document_id": doc.id, "chunks": len(chunks)}
