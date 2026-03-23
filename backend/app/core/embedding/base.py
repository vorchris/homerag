from abc import ABC, abstractmethod

class EmbeddingProvider(ABC):
    @abstractmethod
    def embed(self, texts: list[str]) -> list[list[float]]:
        pass

    @abstractmethod
    def get_dim(self) -> int:
        pass