from sqlalchemy.orm import Session
from app.db.models import Collection, Document, Chunk

class CollectionRepo:
    def __init__(self, db: Session):
        self.db = db

    def create(self, name: str, description: str = "") -> Collection:
        col = Collection(name=name, description=description)
        self.db.add(col)
        self.db.commit()
        self.db.expunge(col)
        return col

    def get_all(self) -> list[Collection]:
        return self.db.query(Collection).all()

    def get_by_name(self, name: str) -> Collection | None:
        return self.db.query(Collection).filter(Collection.name == name).first()

    def delete(self, id: str):
        self.db.query(Collection).filter(Collection.id == id).delete()
        self.db.commit()

class DocumentRepo:
    def __init__(self, db: Session):
        self.db = db

    def create(self, **kwargs) -> Document:
        doc = Document(**kwargs)
        self.db.add(doc)
        self.db.commit()
        self.db.expunge(doc)
        return doc

    def get_by_collection(self, collection_id: str) -> list[Document]:
        return self.db.query(Document).filter(Document.collection_id == collection_id).all()

    def delete(self, id: str):
        self.db.query(Chunk).filter(Chunk.document_id == id).delete()
        self.db.query(Document).filter(Document.id == id).delete()
        self.db.commit()

class ChunkRepo:
    def __init__(self, db: Session):
        self.db = db

    def create(self, **kwargs):
        chunk = Chunk(**kwargs)
        self.db.add(chunk)
        self.db.commit()
        self.db.expunge(chunk)
        return chunk