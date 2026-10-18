from pathlib import Path

import pytest

pytest.importorskip("semantica")

from basis.platform.admin.store import AdminStore
from basis.domain.graph.persistence import GraphPersistence
from basis.domain.graph.session import GraphSession
from basis.domain.kb.blob_store import BlobStore
from basis.domain.kb.store import KnowledgeStore
from basis.ops.migration.legacy_graph import migrate_legacy_graph


def _kb(tmp_path: Path) -> str:
    admin = AdminStore(tmp_path / "basis.db")
    user, _ = admin.register("m@example.com", "password1", "U")
    kb_id = admin.create_kb(user, "KB", None, "restricted").id
    admin.close()
    return kb_id


def _write_legacy_graph(persistence: GraphPersistence, kb_id: str) -> None:
    session = GraphSession()
    session.add_node("legacy-doc", "document", content="Contract text.")
    session.add_node("Alice", "entity", name="Alice")
    session.add_node("Bob", "entity", name="Bob")
    session.add_edge("Alice", "Bob", "employs")
    persistence.save(kb_id, session, projection_revision=0)


def test_legacy_migration_dry_run_and_apply_idempotent(tmp_path: Path) -> None:
    kb_id = _kb(tmp_path)
    persistence = GraphPersistence(tmp_path)
    knowledge = KnowledgeStore(tmp_path / "basis.db", BlobStore(tmp_path))
    _write_legacy_graph(persistence, kb_id)

    dry = migrate_legacy_graph(knowledge, persistence, kb_id, dry_run=True)
    assert dry.documents_seen == 1
    assert dry.entities_seen == 2
    assert dry.statements_seen == 1
    assert knowledge.find_document_by_external_key(kb_id, "legacy-doc") is None

    first = migrate_legacy_graph(knowledge, persistence, kb_id, dry_run=False)
    assert first.documents_created == 1
    assert first.statements_created == 1
    assert knowledge.find_document_by_external_key(kb_id, "legacy-doc") is not None
    assert knowledge.count_statements_for_version(
        kb_id, knowledge.find_document_by_external_key(kb_id, "legacy-doc")["version_id"]
    ) == 1

    second = migrate_legacy_graph(knowledge, persistence, kb_id, dry_run=False)
    assert second.documents_created == 0
    assert second.statements_created == 0

    graph_file = persistence.graph_path(kb_id)
    assert graph_file.is_file(), "legacy snapshot file must remain for rollback"
    knowledge.close()
