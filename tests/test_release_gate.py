"""Vertical-slice release gate checks (implementation-backlog §9)."""

import pytest

pytest.importorskip("semantica")

from fastapi.testclient import TestClient

from sema.api.app import create_app
from sema.config import Settings


def _settings(tmp_path) -> Settings:
    return Settings(data_dir=tmp_path, ingest_inline=True)


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, email: str) -> dict[str, str]:
    body = client.post(
        "/api/auth/register",
        json={"email": email, "password": "password1", "display_name": "U"},
    ).json()
    return _auth(body["token"])


def test_ledger_and_projection_survive_app_restart(tmp_path) -> None:
    """§9.3 / §9.8 — canonical data on disk survives a new API process."""
    settings = _settings(tmp_path)
    client = TestClient(create_app(settings))
    headers = _register(client, "restart@example.com")
    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]

    client.post(
        f"/api/kbs/{kb_id}/documents",
        headers=headers,
        json={"doc_id": "persist-doc", "text": "persist me", "extract": False},
    )
    before = client.get(f"/api/kbs/{kb_id}/graph/projection", headers=headers).json()
    rev_before = before["revision"]

    client.post(f"/api/kbs/{kb_id}/graph/rebuild", headers=headers)

    client.close()
    client2 = TestClient(create_app(settings))
    headers2 = _register(client2, "restart2@example.com")
    kb_id2 = client2.get("/api/kbs", headers=headers2).json()["kbs"][0]["id"]
    assert kb_id2 == kb_id

    after = client2.get(f"/api/kbs/{kb_id}/graph/projection", headers=headers2).json()
    assert after["revision"] >= rev_before

    snap = client2.get(f"/api/kbs/{kb_id}/graph/snapshot", headers=headers2)
    assert snap.status_code == 200
    node_ids = {n["id"] for n in snap.json()["nodes"]}
    assert "persist-doc" in node_ids


def test_dual_kb_graph_snapshot_isolation(tmp_path) -> None:
    """§9.5 — graph projection nodes do not leak across KBs (HTTP)."""
    client = TestClient(create_app(_settings(tmp_path)))
    headers = _register(client, "dual@example.com")
    kb_a = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]
    kb_b = client.post(
        "/api/kbs",
        headers=headers,
        json={"name": "B", "visibility": "restricted"},
    ).json()["id"]

    client.post(
        f"/api/kbs/{kb_a}/documents",
        headers=headers,
        json={"doc_id": "only-on-a", "text": "A", "extract": False},
    )
    client.post(
        f"/api/kbs/{kb_b}/documents",
        headers=headers,
        json={"doc_id": "only-on-b", "text": "B", "extract": False},
    )

    snap_a = client.get(f"/api/kbs/{kb_a}/graph/snapshot", headers=headers).json()
    snap_b = client.get(f"/api/kbs/{kb_b}/graph/snapshot", headers=headers).json()
    ids_a = {n["id"] for n in snap_a["nodes"]}
    ids_b = {n["id"] for n in snap_b["nodes"]}

    assert "only-on-a" in ids_a
    assert "only-on-a" not in ids_b
    assert "only-on-b" in ids_b
    assert "only-on-b" not in ids_a


def test_rebuild_is_idempotent_for_empty_ledger_change(tmp_path) -> None:
    """§9.3 — repeated rebuild without ledger changes bumps revision monotonically."""
    client = TestClient(create_app(_settings(tmp_path)))
    headers = _register(client, "rebuild@example.com")
    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]
    client.post(
        f"/api/kbs/{kb_id}/documents",
        headers=headers,
        json={"doc_id": "rb-doc", "text": "x", "extract": False},
    )
    first = client.post(f"/api/kbs/{kb_id}/graph/rebuild", headers=headers).json()
    second = client.post(f"/api/kbs/{kb_id}/graph/rebuild", headers=headers).json()
    assert second["projection_revision"] >= first["projection_revision"]

    snap = client.get(f"/api/kbs/{kb_id}/graph/snapshot", headers=headers).json()
    assert "rb-doc" in {n["id"] for n in snap["nodes"]}
