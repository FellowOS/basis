"""Ledger entity_merges rows and review approve wiring."""

from pathlib import Path

import pytest

pytest.importorskip("semantica")

from fastapi.testclient import TestClient

from basis.platform.admin.store import AdminStore
from basis.transport.http.app import create_app
from basis.infra.capabilities import explorer_available
from basis.infra.config import Settings
from basis.domain.graph.projector import rebuild_graph_from_ledger
from basis.domain.graph.persistence import GraphPersistence
from basis.domain.kb.blob_store import BlobStore
from basis.domain.kb.store import KnowledgeStore


def test_record_and_list_entity_merges(tmp_path: Path) -> None:
    admin = AdminStore(tmp_path / "basis.db")
    user, _ = admin.register("em@example.com", "password1", "U")
    kb_id = admin.create_kb(user, "KB", None, "restricted").id
    actor_id = user.id
    admin.close()

    store = KnowledgeStore(tmp_path / "basis.db", BlobStore(tmp_path))
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
        "/api/v1/auth/register",
        json={"email": "ap@example.com", "password": "password1", "display_name": "Ap"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/v1/kbs", headers=headers).json()["kbs"][0]["id"]

    knowledge: KnowledgeStore = app.state.knowledge_store
    primary = knowledge.create_entity(kb_id, canonical_label="Alice")
    duplicate = knowledge.create_entity(kb_id, canonical_label="Alice duplicate")
    session = rebuild_graph_from_ledger(knowledge, kb_id)
    revision = knowledge.bump_projection_revision(kb_id)
    app.state.graph_persistence.save(kb_id, session, projection_revision=revision)
    app.state.explorer_registry.invalidate(kb_id)

    proposed = client.post(
        f"/api/v1/kbs/{kb_id}/review/items/entity-merge",
        headers=headers,
        json={"primary_id": primary, "duplicate_ids": [duplicate]},
    )
    assert proposed.status_code == 200
    item_id = proposed.json()["item"]["id"]

    approved = client.post(
        f"/api/v1/kbs/{kb_id}/review/items/{item_id}/approve",
        headers=headers,
        json={"rationale": "confirmed duplicate"},
    )
    assert approved.status_code == 200

    merges = client.get(f"/api/v1/kbs/{kb_id}/ledger/entity-merges", headers=headers)
    assert merges.status_code == 200
    rows = merges.json()["merges"]
    assert len(rows) == 1
    assert rows[0]["source_entity_id"] == duplicate
    assert rows[0]["target_entity_id"] == primary
    assert rows[0]["why"] == "confirmed duplicate"

    from basis.domain.graph.persistence import GraphPersistence

    loaded, _ = GraphPersistence(tmp_path).load_snapshot(kb_id)
    node_ids = sorted(loaded.graph.nodes.keys())
    assert duplicate not in node_ids
    assert primary in node_ids


def test_revert_entity_merge(tmp_path: Path) -> None:
    admin = AdminStore(tmp_path / "basis.db")
    user, _ = admin.register("rev@example.com", "password1", "U")
    kb_id = admin.create_kb(user, "KB", None, "restricted").id
    actor_id = user.id
    admin.close()

    store = KnowledgeStore(tmp_path / "basis.db", BlobStore(tmp_path))
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


def test_revert_entity_merge_refreshes_explorer_nodes(tmp_path: Path) -> None:
    if not explorer_available():
        pytest.skip("explorer extra not installed")

    settings = Settings(data_dir=tmp_path)
    app = create_app(settings)
    client = TestClient(app)
    admin = client.post(
        "/api/v1/auth/register",
        json={"email": "revx@example.com", "password": "password1", "display_name": "Rev"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/v1/kbs", headers=headers).json()["kbs"][0]["id"]
    knowledge: KnowledgeStore = app.state.knowledge_store

    _, version_id, _, _ = knowledge.store_upload_bytes(
        kb_id,
        title="t.txt",
        mime_type="text/plain",
        data=b"x",
        created_by=None,
        external_key="doc-revert-explorer",
    )
    chunk_id = knowledge.create_chunk(kb_id, version_id, ordinal=0, text="Alice knows Bob.")
    knowledge.set_version_status(kb_id, version_id, "ready")
    alice = knowledge.create_entity(kb_id, canonical_label="Alice")
    bob = knowledge.create_entity(kb_id, canonical_label="Bob")
    knowledge.add_open_statement(
        kb_id,
        subject_id=alice,
        surface_phrase="knows",
        object_entity_id=bob,
        object_value=None,
        status="confirmed",
        proposed_by="test",
        chunk_id=chunk_id,
        quote="knows Bob",
    )
    session = rebuild_graph_from_ledger(knowledge, kb_id)
    ledger = knowledge.get_projection_state(kb_id)
    app.state.graph_persistence.save(
        kb_id,
        session,
        projection_revision=ledger["revision"],
        schema_version=ledger["schema_version"],
    )
    app.state.graphs[kb_id] = session

    merge_row = knowledge.record_entity_merge(
        kb_id,
        source_entity_id=bob,
        target_entity_id=alice,
        actor_id=admin["user"]["id"],
    )
    rebuild = client.post(f"/api/v1/kbs/{kb_id}/graph/rebuild", headers=headers)
    assert rebuild.status_code == 200

    def entity_node_ids() -> set[str]:
        resp = client.get(
            f"/api/v1/kbs/{kb_id}/graph/nodes",
            headers=headers,
            params={"node_type": "entity", "limit": 100},
        )
        assert resp.status_code == 200
        return {n["id"] for n in resp.json()["nodes"]}

    merged_ids = entity_node_ids()
    assert alice in merged_ids
    assert bob not in merged_ids
    # Warm Explorer registry cache (same revision as post-rebuild).
    assert entity_node_ids() == merged_ids

    revert = client.post(
        f"/api/v1/kbs/{kb_id}/ledger/entity-merges/{merge_row['id']}/revert",
        headers=headers,
    )
    assert revert.status_code == 200

    split_ids = entity_node_ids()
    assert alice in split_ids and bob in split_ids


def test_revert_entity_merge_http(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)
    app = create_app(settings)
    client = TestClient(app)
    admin = client.post(
        "/api/v1/auth/register",
        json={"email": "http@example.com", "password": "password1", "display_name": "Http"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/v1/kbs", headers=headers).json()["kbs"][0]["id"]
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
        f"/api/v1/kbs/{kb_id}/ledger/entity-merges/{row['id']}/revert",
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["merge"]["reverted_at"] is not None
