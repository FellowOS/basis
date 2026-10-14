from pathlib import Path

from sema.admin.store import AdminStore
from sema.knowledge.blob_store import BlobStore
from sema.knowledge.store import KnowledgeStore
from sema.pipeline.ledger_extract import apply_kg_to_ledger


def _kb_and_chunk(tmp_path: Path) -> tuple[KnowledgeStore, str, str, str]:
    admin = AdminStore(tmp_path / "sema.db")
    user, _ = admin.register("ledger@example.com", "password1", "U")
    kb_id = admin.create_kb(user, "KB", None, "restricted").id
    admin.close()
    blobs = BlobStore(tmp_path)
    store = KnowledgeStore(tmp_path / "sema.db", blobs)
    _, version_id, _, _ = store.store_upload_bytes(
        kb_id,
        title="doc.txt",
        mime_type="text/plain",
        data=b"x",
        created_by=None,
    )
    chunk_id = store.create_chunk(
        kb_id, version_id, ordinal=0, text="Alice knows Bob."
    )
    return store, kb_id, version_id, chunk_id


def test_apply_kg_to_ledger_writes_statement_with_evidence(tmp_path: Path) -> None:
    store, kb_id, version_id, chunk_id = _kb_and_chunk(tmp_path)
    kg = {
        "entities": [
            {"id": "Alice", "name": "Alice"},
            {"id": "Bob", "name": "Bob"},
        ],
        "relationships": [
            {"source": "Alice", "target": "Bob", "predicate": "knows", "confidence": 0.9},
        ],
    }
    stats = apply_kg_to_ledger(
        store,
        kb_id,
        version_id,
        chunk_id,
        "Alice knows Bob.",
        kg,
        proposed_by="test:pattern",
    )
    assert stats["ledger_statements_written"] == 1
    assert store.count_statements_for_version(kb_id, version_id) == 1
    store.close()


def test_apply_kg_to_ledger_skips_duplicate_and_records_drop(tmp_path: Path) -> None:
    store, kb_id, version_id, chunk_id = _kb_and_chunk(tmp_path)
    bad = {"relationships": [{"source": None, "target": "Bob"}]}
    stats = apply_kg_to_ledger(
        store,
        kb_id,
        version_id,
        chunk_id,
        "Alice knows Bob.",
        bad,
        proposed_by="test",
    )
    assert stats["ledger_drops_recorded"] == 1

    good = {
        "entities": [{"name": "Alice"}, {"name": "Bob"}],
        "relationships": [{"source": "Alice", "target": "Bob", "predicate": "knows"}],
    }
    first = apply_kg_to_ledger(
        store, kb_id, version_id, chunk_id, "Alice knows Bob.", good, proposed_by="test"
    )
    second = apply_kg_to_ledger(
        store, kb_id, version_id, chunk_id, "Alice knows Bob.", good, proposed_by="test"
    )
    assert first["ledger_statements_written"] == 1
    assert second["ledger_statements_written"] == 0
    assert store.count_statements_for_version(kb_id, version_id) == 1
    store.close()
