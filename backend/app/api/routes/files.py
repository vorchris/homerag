import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.repository import DocumentRepo
from app.db.models import Document, Chunk
from app.core import vector_store

router = APIRouter()

@router.get("/files")
def list_files(collection: str = "default", db: Session = Depends(get_db)):
    return DocumentRepo(db).get_by_collection(collection)

@router.delete("/files/{id}")
def delete_file(id: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter_by(id=id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")

    # 1. Qdrant-Points löschen
    chunks = db.query(Chunk).filter_by(document_id=id).all()
    if chunks:
        qdrant_ids = [c.qdrant_id for c in chunks]
        try:
            vector_store.delete_points(doc.collection_id, qdrant_ids)
        except Exception:
            pass  # Qdrant-Collection könnte bereits weg sein

    # 2. Datei vom Filesystem löschen
    if doc.storage_path and os.path.isfile(doc.storage_path):
        try:
            os.remove(doc.storage_path)
        except OSError:
            pass

    # 3. Aus DB löschen (Chunks + Document)
    DocumentRepo(db).delete(id)

    return {"deleted": id}
