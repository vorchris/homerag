from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    qdrant_host: str = "qdrant"
    qdrant_port: int = 6333
    db_path: str = "/app/data/homerag.db"
    embedding_provider: str = "local"
    embedding_model: str = "all-MiniLM-L6-v2"
    auth_token: str = "changeme"
    storage_path: str = "/app/storage"

    class Config:
        env_file = ".env"

settings = Settings()