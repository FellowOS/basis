"""Ledger entity_merges rows and review approve wiring."""

from pathlib import Path

import pytest

pytest.importorskip("semantica")

from fastapi.testclient import TestClient

from sema.admin.store import AdminStore
from sema.api.app import create_app
from sema.capabilities import explorer_available
from sema.config import Settings
from sema.graph.projector import rebuild_graph_from_ledger
from sema.graph.persistence import GraphPersistence
from sema.knowledge.blob_store import BlobStore
from sema.knowledge.store import KnowledgeStore


def test_record_and_list_entity_merges(tmp_path: Path) -> None:
    admin = AdminStore(tmp_path / "sema.db")
    user, _ = admin.register("em@example.com", "password1", "U")
    kb_id = admin.create_kb(user, "KB", None, "restricted").id
    actor_id = user.id
    admin.close()

    store = KnowledgeStore(tmp_path / "sema.db", BlobStore(tmp_path))
    source = store.create_entity(kb_id, canonical_label="Dup")
    target = store.create_entity(kb_id, canonical_label="Primary")
    row = store.record_entity_merge(
        kb_id,
        source_entity_id=source,
        target_entity_id=target,
        actor_id=actor_id,
        why="same person",
    )
    assert row["source_entity_id"] == source
    assert row["target_entity_id"] == target
    assert row["reverted_at"] is None

    listed = store.list_entity_merges(kb_id)
    assert len(listed) == 1
    assert listed[0]["id"] == row["id"]


def test_approve_entity_merge_records_ledger_rows(tmp_path: Path) -> None:
    if not explorer_available():
        pytest.skip("explorer extra not installed")

    settings = Settings(data_dir=tmp_path)
    app = create_app(settings)
    client = TestClient(app)
    admin = client.post(
        "/api/auth/register",
        json={"email": "ap@example.com", "password": "password1", "display_name": "Ap"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]

    knowledge: KnowledgeStore = app.state.knowledge_store
    primary = knowledge.create_entity(kb_id, canonical_label="Alice")
    duplicate = knowledge.create_entity(kb_id, canonical_label="Alice duplicate")
    session = rebuild_graph_from_ledger(knowledge, kb_id)
    revision = knowledge.bump_projection_revision(kb_id)
    app.state.graph_persistence.save(kb_id, session, projection_revision=revision)
    app.state.explorer_registry.invalidate(kb_id)

    proposed = client.post(
        f"/api/kbs/{kb_id}/review/items/entity-merge",
        headers=headers,
        json={"primary_id": primary, "duplicate_ids": [duplicate]},
    )
    assert proposed.status_code == 200
    item_id = proposed.json()["item"]["id"]

    approved = client.post(
        f"/api/kbs/{kb_id}/review/items/{item_id}/approve",
        headers=headers,
        json={"rationale": "confirmed duplicate"},
    )
    assert approved.status_code == 200

    merges = client.get(f"/api/kbs/{kb_id}/ledger/entity-merges", headers=headers)
    assert merges.status_code == 200
    rows = merges.json()["merges"]
    assert len(rows) == 1
    assert rows[0]["source_entity_id"] == duplicate
    assert rows[0]["target_entity_id"] == primary
    assert rows[0]["why"] == "confirmed duplicate"

    from sema.graph.persistence import GraphPersistence

    loaded, _ = GraphPersistence(tmp_path).load_snapshot(kb_id)
    node_ids = sorted(loaded.graph.nodes.keys())
    assert duplicate not in node_ids
    assert primary in node_ids


def test_revert_entity_merge(tmp_path: Path) -> None:
    admin = AdminStore(tmp_path / "sema.db")
    user, _ = admin.register("rev@example.com", "password1", "U")
    kb_id = admin.create_kb(user, "KB", None, "restricted").id
    actor_id = user.id
    admin.close()

    store = KnowledgeStore(tmp_path / "sema.db", BlobStore(tmp_path))
    source = store.create_entity(kb_id, canonical_label="X")
    target = store.create_entity(kb_id, canonical_label="Y")
    row = store.record_entity_merge(
        kb_id,
        source_entity_id=source,
        target_entity_id=target,
        actor_id=actor_id,
    )
    reverted = store.revert_entity_merge(kb_id, row["id"], reverted_by=actor_id)
    assert reverted["reverted_at"] is not None
    assert reverted["reverted_by"] == actor_id
    assert store.list_entity_merges(kb_id, active_only=True) == []
    assert len(store.list_entity_merges(kb_id, active_only=False)) == 1


def test_revert_entity_merge_http(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)
    app = create_app(settings)
    client = TestClient(app)
    admin = client.post(
        "/api/auth/register",
        json={"email": "http@example.com", "password": "password1", "display_name": "Http"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]
    knowledge: KnowledgeStore = app.state.knowledge_store
    source = knowledge.create_entity(kb_id, canonical_label="S")
    target = knowledge.create_entity(kb_id, canonical_label="T")
    row = knowledge.record_entity_merge(
        kb_id,
        source_entity_id=source,
        target_entity_id=target,
        actor_id=admin["user"]["id"],
    )
    resp = client.post(
        f"/api/kbs/{kb_id}/ledger/entity-merges/{row['id']}/revert",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["merge"]["reverted_at"] is not None
