"""Dynamic MCP tools/list from BOCP manifest actions."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from basis.core.connectors.auth_vault import ConnectorPolicy
from basis.core.connectors import get_connector_catalog
from basis.runtime.config import Settings
from basis.application.mcp_connector_tools import (
    connector_mcp_tool_name,
    connector_tool_definitions_for_manifest,
    parse_connector_mcp_tool_name,
)
from basis.api.http.app import create_app


def test_connector_mcp_tool_name_roundtrip() -> None:
    name = connector_mcp_tool_name("github", "issues", "mutate", operation="create")
    assert name == "connector_github__issues__mutate_create"
    parsed = parse_connector_mcp_tool_name(name)
    assert parsed == {
        "service": "github",
        "action_id": "issues",
        "primitive": "mutate",
        "operation": "create",
    }
    assert parse_connector_mcp_tool_name("search_chunks") is None


def test_shipped_github_manifest_expands_entity_tools() -> None:
    manifest = get_connector_catalog().get("github")
    assert manifest is not None
    policy = ConnectorPolicy(kb_id="kb1", allowed_providers="*")
    names = {t["name"] for t in connector_tool_definitions_for_manifest(manifest, policy)}
    assert "connector_github__repositories__list" in names
    assert "connector_github__issues__list" in names
    assert "connector_github__issues__mutate_create" in names
    assert "connector_github__issues__mutate_update" in names
    assert "connector_github__get_authenticated_user__invoke" in names


def test_shipped_notion_manifest_expands_entity_tools() -> None:
    manifest = get_connector_catalog().get("notion")
    assert manifest is not None
    policy = ConnectorPolicy(kb_id="kb1", allowed_providers="*")
    names = {t["name"] for t in connector_tool_definitions_for_manifest(manifest, policy)}
    assert "connector_notion__database_pages__list" in names
    assert "connector_notion__database_pages__mutate_update" in names


def test_shipped_slack_manifest_expands_invoke_tools() -> None:
    manifest = get_connector_catalog().get("slack")
    assert manifest is not None
    policy = ConnectorPolicy(kb_id="kb1", allowed_providers="*")
    names = {t["name"] for t in connector_tool_definitions_for_manifest(manifest, policy)}
    assert "connector_slack__slack_post_message__invoke" in names


def test_manifest_tools_omit_disabled_entity_primitives() -> None:
    manifest = get_connector_catalog().get("github")
    assert manifest is not None
    policy = ConnectorPolicy(
        kb_id="kb1",
        allowed_providers="*",
        action_policy={"entities": {"github:issues.list": "disabled"}},
    )
    names = {t["name"] for t in connector_tool_definitions_for_manifest(manifest, policy)}
    assert "connector_github__issues__list" not in names
    assert "connector_github__issues__mutate_create" in names
    assert "connector_github__repositories__list" in names


def test_mcp_tools_list_includes_dynamic_connector_tools(tmp_path: Path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "email": "dyn@mcp.example.com",
            "password": "password1",
            "display_name": "Dyn",
        },
    ).json()
    headers = {"Authorization": f"Bearer {reg['token']}"}
    kb_id = client.get("/api/v1/kbs", headers=headers).json()["kbs"][0]["id"]

    tools = client.post(
        f"/api/v1/kbs/{kb_id}/mcp",
        headers=headers,
        json={"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}},
    ).json()
    names = {t["name"] for t in tools["result"]["tools"]}
    assert "invoke_connector_primitive" in names
    assert "connector_postgres__table_records__list" in names
    assert "connector_github__issues__list" in names

    info = client.get(f"/api/v1/kbs/{kb_id}/mcp", headers=headers).json()
    assert "connector_github__issues__list" in info["tools"]
    assert "search_chunks" in info["tools"]


def test_mcp_tools_list_respects_kb_action_policy(tmp_path: Path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "email": "pol@mcp.example.com",
            "password": "password1",
            "display_name": "Pol",
        },
    ).json()
    headers = {"Authorization": f"Bearer {reg['token']}"}
    kb_id = client.get("/api/v1/kbs", headers=headers).json()["kbs"][0]["id"]

    put = client.put(
        f"/api/v1/kbs/{kb_id}/connectors/policy",
        headers=headers,
        json={
            "allowed_providers": ["github", "postgres", "mysql"],
            "action_policy": {"entities": {"github:issues.list": "disabled"}},
        },
    )
    assert put.status_code == 200

    tools = client.post(
        f"/api/v1/kbs/{kb_id}/mcp",
        headers=headers,
        json={"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}},
    ).json()
    names = {t["name"] for t in tools["result"]["tools"]}
    assert "connector_github__issues__list" not in names
    assert "connector_github__repositories__list" in names
    assert "connector_github__issues__mutate_create" in names


def test_mcp_dynamic_connector_tool_call_list(tmp_path: Path) -> None:
    ext_db_path = tmp_path / "remote.db"
    ext_engine = create_engine(f"sqlite:///{ext_db_path}")
    with ext_engine.begin() as ext_conn:
        ext_conn.execute(
            text(
                """
                CREATE TABLE items (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
        )
        ext_conn.execute(
            text(
                "INSERT INTO items (id, name, updated_at) VALUES ('i1', 'One', '2026-01-01T00:00:00Z')"
            )
        )
    ext_engine.dispose()

    client = TestClient(create_app(Settings(data_dir=tmp_path / "basis_data")))
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "email": "dyn2@mcp.example.com",
            "password": "password1",
            "display_name": "Dyn2",
        },
    ).json()
    headers = {"Authorization": f"Bearer {reg['token']}"}
    kb_id = client.get("/api/v1/kbs", headers=headers).json()["kbs"][0]["id"]

    client.put(
        f"/api/v1/kbs/{kb_id}/connectors/connections/postgres/prim",
        headers=headers,
        json={
            "auth_type": "database_dsn",
            "connection_config": {"dsn": f"sqlite:///{ext_db_path}"},
            "credentials": {},
        },
    )

    tool_name = connector_mcp_tool_name("postgres", "table_records", "list")
    mcp_resp = client.post(
        f"/api/v1/kbs/{kb_id}/mcp",
        headers=headers,
        json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": {
                    "connection_name": "prim",
                    "external_table": "items",
                    "limit": 50,
                },
            },
        },
    )
    assert mcp_resp.status_code == 200
    body = mcp_resp.json()
    assert body["result"]["isError"] is False
    payload = json.loads(body["result"]["content"][0]["text"])
    assert len(payload["records"]) == 1
    assert payload["records"][0]["id"] == "i1"
