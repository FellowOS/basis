"""Governance config HTTP routes."""

from pathlib import Path

from fastapi.testclient import TestClient

from basis.infra.config import Settings
from basis.transport.http.app import create_app


def test_governance_config_get_put(tmp_path: Path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/v1/auth/register",
        json={"email": "gc@example.com", "password": "password1", "display_name": "GC"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/v1/kbs", headers=headers).json()["kbs"][0]["id"]

    get0 = client.get(f"/api/v1/kbs/{kb_id}/governance/config", headers=headers)
    assert get0.status_code == 200
    assert get0.json()["config"]["governor_enabled"] is False

    put = client.put(
        f"/api/v1/kbs/{kb_id}/governance/config",
        headers=headers,
        json={
            "governor_enabled": True,
            "governor_interval_minutes": 120,
            "governor_confidence_min": 0.6,
        },
    )
    assert put.status_code == 200
    body = put.json()["config"]
    assert body["governor_enabled"] is True
    assert body["governor_interval_minutes"] == 120
    assert body["governor_confidence_min"] == 0.6
