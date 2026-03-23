from app.core.embedding.base import EmbeddingProvider
from app.config import settings

_instance: EmbeddingProvider | None = None

def get_embedding_provider() -> EmbeddingProvider:
    global _instance
    if _instance is not None:
        return _instance

    if settings.embedding_provider == "local":
        from app.core.embedding.local import LocalEmbedding
        _instance = LocalEmbedding(settings.embedding_model)
    elif settings.embedding_provider == "openai":
        raise NotImplementedError("OpenAI embedding coming soon")
    else:
        raise ValueError(f"Unknown provider: {settings.embedding_provider}")

    return _instance