"""``connectors_integration`` HTTP routes (``/workspaces/{id}/integration/*``)."""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from basis.infra.runtime.config import Settings
from basis.interface.http.app import create_app


def _auth_client(tmp_path: Path) -> tuple[TestClient, str, dict[str, str]]:
    client = TestClient(create_app(Settings(data_dir=tmp_path / "basis_data")))
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "email": "int@basis.local",
            "password": "password123",
            "display_name": "Int",
        },
    )
    assert reg.status_code == 200
    headers = {"Authorization": f"Bearer {reg.json()['token']}"}
    workspace_id = client.get("/api/v1/workspaces", headers=headers).json()["workspaces"][0][
        "id"
    ]
    return client, workspace_id, headers


def test_integration_providers_and_qq_mail_connection(tmp_path: Path) -> None:
    client, workspace_id, headers = _auth_client(tmp_path)
    prov = client.get(
        f"/api/v1/workspaces/{workspace_id}/integration/providers",
        headers=headers,
        params={"has_streams_only": False},
    )
    assert prov.status_code == 200
    services = {p["service"] for p in prov.json()["providers"]}
    assert "qq_mail" in services

    put = client.put(
        f"/api/v1/workspaces/{workspace_id}/integration/connections/qq_mail",
        headers=headers,
        json={
            "subject_id": "embed-subject-1",
            "auth_type": "custom",
            "credentials": {
                "email": "u@qq.com",
                "authorizationCode": "abcdefghijklmnop",
            },
        },
    )
    assert put.status_code == 200
    conn = put.json()["connection"]
    assert conn["connection_scope"] == "end_user"
    assert conn["subject_id"] == "embed-subject-1"

    listed = client.get(
        f"/api/v1/workspaces/{workspace_id}/integration/connections",
        headers=headers,
        params={"subject_id": "embed-subject-1"},
    )
    assert listed.status_code == 200
    assert len(listed.json()["connections"]) == 1

    deleted = client.delete(
        f"/api/v1/workspaces/{workspace_id}/integration/connections/qq_mail",
        headers=headers,
        params={"subject_id": "embed-subject-1"},
    )
    assert deleted.status_code == 200
