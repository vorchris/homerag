import os
import shutil
from app.config import settings
from app.core.ingestion.chunker import Chunker
from app.core.embedding.factory import get_embedding_provider
from app.core import vector_store
from app.db.repository import DocumentRepo, ChunkRepo
from app.db.session import SessionLocal

PARSERS = {
    ".pdf": "pdf",
    ".txt": "text",
    ".md":  "text",
    ".csv": "text",
}

def get_parser(ext: str):
    from app.core.ingestion.parsers import pdf, text
    return {"pdf": pdf.parse, "text": text.parse}.get(ext)

class IngestionPipeline:
    def __init__(self):
        self.chunker = Chunker()
        self.embedder = get_embedding_provider()

    def ingest_file(self, tmp_path: str, filename: str, collection: str) -> dict:
        ext = os.path.splitext(filename)[1].lower()
        source_type = PARSERS.get(ext, "text")
        parser = get_parser(source_type)

        # Extract text
        text = parser(tmp_path)
        if not text.strip():
            raise ValueError("No text extracted")

        # Save
        dest = os.path.join(settings.storage_path, collection, filename)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copy(tmp_path, dest)

        # Chunk + Embed
        chunks = self.chunker.chunk(text)
        vectors = self.embedder.embed([c.content for c in chunks])

        # Qdrant
        vector_store.ensure_collection(collection, self.embedder.get_dim())
        payloads = [{"filename": filename, "chunk_index": c.index, "collection": collection} for c in chunks]
        qdrant_ids = vector_store.upsert(collection, [c.content for c in chunks], vectors, payloads)

        # DB
        db = SessionLocal()
        try:
            doc_repo = DocumentRepo(db)
            chunk_repo = ChunkRepo(db)

            doc = doc_repo.create(
                collection_id=collection,
                filename=filename,
                source_type=source_type,
                storage_path=dest,
                chunk_count=len(chunks)
            )
            for i, (chunk, qid) in enumerate(zip(chunks, qdrant_ids)):
                chunk_repo.create(
                    document_id=doc.id,
                    qdrant_id=qid,
                    chunk_index=i,
                    content=chunk.content,
                    token_count=chunk.token_count
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
        vectors = self.embedder.embed([c.content for c in chunks])

        vector_store.ensure_collection(collection, self.embedder.get_dim())
        payloads = [{"url": url, "chunk_index": c.index, "collection": collection} for c in chunks]
        qdrant_ids = vector_store.upsert(collection, [c.content for c in chunks], vectors, payloads)

        db = SessionLocal()
        try:
            doc_repo = DocumentRepo(db)
            chunk_repo = ChunkRepo(db)
            doc = doc_repo.create(
                collection_id=collection,
                filename=url,
                source_type="url",
                storage_path=url,
                chunk_count=len(chunks)
            )
            for i, (chunk, qid) in enumerate(zip(chunks, qdrant_ids)):
                chunk_repo.create(
                    document_id=doc.id,
                    qdrant_id=qid,
                    chunk_index=i,
                    content=chunk.content,
                    token_count=chunk.token_count
                )
        finally:
            db.close()

        return {"document_id": doc.id, "chunks": len(chunks)}