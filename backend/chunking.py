def chunk_text(text: str, size: int = 1000, overlap: int = 200) -> list[str]:
    text = " ".join(text.split())  # collapse whitespace and newlines
    chunks = []
    start = 0
    while start < len(text):
        chunks.append(text[start : start + size])
        start += size - overlap
    return chunks