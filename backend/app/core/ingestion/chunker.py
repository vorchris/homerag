from dataclasses import dataclass

@dataclass
class Chunk:
    content: str
    index: int
    token_count: int

class Chunker:
    def __init__(self, chunk_size: int = 512, overlap: int = 64):
        self.chunk_size = chunk_size
        self.overlap = overlap

    def chunk(self, text: str) -> list[Chunk]:
        words = text.split()
        chunks = []
        i = 0
        idx = 0
        while i < len(words):
            window = words[i:i + self.chunk_size]
            content = " ".join(window)
            chunks.append(Chunk(content=content, index=idx, token_count=len(window)))
            i += self.chunk_size - self.overlap
            idx += 1
        return chunks