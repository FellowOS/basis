import pytest

pytest.importorskip("semantica")

from fastapi.testclient import TestClient

from basis.api.app import create_app
from basis.config import Settings


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_graph_snapshot_lists_document_after_ingest(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/auth/register",
        json={"email": "g@example.com", "password": "password1", "display_name": "U"},
    ).json()
    headers = _auth(admin["token"])
    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]

    client.post(
        f"/api/kbs/{kb_id}/documents",
        headers=headers,
        json={"doc_id": "snap-doc", "text": "hello graph", "extract": False},
    )

    snap = client.get(f"/api/kbs/{kb_id}/graph/snapshot", headers=headers)
    assert snap.status_code == 200
    body = snap.json()
    assert body["stats"]["node_count"] >= 1
    ids = [n["id"] for n in body["nodes"]]
    assert "snap-doc" in ids


def test_graph_projection_and_rebuild_audit(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/auth/register",
        json={"email": "p@example.com", "password": "password1", "display_name": "U"},
    ).json()
    headers = _auth(admin["token"])
    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]

    client.post(
        f"/api/kbs/{kb_id}/documents",
        headers=headers,
        json={"doc_id": "proj-doc", "text": "projection test", "extract": False},
    )

    projection = client.get(f"/api/kbs/{kb_id}/graph/projection", headers=headers)
    assert projection.status_code == 200
    proj_body = projection.json()
    assert "revision" in proj_body
    assert "status" in proj_body
    assert proj_body.get("node_count", 0) >= 1

    rebuild = client.post(f"/api/kbs/{kb_id}/graph/rebuild", headers=headers)
    assert rebuild.status_code == 200
    assert "projection_revision" in rebuild.json()

    audit = client.get(f"/api/audit?kb_id={kb_id}", headers=headers)
    assert audit.status_code == 200
    actions = [e["action"] for e in audit.json()["events"]]
    assert "kb.graph.projection_rebuild" in actions

    kb_audit = client.get(
        f"/api/kbs/{kb_id}/audit/graph-mutations?action_prefix=kb.graph.",
        headers=headers,
    )
    assert kb_audit.status_code == 200
    kb_actions = [e["action"] for e in kb_audit.json()["events"]]
    assert "kb.graph.projection_rebuild" in kb_actions


def test_kb_graph_audit_visible_to_viewer_not_platform_audit(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    owner = client.post(
        "/api/auth/register",
        json={"email": "own@example.com", "password": "password1", "display_name": "O"},
    ).json()
    owner_headers = _auth(owner["token"])
    kb_id = client.get("/api/kbs", headers=owner_headers).json()["kbs"][0]["id"]

    viewer = client.post(
        "/api/auth/register",
        json={"email": "view@example.com", "password": "password1", "display_name": "V"},
    ).json()
    viewer_id = client.get("/api/users", headers=owner_headers).json()["users"]
    viewer_user = next(u for u in viewer_id if u["email"] == "view@example.com")
    client.post(
        f"/api/kbs/{kb_id}/members",
        headers=owner_headers,
        json={"user_id": viewer_user["id"], "role": "viewer"},
    )
    viewer_headers = _auth(viewer["token"])

    client.post(f"/api/kbs/{kb_id}/graph/rebuild", headers=owner_headers)

    denied = client.get("/api/audit", headers=viewer_headers)
    assert denied.status_code == 403

    allowed = client.get(
        f"/api/kbs/{kb_id}/audit/graph-mutations",
        headers=viewer_headers,
    )
    assert allowed.status_code == 200


def test_platform_reports_capabilities(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    info = client.get("/api/platform").json()
    assert info["capabilities"]["graph_snapshot"] is True
    assert isinstance(info["capabilities"]["explorer_runtime"], bool)
