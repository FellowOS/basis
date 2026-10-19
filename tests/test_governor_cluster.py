"""Entity label clustering (F-GOV-04 Phase C)."""

from pathlib import Path

from basis.domain.kb.blob_store import BlobStore
from basis.domain.kb.governor_cluster import (
    ENTITY_CLUSTER_KIND,
    find_entity_label_clusters,
    scan_entity_label_clusters,
)
from basis.domain.kb.store import KnowledgeStore


def _kb(tmp_path: Path) -> tuple[str, KnowledgeStore]:
    from basis.platform.admin.store import AdminStore

    admin = AdminStore(tmp_path / "basis.db")
    user, _ = admin.register("cl@example.com", "password1", "Cl")
    kb_id = admin.create_kb(user, "Cl KB", None, "restricted").id
    admin.close()
    store = KnowledgeStore(tmp_path / "basis.db", BlobStore(tmp_path))
    return kb_id, store


def test_find_clusters_same_label(tmp_path: Path) -> None:
    kb_id, store = _kb(tmp_path)
    store.create_entity(kb_id, canonical_label="Alice")
    store.create_entity(kb_id, canonical_label="alice")
    store.create_entity(kb_id, canonical_label="Bob")
    clusters = find_entity_label_clusters(store, kb_id)
    assert len(clusters) == 1
    assert len(clusters[0]["entity_ids"]) == 2


def test_scan_enqueues_cluster_review(tmp_path: Path) -> None:
    kb_id, store = _kb(tmp_path)
    store.create_entity(kb_id, canonical_label="Dup")
    store.create_entity(kb_id, canonical_label="Dup")
    result = scan_entity_label_clusters(store, kb_id)
    assert result["created"] == 1
    items = store.list_review_items(kb_id, kind=ENTITY_CLUSTER_KIND)
    assert len(items) == 1
