"""KB MCP HTTP and API tokens."""

from fastapi.testclient import TestClient

from sema.api.app import create_app
from sema.config import Settings


def test_mcp_tools_with_api_token(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/auth/register",
        json={"email": "mcp@example.com", "password": "password1", "display_name": "M"},
    ).json()
    session_headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/kbs", headers=session_headers).json()["kbs"][0]["id"]
    client.post(
        f"/api/kbs/{kb_id}/documents",
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
        f"/api/kbs/{kb_id}/tokens",
        headers=session_headers,
        json={"name": "agent", "scope": "read"},
    )
    assert created.status_code == 200
    secret = created.json()["secret"]
    listed = client.get(f"/api/kbs/{kb_id}/tokens", headers=session_headers).json()
    assert listed["tokens"][0].get("secret") == secret
    api_headers = {"Authorization": f"Bearer {secret}"}

    info = client.get(f"/api/kbs/{kb_id}/mcp", headers=api_headers)
    assert info.status_code == 200
    assert info.json()["mcp_url"].endswith(f"/api/kbs/{kb_id}/mcp")

    init = client.post(
        f"/api/kbs/{kb_id}/mcp",
        headers=api_headers,
        json={"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}},
    )
    assert init.status_code == 200
    assert init.json()["result"]["serverInfo"]["name"] == "sema-kb-mcp"

    tools = client.post(
        f"/api/kbs/{kb_id}/mcp",
        headers=api_headers,
        json={"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}},
    ).json()
    names = {t["name"] for t in tools["result"]["tools"]}
    assert "search_chunks" in names

    search = client.post(
        f"/api/kbs/{kb_id}/mcp",
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
        "/api/kbs/00000000-0000-0000-0000-000000000000/mcp",
        headers=api_headers,
        json={"jsonrpc": "2.0", "id": 4, "method": "ping", "params": {}},
    )
    assert wrong_kb.status_code == 403
