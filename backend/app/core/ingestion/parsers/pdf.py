def parse(path: str) -> str:
    import fitz
    doc = fitz.open(path)
    return "\n".join(page.get_text() for page in doc)