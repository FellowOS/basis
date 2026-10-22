"""Test helpers for demo pack import via workspace create API."""

from __future__ import annotations

from fastapi.testclient import TestClient


def create_workspace_with_demo(
    client: TestClient,
    headers: dict[str, str],
    *,
    name: str = "演示工作区",
    import_demo_data: bool = True,
) -> str:
    resp = client.post(
        "/api/v1/workspaces",
        headers=headers,
        json={
            "name": name,
            "visibility": "restricted",
            "import_demo_data": import_demo_data,
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]
