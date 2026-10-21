"""KB hard delete purges ledger rows that block the knowledge_bases FK."""

from pathlib import Path

from basis.domain.knowledge.blob_store import BlobStore
from basis.domain.knowledge.store import KnowledgeStore
from basis.domain.tenancy.admin.store import AdminStore


def test_delete_kb_after_entities_exist(tmp_path: Path) -> None:
    db_path = tmp_path / "basis.db"
    admin = AdminStore(db_path)
    user, _ = admin.register("del@example.com", "password1", "U")
    kb_id = admin.create_kb(user, "Delete me", None, "restricted").id

    knowledge = KnowledgeStore(db_path, BlobStore(tmp_path))
    knowledge.create_entity(kb_id, canonical_label="Leftover")

    admin.delete_kb(user, kb_id)
    assert kb_id not in admin.list_kb_ids()
    admin.close()
