from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fastapi.testclient import TestClient

from basis.interface.http.app import create_app
from basis.infra.runtime.config import Settings


def test_postgres_ledger_fts_pgvector_and_mcp(
    tmp_path: Path, postgres_url: str
) -> None:
    client = TestClient(
        create_app(Settings(data_dir=tmp_path, database_url=postgres_url))
    )
    registered = client.post(
        "/api/v1/auth/register",
        json={"email": "pg@example.com", "password": "password1", "display_name": "PG"},
    )
    assert registered.status_code == 200
    headers = {"Authorization": f"Bearer {registered.json()['token']}"}
    workspace_id = client.get("/api/v1/workspaces", headers=headers).json()["kbs"][0]["id"]

    config = client.get(f"/api/v1/workspaces/{workspace_id}/search/config", headers=headers).json()
    assert config["config"]["chunk_backend"] == "postgres_ledger"
    assert config["config"]["vector_backend"] == "pgvector"

    uploaded = client.post(
        f"/api/v1/workspaces/{workspace_id}/documents/upload",
        headers=headers,
        files={
            "file": (
                "postgres.txt",
                b"PostgreSQL hybrid retrieval supports concurrent MCP clients.",
                "text/plain",
            )
        },
        data={"extract": "false", "wait": "true"},
    )
    assert uploaded.status_code == 200
    assert uploaded.json()["embed_indexed"] == 1

    searched = client.get(
        f"/api/v1/workspaces/{workspace_id}/search",
        headers=headers,
        params={"q": "hybrid retrieval"},
    )
    assert searched.status_code == 200
    assert searched.json()["mode"] == "hybrid"
    assert searched.json()["chunks"]

    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": "search_chunks",
            "arguments": {"query": "PostgreSQL", "limit": 5},
        },
    }
    with ThreadPoolExecutor(max_workers=8) as pool:
        responses = list(
            pool.map(
                lambda _: client.post(
                    f"/api/v1/workspaces/{workspace_id}/mcp", headers=headers, json=payload
                ),
                range(16),
            )
        )
    assert all(response.status_code == 200 for response in responses)
    client.close()


def test_postgres_kb_graph_audit_list(tmp_path: Path, postgres_url: str) -> None:
    client = TestClient(
        create_app(Settings(data_dir=tmp_path, database_url=postgres_url))
    )
    registered = client.post(
        "/api/v1/auth/register",
        json={"email": "audit@example.com", "password": "password1", "display_name": "A"},
    )
    assert registered.status_code == 200
    headers = {"Authorization": f"Bearer {registered.json()['token']}"}
    workspace_id = client.get("/api/v1/workspaces", headers=headers).json()["kbs"][0]["id"]
    audit = client.get(
        f"/api/v1/workspaces/{workspace_id}/audit/graph-mutations",
        headers=headers,
    )
    assert audit.status_code == 200
    assert "events" in audit.json()
    client.close()
