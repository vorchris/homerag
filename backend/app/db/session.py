from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.db.models import Base
from app.config import settings
import os

os.makedirs(os.path.dirname(settings.db_path), exist_ok=True)

engine = create_engine(
    f"sqlite:///{settings.db_path}",
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False  # ← Fix
)

def init_db():
    Base.metadata.create_all(bind=engine)
    # Add new columns to existing DBs without Alembic
    with engine.connect() as conn:
        for col, typ in [
            ("embedding_provider", "VARCHAR"),
            ("embedding_model", "VARCHAR"),
            ("embedding_dim", "INTEGER"),
        ]:
            try:
                conn.execute(text(f"ALTER TABLE collections ADD COLUMN {col} {typ}"))
                conn.commit()
            except Exception:
                pass  # Column already exists

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()