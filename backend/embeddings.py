from google import genai
from google.genai import types

from config import settings

client = genai.Client(api_key=settings.gemini_api_key)
MODEL = "gemini-embedding-001"
DIMENSIONS = 768  # must match Vector(768) in models.py


def _embed(texts: list[str], task_type: str) -> list[list[float]]:
    vectors = []
    for i in range(0, len(texts), 50):  # send in batches of 50
        result = client.models.embed_content(
            model=MODEL,
            contents=texts[i : i + 50],
            config=types.EmbedContentConfig(
                task_type=task_type, output_dimensionality=DIMENSIONS
            ),
        )
        vectors.extend(e.values for e in result.embeddings)
    return vectors


def embed_documents(texts: list[str]) -> list[list[float]]:
    return _embed(texts, "RETRIEVAL_DOCUMENT")


def embed_query(text: str) -> list[float]:
    return _embed([text], "RETRIEVAL_QUERY")[0]