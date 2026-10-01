from fastapi import FastAPI

app = FastAPI(title="Health Knowledge Assistant")


@app.get("/health")
def health_check():
    return {"status": "ok"}