"""MCP / integration operations for BOCP connectors."""

import json
from pathlib import Path

from fastapi.testclient import TestClient

from basis.infra.config import Settings
from basis.transport.http.app import create_app


def _mcp_call(
    client: TestClient,
    kb_id: str,
    headers: dict[str, str],
    name: str,
    arguments: dict,
) -> dict:
    resp = client.post(
        f"/api/v1/kbs/{kb_id}/mcp",
        headers=headers,
        json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {"name": name, "arguments": arguments},
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["result"]["isError"] is False, body["result"].get("content")
    return json.loads(body["result"]["content"][0]["text"])


def test_mcp_list_connector_catalog_and_mappings(tmp_path: Path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "email": "mcp-conn@example.com",
            "password": "password1",
            "display_name": "MCP",
        },
    ).json()
    headers = {"Authorization": f"Bearer {reg['token']}"}
    kb_id = client.get("/api/v1/kbs", headers=headers).json()["kbs"][0]["id"]

    catalog = _mcp_call(
        client,
        kb_id,
        headers,
        "list_connector_catalog",
        {"has_streams_only": True, "limit": 20},
    )
    assert "connectors" in catalog
    services = {c["service"] for c in catalog["connectors"]}
    assert "postgres" in services

    detail = _mcp_call(
        client,
        kb_id,
        headers,
        "describe_connector_service",
        {"service": "postgres"},
    )
    assert detail["connector"]["service"] == "postgres"
    assert detail["connector"]["stream_count"] >= 1

    mappings = _mcp_call(
        client,
        kb_id,
        headers,
        "list_connector_table_mappings",
        {"limit": 10},
    )
    assert mappings["mappings"] == []

    blocked = _mcp_call(
        client,
        kb_id,
        headers,
        "execute_connector_tool",
        {"service": "postgres", "tool_id": "nonexistent_tool"},
    )
    assert "error" in blocked
