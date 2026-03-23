from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.repository import CollectionRepo

router = APIRouter()

@router.get("/collections")
def list_collections(db: Session = Depends(get_db)):
    return CollectionRepo(db).get_all()

@router.post("/collections")
def create_collection(name: str, description: str = "", db: Session = Depends(get_db)):
    return CollectionRepo(db).create(name=name, description=description)