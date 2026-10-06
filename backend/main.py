import io

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pypdf import PdfReader
from sqlalchemy import select, text
from sqlalchemy.orm import Session
from rag import generate_answer

import models
import schemas
from chunking import chunk_text
from database import Base, engine, get_db
from embeddings import embed_documents, embed_query
from security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)

# Creates the tables if they don't exist. We'll replace this with Alembic later.
# The vector extension must exist before tables that use it
with engine.begin() as conn:
    conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))

Base.metadata.create_all(engine)

app = FastAPI(title="Health Knowledge Assistant")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/auth/signup", response_model=schemas.UserOut, status_code=201)
def signup(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.scalar(select(models.User).where(models.User.email == payload.email))
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = models.User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@app.post("/auth/login", response_model=schemas.Token)
def login(
    form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    # The form field is called "username", but we use it for the email.
    user = db.scalar(select(models.User).where(models.User.email == form.username))
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return schemas.Token(access_token=create_access_token(user.id))


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> models.User:
    user_id = decode_access_token(token)
    user = db.get(models.User, user_id) if user_id else None
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user


@app.get("/auth/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user

@app.post("/documents", status_code=201)
def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    reader = PdfReader(io.BytesIO(file.file.read()))
    pieces = []  # list of (page_number, chunk_text)
    for page_num, page in enumerate(reader.pages, start=1):
        for chunk in chunk_text(page.extract_text() or ""):
            pieces.append((page_num, chunk))

    if not pieces:
        raise HTTPException(status_code=400, detail="No text found (scanned PDF?)")

    vectors = embed_documents([content for _, content in pieces])

    doc = models.Document(user_id=current_user.id, filename=file.filename)
    db.add(doc)
    db.flush()  # assigns doc.id without committing yet
    for i, ((page, content), vector) in enumerate(zip(pieces, vectors)):
        db.add(
            models.Chunk(
                document_id=doc.id,
                chunk_index=i,
                page=page,
                content=content,
                embedding=vector,
            )
        )
    db.commit()
    return {"id": doc.id, "filename": doc.filename, "chunks": len(pieces)}


@app.get("/documents")
def list_documents(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    docs = db.scalars(
        select(models.Document).where(models.Document.user_id == current_user.id)
    ).all()
    return [{"id": d.id, "filename": d.filename} for d in docs]


@app.get("/search")
def search(
    q: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query_vector = embed_query(q)
    distance = models.Chunk.embedding.cosine_distance(query_vector).label("distance")
    rows = db.execute(
        select(models.Chunk, models.Document.filename, distance)
        .join(models.Document, models.Chunk.document_id == models.Document.id)
        .where(models.Document.user_id == current_user.id)
        .order_by(distance)
        .limit(4)
    ).all()
    return [
        {
            "filename": filename,
            "page": chunk.page,
            "distance": round(dist, 3),
            "content": chunk.content[:300],
        }
        for chunk, filename, dist in rows
    ]

@app.post("/ask")
def ask(
    question: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query_vector = embed_query(question)
    distance = models.Chunk.embedding.cosine_distance(query_vector).label("distance")
    rows = db.execute(
        select(models.Chunk, models.Document.filename, distance)
        .join(models.Document, models.Chunk.document_id == models.Document.id)
        .where(models.Document.user_id == current_user.id)
        .order_by(distance)
        .limit(4)
    ).all()
    MAX_DISTANCE = 0.5  # tune this using your own test questions

    passages = [
        {"filename": f, "page": c.page, "content": c.content}
        for c, f, d in rows
        if d <= MAX_DISTANCE
    ]
    if not passages:
        return {
            "answer": "I could not find this in the uploaded documents.",
            "sources": [],
        }
   
    if not passages:
        return {"answer": "No documents uploaded yet.", "sources": []}

    answer = generate_answer(question, passages)
    sources = [
        {"n": i, "filename": p["filename"], "page": p["page"]}
        for i, p in enumerate(passages, start=1)
    ]
    return {"answer": answer, "sources": sources}

@app.delete("/documents/{doc_id}", status_code=204)
def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    doc = db.get(models.Document, doc_id)
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(doc)  # chunks are removed by the database's ON DELETE CASCADE
    db.commit()