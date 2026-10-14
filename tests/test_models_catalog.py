from fastapi.testclient import TestClient

from sema.api.app import create_app
from sema.config import Settings


def _client(tmp_path) -> TestClient:
    return TestClient(create_app(Settings(data_dir=tmp_path)))


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, email: str) -> dict:
    response = client.post(
        "/api/auth/register",
        json={"email": email, "password": "password1", "display_name": "管理员"},
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_model_catalog_crud(tmp_path) -> None:
    client = _client(tmp_path)
    admin = _register(client, "admin@example.com")
    headers = _auth(admin["token"])

    empty = client.get("/api/models?kind=llm", headers=headers)
    assert empty.status_code == 200
    assert empty.json()["models"] == []

    created = client.post(
        "/api/models",
        headers=headers,
        json={
            "kind": "llm",
            "provider": "openai",
            "api_base": "https://api.openai.com/v1",
            "model": "gpt-4o-mini",
            "api_key": "sk-test-key",
        },
    )
    assert created.status_code == 200, created.text
    body = created.json()["model"]
    assert body["model"] == "gpt-4o-mini"
    assert body["configured"] is True
    model_id = body["id"]

    listed = client.get("/api/models?kind=llm", headers=headers).json()["models"]
    assert len(listed) == 1

    settings = client.get("/api/settings", headers=headers).json()
    assert settings["chat_model"] == "gpt-4o-mini"
    assert settings["has_chat_key"] is True

    client.delete(f"/api/models/{model_id}", headers=headers)
    assert client.get("/api/models?kind=llm", headers=headers).json()["models"] == []
