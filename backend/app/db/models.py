from sqlalchemy import Column, String, Integer, Text, DateTime
from sqlalchemy.orm import DeclarativeBase
from datetime import datetime
import uuid

class Base(DeclarativeBase):
    pass

class Collection(Base):
    __tablename__ = "collections"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, unique=True, nullable=False)
    description = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

class Document(Base):
    __tablename__ = "documents"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    collection_id = Column(String, nullable=False)
    filename = Column(String, nullable=False)
    source_type = Column(String, nullable=False)
    storage_path = Column(String, nullable=False)
    chunk_count = Column(Integer, default=0)
    ingested_at = Column(DateTime, default=datetime.utcnow)

class Chunk(Base):
    __tablename__ = "chunks"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String, nullable=False)
    qdrant_id = Column(String, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    token_count = Column(Integer, default=0)

class Config(Base):
    __tablename__ = "config"
    key = Column(String, primary_key=True)
    value = Column(String, nullable=False)
    description = Column(String, default="")