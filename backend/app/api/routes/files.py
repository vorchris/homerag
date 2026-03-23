from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.repository import DocumentRepo

router = APIRouter()

@router.get("/files")
def list_files(collection: str = "default", db: Session = Depends(get_db)):
    return DocumentRepo(db).get_by_collection(collection)

@router.delete("/files/{id}")
def delete_file(id: str, db: Session = Depends(get_db)):
    repo = DocumentRepo(db)
    doc = db.query(__import__('app.db.models', fromlist=['Document']).Document).filter_by(id=id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    repo.delete(id)
    return {"deleted": id}