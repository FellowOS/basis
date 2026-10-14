"""KB ingest source connectors."""

from fastapi.testclient import TestClient

from sema.api.app import create_app
from sema.config import Settings


def test_webhook_source_crud_and_ingest(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/auth/register",
        json={"email": "src@example.com", "password": "password1", "display_name": "Src"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]

    created = client.post(
        f"/api/kbs/{kb_id}/sources",
        headers=headers,
        json={"kind": "webhook", "name": "HR feed"},
    )
    assert created.status_code == 200
    body = created.json()
    source_id = body["source"]["id"]
    token = body["ingest_token"]
    assert token
    assert f"/sources/{source_id}/webhook" in body["webhook_path"]

    listed = client.get(f"/api/kbs/{kb_id}/sources", headers=headers)
    assert listed.status_code == 200
    assert any(s["id"] == source_id for s in listed.json()["sources"])

    bad = client.post(
        f"/api/kbs/{kb_id}/sources/{source_id}/webhook",
        json={"text": "hello"},
    )
    assert bad.status_code == 401

    ingested = client.post(
        f"/api/kbs/{kb_id}/sources/{source_id}/webhook",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "Note", "text": "Webhook body", "external_key": "wh-1"},
    )
    assert ingested.status_code == 200
    assert ingested.json()["doc_id"] == "wh-1"
    assert ingested.json()["status"] == "queued"

    disabled = client.patch(
        f"/api/kbs/{kb_id}/sources/{source_id}",
        headers=headers,
        json={"enabled": False},
    )
    assert disabled.status_code == 200

    blocked = client.post(
        f"/api/kbs/{kb_id}/sources/{source_id}/webhook",
        headers={"Authorization": f"Bearer {token}"},
        json={"text": "nope"},
    )
    assert blocked.status_code == 403


def test_sources_kb_isolation(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    a = client.post(
        "/api/auth/register",
        json={"email": "iso@example.com", "password": "password1", "display_name": "Iso"},
    ).json()
    headers = {"Authorization": f"Bearer {a['token']}"}
    kb_a = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]
    kb_b = client.post(
        "/api/kbs",
        headers=headers,
        json={"name": "Other", "visibility": "restricted"},
    ).json()["id"]

    created = client.post(
        f"/api/kbs/{kb_a}/sources",
        headers=headers,
        json={"kind": "webhook", "name": "A only"},
    ).json()
    source_id = created["source"]["id"]

    denied = client.get(f"/api/kbs/{kb_b}/sources/{source_id}", headers=headers)
    assert denied.status_code == 404
