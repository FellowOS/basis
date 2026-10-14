"""Chunk search HTTP limit cap."""

from pathlib import Path

from fastapi.testclient import TestClient

from sema.api.app import create_app
from sema.config import Settings
from sema.knowledge.blob_store import BlobStore
from sema.knowledge.store import KnowledgeStore
from sema.limits import CHUNK_SEARCH_MAX_LIMIT


def test_chunk_search_route_caps_limit(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)
    client = TestClient(create_app(settings))
    admin = client.post(
        "/api/auth/register",
        json={"email": "cap@example.com", "password": "password1", "display_name": "Cap"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]

    store = KnowledgeStore(tmp_path / "sema.db", BlobStore(tmp_path))
    _, version_id, _, _ = store.store_upload_bytes(
        kb_id,
        title="one.txt",
        mime_type="text/plain",
        data=b"alpha beta gamma",
        created_by=None,
        external_key="one",
    )
    store.create_chunk(kb_id, version_id, ordinal=0, text="alpha beta gamma delta")
    store.set_version_status(kb_id, version_id, "ready")
    store.close()

    res = client.get(
        f"/api/kbs/{kb_id}/search?q=alpha&limit=999",
        headers=headers,
    )
    assert res.status_code == 200
    chunks = res.json()["chunks"]
    assert len(chunks) <= CHUNK_SEARCH_MAX_LIMIT

    scoped = client.get(
        f"/api/kbs/{kb_id}/search?q=alpha&document_id=one",
        headers=headers,
    )
    assert scoped.status_code == 200
    assert len(scoped.json()["chunks"]) >= 1
