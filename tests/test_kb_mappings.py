"""KB ontology mapping ledger routes."""

from fastapi.testclient import TestClient

from basis.api.http.app import create_app
from basis.runtime.config import Settings


def test_mapping_create_list_confirm(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/v1/auth/register",
        json={"email": "map@example.com", "password": "password1", "display_name": "Map"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}

    kb_id = client.get("/api/v1/kbs", headers=headers).json()["kbs"][0]["id"]

    created = client.post(
        f"/api/v1/kbs/{kb_id}/mappings",
        headers=headers,
        json={
            "signature": "surface:works_at",
            "target_uri": "http://example.org/worksAt",
            "target_kind": "property",
            "direction": "forward",
            "status": "proposed",
        },
    )
    assert created.status_code == 200
    mapping_id = created.json()["mapping"]["id"]

    listed = client.get(f"/api/v1/kbs/{kb_id}/mappings", headers=headers)
    assert listed.status_code == 200
    assert any(m["id"] == mapping_id for m in listed.json()["mappings"])

    confirmed = client.post(
        f"/api/v1/kbs/{kb_id}/mappings/{mapping_id}/status",
        headers=headers,
        json={"status": "confirmed"},
    )
    assert confirmed.status_code == 200
    assert confirmed.json()["mapping"]["status"] == "confirmed"


def test_mapping_kb_isolation(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    a = client.post(
        "/api/v1/auth/register",
        json={"email": "a@example.com", "password": "password1", "display_name": "A"},
    ).json()
    b = client.post(
        "/api/v1/auth/register",
        json={"email": "b@example.com", "password": "password1", "display_name": "B"},
    ).json()
    headers_a = {"Authorization": f"Bearer {a['token']}"}
    headers_b = {"Authorization": f"Bearer {b['token']}"}

    kb_a = client.post(
        "/api/v1/kbs",
        headers=headers_a,
        json={"name": "Private A", "visibility": "restricted"},
    ).json()["id"]
    client.post(
        f"/api/v1/kbs/{kb_a}/mappings",
        headers=headers_a,
        json={"signature": "only-a", "target_kind": "none", "direction": "n/a", "status": "proposed"},
    )

    denied = client.get(f"/api/v1/kbs/{kb_a}/mappings", headers=headers_b)
    assert denied.status_code == 403


def test_mapping_materializes_typed_facts_after_confirm(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/v1/auth/register",
        json={"email": "mat@example.com", "password": "password1", "display_name": "Mat"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}

    kb_id = client.get("/api/v1/kbs", headers=headers).json()["kbs"][0]["id"]
    client.post(
        f"/api/v1/kbs/{kb_id}/documents",
        headers=headers,
        json={"doc_id": "m1", "text": "Alice knows Bob.", "wait": True, "extract": True},
    )

    phrases = client.get(f"/api/v1/kbs/{kb_id}/ledger/surface-phrases", headers=headers)
    assert phrases.status_code == 200
    surface_list = phrases.json()["phrases"]
    assert surface_list, "expected at least one surface phrase from extract"

    signature = surface_list[0]
    created = client.post(
        f"/api/v1/kbs/{kb_id}/mappings",
        headers=headers,
        json={
            "signature": signature,
            "target_uri": "http://example.org/knows",
            "target_kind": "property",
            "direction": "forward",
            "status": "proposed",
        },
    ).json()["mapping"]

    confirmed = client.post(
        f"/api/v1/kbs/{kb_id}/mappings/{created['id']}/status",
        headers=headers,
        json={"status": "confirmed"},
    )
    assert confirmed.status_code == 200
    assert confirmed.json()["materialized"]["created"] >= 1

    facts = client.get(f"/api/v1/kbs/{kb_id}/ledger/typed-facts", headers=headers).json()["facts"]
    assert any(f["mapping_id"] == created["id"] for f in facts)


def test_proposed_mapping_opens_review_queue(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/v1/auth/register",
        json={"email": "rev@example.com", "password": "password1", "display_name": "Rev"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/v1/kbs", headers=headers).json()["kbs"][0]["id"]

    created = client.post(
        f"/api/v1/kbs/{kb_id}/mappings",
        headers=headers,
        json={
            "signature": "surface:test_phrase",
            "target_uri": "http://example.org/p",
            "target_kind": "property",
            "direction": "forward",
            "status": "proposed",
        },
    ).json()["mapping"]

    queue = client.get(
        f"/api/v1/kbs/{kb_id}/review/items",
        headers=headers,
        params={"kind": "ontology_mapping"},
    )
    assert queue.status_code == 200
    items = queue.json()["items"]
    assert len(items) == 1
    assert items[0]["payload"]["mapping_id"] == created["id"]

    approved = client.post(
        f"/api/v1/kbs/{kb_id}/review/items/{items[0]['id']}/approve",
        headers=headers,
        json={"rationale": "looks good"},
    )
    assert approved.status_code == 200
    mapping = client.get(f"/api/v1/kbs/{kb_id}/mappings", headers=headers).json()["mappings"]
    row = next(m for m in mapping if m["id"] == created["id"])
    assert row["status"] == "confirmed"

    queue_after = client.get(f"/api/v1/kbs/{kb_id}/review/items", headers=headers)
    assert queue_after.json()["items"] == []


def test_viewer_cannot_confirm_mapping_directly(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    owner = client.post(
        "/api/v1/auth/register",
        json={"email": "own@example.com", "password": "password1", "display_name": "Own"},
    ).json()
    owner_headers = {"Authorization": f"Bearer {owner['token']}"}
    kb_id = client.get("/api/v1/kbs", headers=owner_headers).json()["kbs"][0]["id"]

    viewer = client.post(
        "/api/v1/auth/register",
        json={"email": "view2@example.com", "password": "password1", "display_name": "View"},
    ).json()
    viewer_user = client.get("/api/v1/users", headers=owner_headers).json()["users"]
    viewer_id = next(u for u in viewer_user if u["email"] == "view2@example.com")["id"]
    client.post(
        f"/api/v1/kbs/{kb_id}/members",
        headers=owner_headers,
        json={"user_id": viewer_id, "role": "viewer"},
    )
    viewer_headers = {"Authorization": f"Bearer {viewer['token']}"}

    created = client.post(
        f"/api/v1/kbs/{kb_id}/mappings",
        headers=viewer_headers,
        json={
            "signature": "surface:viewer_prop",
            "target_kind": "none",
            "direction": "n/a",
            "status": "proposed",
        },
    )
    assert created.status_code == 200
    mapping_id = created.json()["mapping"]["id"]

    denied = client.post(
        f"/api/v1/kbs/{kb_id}/mappings/{mapping_id}/status",
        headers=viewer_headers,
        json={"status": "confirmed"},
    )
    assert denied.status_code == 403
