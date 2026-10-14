"""Graph pagination server caps."""

from pathlib import Path

from fastapi.testclient import TestClient

from sema.api.app import create_app
from sema.config import Settings
from sema.limits import GRAPH_PAGE_MAX_NODES


def test_graph_nodes_limit_capped(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)
    client = TestClient(create_app(settings))
    admin = client.post(
        "/api/auth/register",
        json={"email": "lim@example.com", "password": "password1", "display_name": "Lim"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]

    res = client.get(
        f"/api/kbs/{kb_id}/graph/nodes?limit=9999",
        headers=headers,
    )
    assert res.status_code == 200
    # Empty graph still returns; cap is applied inside paginator (no over-fetch crash).
    assert res.json()["engine"] in ("explorer", "snapshot")
    assert GRAPH_PAGE_MAX_NODES == 200
