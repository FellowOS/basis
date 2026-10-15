"""KB-scoped API tokens (graph access isolation)."""

import pytest

pytest.importorskip("semantica")

from fastapi.testclient import TestClient

from basis.api.app import create_app
from basis.config import Settings


def test_kb_api_token_reads_scoped_kb_graph(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path, ingest_inline=True)))
    admin = client.post(
        "/api/auth/register",
        json={"email": "tok@example.com", "password": "password1", "display_name": "T"},
    ).json()
    session = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/kbs", headers=session).json()["kbs"][0]["id"]
    other = client.post(
        "/api/kbs",
        headers=session,
        json={"name": "Other", "visibility": "restricted"},
    ).json()["id"]

    client.post(
        f"/api/kbs/{kb_id}/documents",
        headers=session,
        json={"doc_id": "tok-doc", "text": "hello", "extract": False},
    )

    created = client.post(
        f"/api/kbs/{kb_id}/tokens",
        headers=session,
        json={"name": "ci", "scope": "read"},
    )
    assert created.status_code == 200
    secret = created.json()["secret"]
    api_headers = {"Authorization": f"Bearer {secret}"}

    ok = client.get(f"/api/kbs/{kb_id}/graph/stats", headers=api_headers)
    assert ok.status_code == 200

    denied = client.get(f"/api/kbs/{other}/graph/stats", headers=api_headers)
    assert denied.status_code == 403

    listed = client.get(f"/api/kbs/{kb_id}/tokens", headers=session).json()["tokens"]
    assert any(t["name"] == "ci" for t in listed)

    token_id = next(t["id"] for t in listed if t["name"] == "ci")
    revoked = client.delete(f"/api/kbs/{kb_id}/tokens/{token_id}", headers=session)
    assert revoked.status_code == 200
    assert client.get(f"/api/kbs/{kb_id}/graph/stats", headers=api_headers).status_code == 401
