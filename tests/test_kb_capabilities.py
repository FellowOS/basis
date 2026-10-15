"""KB capability endpoint (Explorer integration design §12)."""

from fastapi.testclient import TestClient

from basis.api.app import create_app
from basis.capabilities import explorer_available, kb_capabilities
from basis.config import Settings


def test_kb_capabilities_unit_viewer_vs_editor() -> None:
    viewer = kb_capabilities("viewer")
    owner = kb_capabilities("owner")
    assert viewer["graph_write"] is False
    assert owner["graph_write"] is True
    if explorer_available():
        assert viewer["import_export"] is False
        assert owner["import_export"] is True
        assert viewer["sparql"] is True


def test_kb_capabilities_http(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/auth/register",
        json={"email": "cap@example.com", "password": "password1", "display_name": "Cap"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}

    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]
    response = client.get(f"/api/kbs/{kb_id}/capabilities", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["kb_id"] == kb_id
    assert body["role"] == "owner"
    assert body["graph_write"] is True
    assert body["explorer_runtime"] == explorer_available()
    assert "sparql" in body and "decisions" in body
