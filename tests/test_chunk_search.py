from pathlib import Path

import pytest

pytest.importorskip("semantica")

from fastapi.testclient import TestClient

from basis.admin.store import AdminStore
from basis.api.app import create_app
from basis.config import Settings
from basis.knowledge.blob_store import BlobStore
from basis.knowledge.chunk_search import ChunkSearchService
from basis.knowledge.store import KnowledgeStore
from basis.pipeline.document import TextIngestOptions
from basis.pipeline.version_ingest import run_version_ingest
from basis.graph.session import GraphSession


def _setup_kb(tmp_path: Path) -> tuple[str, KnowledgeStore, ChunkSearchService, AdminStore]:
    db = tmp_path / "basis.db"
    admin = AdminStore(db)
    user, _ = admin.register("search@example.com", "password1", "U")
    kb = admin.create_kb(user, "KB", None, "restricted")
    blobs = BlobStore(tmp_path)
    knowledge = KnowledgeStore(db, blobs)
    search = ChunkSearchService(knowledge, admin, tmp_path)
    return kb.id, knowledge, search, admin


def test_index_and_hybrid_search(tmp_path: Path) -> None:
    kb_id, knowledge, search, admin = _setup_kb(tmp_path)
    text = b"The capital of France is Paris. Paris has the Eiffel Tower."
    _, version_id, job_id, doc_id = knowledge.store_upload_bytes(
        kb_id,
        title="geo.txt",
        mime_type="text/plain",
        data=text,
        created_by=None,
        external_key="geo",
    )
    graph = GraphSession()
    result = run_version_ingest(
        knowledge,
        graph,
        kb_id,
        version_id,
        job_id,
        filename="geo.txt",
        graph_doc_id=doc_id,
        options=TextIngestOptions(extract=False, chunk=True, chunk_size=200),
        chunk_search=search,
    )
    assert result.get("embed_indexed", 0) >= 1

    out = search.search(kb_id, query="Paris", limit=5)
    assert out["chunks"]
    assert any("Paris" in c.get("text", "") for c in out["chunks"])
    assert "keyword_score" in knowledge.search_chunks_keyword(
        kb_id, query="capital", limit=5
    )[0]
    assert knowledge.search_chunks_keyword(kb_id, query="of", limit=5)

    admin.close()
    knowledge.close()


def test_search_api(tmp_path: Path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    reg = client.post(
        "/api/auth/register",
        json={"email": "api@example.com", "password": "password1", "display_name": "U"},
    ).json()
    headers = {"Authorization": f"Bearer {reg['token']}"}
    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]
    files = {"file": ("note.txt", b"Semantic retrieval test content about Berlin.", "text/plain")}
    client.post(
        f"/api/kbs/{kb_id}/documents/upload",
        headers=headers,
        files=files,
        data={"extract": "false", "wait": "true"},
    )
    resp = client.get(f"/api/kbs/{kb_id}/search", headers=headers, params={"q": "Berlin"})
    assert resp.status_code == 200
    body = resp.json()
    assert body.get("chunks") is not None
    assert body.get("mode") in ("none", "keyword", "hybrid", "semantic")

    future = client.get(
        f"/api/kbs/{kb_id}/search",
        headers=headers,
        params={"q": "Berlin", "created_after": "2099-01-01T00:00:00Z"},
    )
    assert future.status_code == 200
    assert future.json().get("chunks") == []

    past = client.get(
        f"/api/kbs/{kb_id}/search",
        headers=headers,
        params={"q": "Berlin", "as_of": "2000-01-01T00:00:00Z"},
    )
    assert past.status_code == 200
    assert past.json().get("chunks") == []
    assert past.json().get("filters", {}).get("as_of") == "2000-01-01T00:00:00Z"


def test_kb_search_config_controls_modes(tmp_path: Path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    reg = client.post(
        "/api/auth/register",
        json={"email": "config@example.com", "password": "password1", "display_name": "U"},
    ).json()
    headers = {"Authorization": f"Bearer {reg['token']}"}
    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]

    initial = client.get(f"/api/kbs/{kb_id}/search/config", headers=headers)
    assert initial.status_code == 200
    assert initial.json()["config"]["vector_backend"] == "sqlite_vec"
    assert initial.json()["status"]["storage_ready"] is True

    updated = client.put(
        f"/api/kbs/{kb_id}/search/config",
        headers=headers,
        json={
            "chunk_backend": "sqlite_ledger",
            "vector_backend": "sqlite_vec",
            "keyword_enabled": True,
            "semantic_enabled": False,
            "default_mode": "keyword",
            "auto_index": False,
        },
    )
    assert updated.status_code == 200
    assert updated.json()["config"]["semantic_enabled"] is False
    assert updated.json()["status"]["vector_state"] == "disabled"

    disabled = client.get(
        f"/api/kbs/{kb_id}/search",
        headers=headers,
        params={"q": "anything", "mode": "semantic"},
    )
    assert disabled.status_code == 409
