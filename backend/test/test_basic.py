from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_me_requires_login():
    res = client.get("/auth/me")
    assert res.status_code == 401


def test_signup_rejects_short_password():
    res = client.post(
        "/auth/signup", json={"email": "a@example.com", "password": "short"}
    )
    assert res.status_code == 422