"""KB MCP HTTP and API tokens."""

import json
import time
from unittest.mock import patch

from fastapi.testclient import TestClient

from basis.transport.http.app import create_app
from basis.infra.config import Settings

_LOOP_MARKER = "MCP_GRAPH_LOOP_UNIQUE_2010"


def _mcp_tool_json(
    client: TestClient,
    kb_id: str,
    headers: dict[str, str],
    name: str,
    arguments: dict,
    *,
    rpc_id: int,
) -> dict:
    resp = client.post(
        f"/api/v1/kbs/{kb_id}/mcp",
        headers=headers,
        json={
            "jsonrpc": "2.0",
            "id": rpc_id,
            "method": "tools/call",
            "params": {"name": name, "arguments": arguments},
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["result"]["isError"] is False, body["result"].get("content")
    return json.loads(body["result"]["content"][0]["text"])


def test_mcp_basic_graph_closed_loop(tmp_path) -> None:
    """Read corpus → propose fact → review → approve → read back via ledger facts."""
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/v1/auth/register",
        json={"email": "loop@example.com", "password": "password1", "display_name": "Loop"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/v1/kbs", headers=headers).json()["kbs"][0]["id"]
    client.post(
        f"/api/v1/kbs/{kb_id}/documents",
        headers=headers,
        json={
            "doc_id": "loop-doc",
            "text": "The capital of France is Paris.",
            "wait": True,
            "extract": False,
            "chunk": True,
        },
    )

    search = _mcp_tool_json(
        client, kb_id, headers, "search_chunks", {"query": "Paris"}, rpc_id=1
    )
    assert any("Paris" in (c.get("text") or "") for c in search.get("chunks", []))

    proposed = _mcp_tool_json(
        client,
        kb_id,
        headers,
        "propose_remember",
        {"content": f"Acme Corp {_LOOP_MARKER}."},
        rpc_id=2,
    )
    review_item_id = proposed["review_item_id"]

    item = _mcp_tool_json(
        client,
        kb_id,
        headers,
        "get_review_item",
        {"item_id": review_item_id},
        rpc_id=3,
    )
    assert item["item"]["status"] == "open"

    approved = _mcp_tool_json(
        client,
        kb_id,
        headers,
        "approve_statement_remember_review",
        {"item_id": review_item_id},
        rpc_id=4,
    )
    assert approved["item"]["status"] == "approved"

    entities = _mcp_tool_json(
        client,
        kb_id,
        headers,
        "find_entities",
        {"query": "Agent memory"},
        rpc_id=5,
    )
    ledger = entities.get("ledger_entities") or []
    assert ledger, "remember anchor entity should exist"
    entity_id = ledger[0]["id"]

    facts = _mcp_tool_json(
        client,
        kb_id,
        headers,
        "entity_facts",
        {"entity_id": entity_id},
        rpc_id=6,
    )
    assert any(_LOOP_MARKER in str(f.get("object_value") or "") for f in facts.get("facts", []))


def test_mcp_tools_with_api_token(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/v1/auth/register",
        json={"email": "mcp@example.com", "password": "password1", "display_name": "M"},
    ).json()
    session_headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/v1/kbs", headers=session_headers).json()["kbs"][0]["id"]
    client.post(
        f"/api/v1/kbs/{kb_id}/documents",
        headers=session_headers,
        json={
            "doc_id": "mcp-doc",
            "text": "The capital of France is Paris. Paris is a city.",
            "wait": True,
            "extract": False,
            "chunk": True,
        },
    )

    created = client.post(
        f"/api/v1/kbs/{kb_id}/tokens",
        headers=session_headers,
        json={"name": "agent", "scope": "read"},
    )
    assert created.status_code == 200
    secret = created.json()["secret"]
    listed = client.get(f"/api/v1/kbs/{kb_id}/tokens", headers=session_headers).json()
    assert listed["tokens"][0].get("secret") == secret
    api_headers = {"Authorization": f"Bearer {secret}"}

    info = client.get(f"/api/v1/kbs/{kb_id}/mcp", headers=api_headers)
    assert info.status_code == 200
    assert info.json()["mcp_url"].endswith(f"/api/v1/kbs/{kb_id}/mcp")

    init = client.post(
        f"/api/v1/kbs/{kb_id}/mcp",
        headers=api_headers,
        json={"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}},
    )
    assert init.status_code == 200
    assert init.json()["result"]["serverInfo"]["name"] == "basis-kb-mcp"

    tools = client.post(
        f"/api/v1/kbs/{kb_id}/mcp",
        headers=api_headers,
        json={"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}},
    ).json()
    names = {t["name"] for t in tools["result"]["tools"]}
    assert "search_chunks" in names
    assert "propose_remember" in names
    assert "graph_search" in names
    assert "list_review_items" in names
    assert "approve_statement_remember_review" in names
    assert "list_processing_jobs" not in names

    search = client.post(
        f"/api/v1/kbs/{kb_id}/mcp",
        headers=api_headers,
        json={
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {"name": "search_chunks", "arguments": {"query": "Paris"}},
        },
    ).json()
    assert search["result"]["isError"] is False
    assert "Paris" in search["result"]["content"][0]["text"]

    wrong_kb = client.post(
        "/api/v1/kbs/00000000-0000-0000-0000-000000000000/mcp",
        headers=api_headers,
        json={"jsonrpc": "2.0", "id": 4, "method": "ping", "params": {}},
    )
    assert wrong_kb.status_code == 403

    remember = client.post(
        f"/api/v1/kbs/{kb_id}/mcp",
        headers=session_headers,
        json={
            "jsonrpc": "2.0",
            "id": 5,
            "method": "tools/call",
            "params": {
                "name": "propose_remember",
                "arguments": {"content": "MCP remembered fact for review."},
            },
        },
    )
    assert remember.status_code == 200
    remember_payload = json.loads(remember.json()["result"]["content"][0]["text"])
    review_item_id = remember_payload.get("review_item_id")
    assert review_item_id

    listed = client.post(
        f"/api/v1/kbs/{kb_id}/mcp",
        headers=session_headers,
        json={
            "jsonrpc": "2.0",
            "id": 6,
            "method": "tools/call",
            "params": {
                "name": "list_review_items",
                "arguments": {"kind": "statement_remember", "status": "open"},
            },
        },
    ).json()
    list_payload = json.loads(listed["result"]["content"][0]["text"])
    assert any(i["id"] == review_item_id for i in list_payload["items"])

    approved = client.post(
        f"/api/v1/kbs/{kb_id}/mcp",
        headers=session_headers,
        json={
            "jsonrpc": "2.0",
            "id": 7,
            "method": "tools/call",
            "params": {
                "name": "approve_statement_remember_review",
                "arguments": {"item_id": review_item_id, "rationale": "looks good"},
            },
        },
    ).json()
    assert approved["result"]["isError"] is False
    approve_payload = json.loads(approved["result"]["content"][0]["text"])
    assert approve_payload["item"]["status"] == "approved"
    assert approve_payload.get("decision_id")


def test_mcp_busy_when_semaphore_saturated(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path, mcp_max_inflight=0)))
    admin = client.post(
        "/api/v1/auth/register",
        json={"email": "busy@example.com", "password": "password1", "display_name": "Busy"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/v1/kbs", headers=headers).json()["kbs"][0]["id"]

    resp = client.post(
        f"/api/v1/kbs/{kb_id}/mcp",
        headers=headers,
        json={"jsonrpc": "2.0", "id": 1, "method": "ping", "params": {}},
    )
    assert resp.status_code == 429
    assert resp.json()["detail"]["code"] == "mcp_busy"


def test_mcp_timeout(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path, mcp_timeout_seconds=1)))
    admin = client.post(
        "/api/v1/auth/register",
        json={"email": "to@example.com", "password": "password1", "display_name": "To"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/v1/kbs", headers=headers).json()["kbs"][0]["id"]

    def slow_batch(*_args, **_kwargs):
        time.sleep(2)
        return {"jsonrpc": "2.0", "id": 1, "result": {}}

    with patch("basis.transport.http.routes.v1.mcp.handle_batch", side_effect=slow_batch):
        resp = client.post(
            f"/api/v1/kbs/{kb_id}/mcp",
            headers=headers,
            json={"jsonrpc": "2.0", "id": 1, "method": "ping", "params": {}},
        )
    assert resp.status_code == 504
    assert resp.json()["detail"]["code"] == "mcp_timeout"
