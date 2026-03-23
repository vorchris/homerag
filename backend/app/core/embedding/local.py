from app.core.embedding.base import EmbeddingProvider

class LocalEmbedding(EmbeddingProvider):
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        from sentence_transformers import SentenceTransformer
        self.model = SentenceTransformer(model_name, device="cpu")
        self.model_name = model_name

    def embed(self, texts: list[str]) -> list[list[float]]:
        return self.model.encode(texts, show_progress_bar=False).tolist()

    def get_dim(self) -> int:
        return self.model.get_sentence_embedding_dimension()