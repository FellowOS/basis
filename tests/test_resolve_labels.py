"""Batch node label resolution for review UI."""

from pathlib import Path

from fastapi.testclient import TestClient

from sema.admin.store import AdminStore
from sema.api.app import create_app
from sema.config import Settings
from sema.graph.projector import rebuild_graph_from_ledger
from sema.knowledge.blob_store import BlobStore
from sema.knowledge.store import KnowledgeStore


def test_resolve_labels_ledger_and_graph(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)
    app = create_app(settings)
    client = TestClient(app)
    admin = client.post(
        "/api/auth/register",
        json={"email": "lab@example.com", "password": "password1", "display_name": "Lab"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]

    knowledge: KnowledgeStore = app.state.knowledge_store
    alice = knowledge.create_entity(kb_id, canonical_label="Alice Ledger")
    session = rebuild_graph_from_ledger(knowledge, kb_id)
    revision = knowledge.bump_projection_revision(kb_id)
    app.state.graph_persistence.save(kb_id, session, projection_revision=revision)

    resp = client.post(
        f"/api/kbs/{kb_id}/graph/resolve-labels",
        headers=headers,
        json={"ids": [alice, "missing-node"]},
    )
    assert resp.status_code == 200
    labels = resp.json()["labels"]
    assert labels[alice] == "Alice Ledger"
    assert labels["missing-node"] is None
