from google.genai import types
from fastapi import HTTPException
from embeddings import client

CHAT_MODEL = "gemini-3.8-flash"

SYSTEM_PROMPT = """You are a health knowledge assistant.
Answer the question using ONLY the numbered context passages below.
If the passages do not contain the answer, say you could not find it in the uploaded documents.
Cite sources inline like [1], [2]. Do not give personal medical advice."""


def generate_answer(question: str, passages: list[dict]) -> str:
    context = "\n\n".join(
        f"[{i}] ({p['filename']}, page {p['page']})\n{p['content']}"
        for i, p in enumerate(passages, start=1)
    )
    try:
        response = client.models.generate_content(
            model=CHAT_MODEL,
            contents=f"Context:\n{context}\n\nQuestion: {question}",
            config=types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT),
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM call failed: {e}")
    return response.text or "The model returned no answer."