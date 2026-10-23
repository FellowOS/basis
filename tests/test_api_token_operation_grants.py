"""Workspace API token per-operation grants."""

import pytest

pytest.importorskip("semantica")

from fastapi.testclient import TestClient

from basis.infra.runtime.config import Settings
from basis.interface.http.app import create_app


def test_api_token_allowed_operations_mcp_and_http(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path, ingest_inline=True)))
    admin = client.post(
        "/api/v1/auth/register",
        json={"email": "grants@example.com", "password": "password1", "display_name": "G"},
    ).json()
    session = {"Authorization": f"Bearer {admin['token']}"}
    workspace_id = client.get("/api/v1/workspaces", headers=session).json()["workspaces"][0]["id"]

    created = client.post(
        f"/api/v1/workspaces/{workspace_id}/tokens",
        headers=session,
        json={
            "name": "search-only",
            "scope": "read",
            "allowed_operations": ["search_chunks"],
        },
    )
    assert created.status_code == 200
    secret = created.json()["secret"]
    api_headers = {"Authorization": f"Bearer {secret}"}

    denied = client.get(f"/api/v1/workspaces/{workspace_id}/graph/stats", headers=api_headers)
    assert denied.status_code == 403

    mcp_list = client.post(
        f"/api/v1/workspaces/{workspace_id}/mcp",
        headers=api_headers,
        json={"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}},
    )
    assert mcp_list.status_code == 200
    tools = mcp_list.json()["result"]["tools"]
    names = {t["name"] for t in tools}
    assert names == {"search_chunks"}
