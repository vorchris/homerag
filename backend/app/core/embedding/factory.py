import json
import os
from pathlib import Path
from app.core.embedding.base import EmbeddingProvider

_instance: EmbeddingProvider | None = None

CONFIG_PATH = Path(os.getenv("HOMERAG_CONFIG", "homerag_config.json"))


def _load_embedding_config() -> dict:
    if CONFIG_PATH.exists():
        return json.loads(CONFIG_PATH.read_text()).get("embedding", {})
    return {}


def get_embedding_provider() -> EmbeddingProvider:
    global _instance
    if _instance is not None:
        return _instance

    emb = _load_embedding_config()
    provider = emb.get("provider", "local")
    model = emb.get("model", "all-MiniLM-L6-v2")
    api_key = emb.get("api_key") or None

    if provider == "local":
        from app.core.embedding.local import LocalEmbedding
        _instance = LocalEmbedding(model)
    elif provider == "openai":
        from app.core.embedding.openai import OpenAIEmbedding
        _instance = OpenAIEmbedding(model, api_key)
    else:
        raise ValueError(f"Unknown embedding provider: {provider}")

    return _instance


def reset_embedding_provider():
    """Call after config changes so the next request loads the new provider."""
    global _instance
    _instance = None


def get_provider_for(provider: str, model: str, api_key: str | None = None):
    """Return a fresh provider instance for the given config (not cached)."""
    if provider == "local":
        from app.core.embedding.local import LocalEmbedding
        return LocalEmbedding(model)
    elif provider == "openai":
        from app.core.embedding.openai import OpenAIEmbedding
        return OpenAIEmbedding(model, api_key)
    raise ValueError(f"Unknown embedding provider: {provider}")
