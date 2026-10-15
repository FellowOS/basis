"""Statement conflict detection → review queue (F-RUL-04)."""

from pathlib import Path

from fastapi.testclient import TestClient

from basis.api.app import create_app
from basis.config import Settings
from basis.knowledge.blob_store import BlobStore
from basis.knowledge.conflict_review import (
    STATEMENT_CONFLICT_KIND,
    find_statement_conflict_groups,
    scan_statement_conflicts,
)
from basis.knowledge.store import KnowledgeStore


def _kb(tmp_path: Path) -> tuple[str, KnowledgeStore]:
    from basis.admin.store import AdminStore

    admin = AdminStore(tmp_path / "basis.db")
    user, _ = admin.register("conf@example.com", "password1", "Conf")
    kb_id = admin.create_kb(user, "Conf KB", None, "restricted").id
    admin.close()
    store = KnowledgeStore(tmp_path / "basis.db", BlobStore(tmp_path))
    return kb_id, store


def _chunk(store: KnowledgeStore, kb_id: str) -> str:
    _, version_id, _, _ = store.store_upload_bytes(
        kb_id,
        title="t.txt",
        mime_type="text/plain",
        data=b"x",
        created_by=None,
        external_key="conf-doc",
    )
    chunk_id = store.create_chunk(kb_id, version_id, ordinal=0, text="evidence")
    store.set_version_status(kb_id, version_id, "ready")
    return chunk_id


def test_find_conflicts_same_predicate_different_objects(tmp_path: Path) -> None:
    kb_id, store = _kb(tmp_path)
    chunk_id = _chunk(store, kb_id)
    alice = store.create_entity(kb_id, canonical_label="Alice")
    bob = store.create_entity(kb_id, canonical_label="Bob")
    carol = store.create_entity(kb_id, canonical_label="Carol")
    store.add_open_statement(
        kb_id,
        subject_id=alice,
        surface_phrase="knows",
        object_entity_id=bob,
        object_value=None,
        status="confirmed",
        proposed_by="test",
        chunk_id=chunk_id,
        quote="knows",
    )
    store.add_open_statement(
        kb_id,
        subject_id=alice,
        surface_phrase="knows",
        object_entity_id=carol,
        object_value=None,
        status="confirmed",
        proposed_by="test",
        chunk_id=chunk_id,
        quote="knows",
    )
    groups = find_statement_conflict_groups(store, kb_id)
    assert len(groups) == 1
    assert len(groups[0]["statement_ids"]) == 2


def test_scan_enqueues_review_item(tmp_path: Path) -> None:
    kb_id, store = _kb(tmp_path)
    chunk_id = _chunk(store, kb_id)
    alice = store.create_entity(kb_id, canonical_label="Alice")
    bob = store.create_entity(kb_id, canonical_label="Bob")
    carol = store.create_entity(kb_id, canonical_label="Carol")
    store.add_open_statement(
        kb_id,
        subject_id=alice,
        surface_phrase="employed_by",
        object_entity_id=bob,
        object_value=None,
        status="confirmed",
        proposed_by="test",
        chunk_id=chunk_id,
        quote="employed_by",
    )
    store.add_open_statement(
        kb_id,
        subject_id=alice,
        surface_phrase="employed_by",
        object_entity_id=carol,
        object_value=None,
        status="confirmed",
        proposed_by="test",
        chunk_id=chunk_id,
        quote="employed_by",
    )
    out = scan_statement_conflicts(store, kb_id)
    assert out["created"] == 1
    items = store.list_review_items(kb_id, kind=STATEMENT_CONFLICT_KIND)
    assert len(items) == 1
    assert items[0]["payload"]["surface_phrase"] == "employed_by"


def test_acknowledge_conflict_review_item(tmp_path: Path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/auth/register",
        json={"email": "rc@example.com", "password": "password1", "display_name": "RC"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]
    store = KnowledgeStore(tmp_path / "basis.db", BlobStore(tmp_path))
    chunk_id = _chunk(store, kb_id)
    alice = store.create_entity(kb_id, canonical_label="Alice")
    bob = store.create_entity(kb_id, canonical_label="Bob")
    carol = store.create_entity(kb_id, canonical_label="Carol")
    store.add_open_statement(
        kb_id,
        subject_id=alice,
        surface_phrase="likes",
        object_entity_id=bob,
        object_value=None,
        status="confirmed",
        proposed_by="test",
        chunk_id=chunk_id,
        quote="likes",
    )
    store.add_open_statement(
        kb_id,
        subject_id=alice,
        surface_phrase="likes",
        object_entity_id=carol,
        object_value=None,
        status="confirmed",
        proposed_by="test",
        chunk_id=chunk_id,
        quote="likes",
    )
    scan_statement_conflicts(store, kb_id)
    item_id = store.list_review_items(kb_id, kind=STATEMENT_CONFLICT_KIND)[0]["id"]

    approved = client.post(
        f"/api/kbs/{kb_id}/review/items/{item_id}/approve",
        headers=headers,
        json={"rationale": "reviewed"},
    )
    assert approved.status_code == 200
    assert approved.json()["item"]["status"] == "approved"
