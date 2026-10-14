import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import psycopg
import pytest
from fastapi.testclient import TestClient
from psycopg import sql
from sqlalchemy.engine import make_url

from sema.api.app import create_app
from sema.config import Settings
from sema.database import reset_sqlite_database_pool


@pytest.fixture
def postgres_url() -> str:
    admin_url = os.environ.get("SEMA_TEST_POSTGRES_URL")
    if not admin_url:
        pytest.skip("SEMA_TEST_POSTGRES_URL is not configured")
    database = f"sema_test_{uuid.uuid4().hex}"
    parsed = make_url(admin_url)
    admin_dsn = parsed.set(database=parsed.database or "postgres").render_as_string(
        hide_password=False
    )
    with psycopg.connect(admin_dsn, autocommit=True) as conn:
        conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database)))
    test_url = parsed.set(database=database).render_as_string(hide_password=False)
    yield test_url
    reset_sqlite_database_pool()
    with psycopg.connect(admin_dsn, autocommit=True) as conn:
        conn.execute(
            sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(database))
        )


def test_postgres_ledger_fts_pgvector_and_mcp(
    tmp_path: Path, postgres_url: str
) -> None:
    client = TestClient(
        create_app(Settings(data_dir=tmp_path, database_url=postgres_url))
    )
    registered = client.post(
        "/api/auth/register",
        json={"email": "pg@example.com", "password": "password1", "display_name": "PG"},
    )
    assert registered.status_code == 200
    headers = {"Authorization": f"Bearer {registered.json()['token']}"}
    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]

    config = client.get(f"/api/kbs/{kb_id}/search/config", headers=headers).json()
    assert config["config"]["chunk_backend"] == "postgres_ledger"
    assert config["config"]["vector_backend"] == "pgvector"

    uploaded = client.post(
        f"/api/kbs/{kb_id}/documents/upload",
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
        f"/api/kbs/{kb_id}/search",
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
                    f"/api/kbs/{kb_id}/mcp", headers=headers, json=payload
                ),
                range(16),
            )
        )
    assert all(response.status_code == 200 for response in responses)
    client.close()
