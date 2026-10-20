"""KnowledgeStore façade: DB lock, blob store, scope guards, delegates to ``access/*``."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from basis.runtime.database import Database, get_sqlite_database
from basis.core.ledger.blob_store import BlobStore
from basis.core.ledger.access.connector import ConnectorKbAccess
from basis.core.ledger.access.governance import GovernanceAccess
from basis.core.ledger.access.document_delete import DocumentDeleteAccess
from basis.core.ledger.access.entity_delete import EntityDeleteAccess
from basis.core.ledger.access.entity_merges import EntityMergesAccess
from basis.core.ledger.access.explorer import ExplorerKbAccess
from basis.core.ledger.access.documents import DocumentsAccess
from basis.core.ledger.access.ingest_ledger import IngestLedgerAccess
from basis.core.ledger.access.ledger import LedgerAccess
from basis.core.ledger.access.ingest_sources import IngestSourcesAccess
from basis.core.ledger.access.kb_alerts import KbAlertsAccess
from basis.core.ledger.access.reasoning_rules import ReasoningRulesAccess
from basis.core.ledger.access.processing import ProcessingJobsAccess
from basis.core.ledger.access.facts import FactsAccess
from basis.core.ledger.access.mappings import MappingsAccess
from basis.core.ledger.access.projection import ProjectionAccess
from basis.core.ledger.access.review import ReviewAccess, merge_review_subject_key
from basis.core.ledger.access.search import SearchAccess
from basis.core.ledger.persistence import guards as ledger_guards


class KnowledgeStore:
    """Canonical ledger access shared with AdminStore."""

    def __init__(self, db_path: Path | Database, blob_store: BlobStore) -> None:
        self._blob_store = blob_store
        if isinstance(db_path, Database):
            self._db = db_path
            self._owns_db_ref = False
        else:
            self._db = get_sqlite_database(db_path)
            self._owns_db_ref = True
        self._lock = self._db.lock
        self._conn = self._db.conn
        self._connector = ConnectorKbAccess(self)
        self._explorer = ExplorerKbAccess(self)
        self._entity_delete = EntityDeleteAccess(self)
        self._entity_merges = EntityMergesAccess(self)
        self._document_delete = DocumentDeleteAccess(self)
        self._processing = ProcessingJobsAccess(self)
        self._documents = DocumentsAccess(self)
        self._ingest_ledger = IngestLedgerAccess(self)
        self._review = ReviewAccess(self)
        self._mappings = MappingsAccess(self)
        self._projection = ProjectionAccess(self)
        self._facts = FactsAccess(self)
        self._ingest_sources = IngestSourcesAccess(self)
        self._reasoning_rules = ReasoningRulesAccess(self)
        self._kb_alerts = KbAlertsAccess(self)
        self._governance = GovernanceAccess(self)
        self._search = SearchAccess(self)
        self._ledger = LedgerAccess(self)

    def close(self) -> None:
        if self._owns_db_ref:
            self._db.release()

    @property
    def database(self) -> Database:
        return self._db

    def hard_delete_document(self, kb_id: str, document_id: str) -> dict[str, Any]:
        return self._document_delete.execute_hard_delete_document(kb_id, document_id)

    def delete_entity(self, kb_id: str, entity_id: str) -> dict[str, Any]:
        return self._entity_delete.execute_delete_entity(kb_id, entity_id)

    PROJECTION_SCHEMA_VERSION = 1

    def merge_review_subject_key(primary_id: str, duplicate_ids: list[str]) -> str:
        return merge_review_subject_key(primary_id, duplicate_ids)

    def _assert_kb_exists(self, kb_id: str) -> None:
        ledger_guards.assert_kb_exists(self._conn, kb_id)

    def _assert_row_in_kb(self, table: str, row_id: str, kb_id: str) -> None:
        ledger_guards.assert_row_in_kb(self._conn, table, row_id, kb_id)

def _kb_access_delegate(access_attr: str, method_name: str):
    def _wrapped(self, *args, **kwargs):
        return getattr(getattr(self, access_attr), method_name)(*args, **kwargs)

    _wrapped.__name__ = method_name
    _wrapped.__qualname__ = f"KnowledgeStore.{method_name}"
    return _wrapped


for _name in (
    "connector_vault_persistence",
    "connector_sync_persistence",
    "get_platform_allowed_providers",
    "connector_runtime",
    "connector_sync_service",
    "list_source_table_mapping_ids",
    "list_entity_sync_outbox_ids",
    "reject_entity_sync_outbox",
    "list_kb_connector_runs",
    "list_active_connector_table_mappings_global",
):
    setattr(KnowledgeStore, _name, _kb_access_delegate("_connector", _name))

for _name in ("graph_staging_at", "upsert_graph_staging_session"):
    setattr(KnowledgeStore, _name, _kb_access_delegate("_explorer", _name))

for _name in ("preview_entity_deletion", "execute_delete_entity"):
    setattr(KnowledgeStore, _name, _kb_access_delegate("_entity_delete", _name))

for _name in (
    "store_upload_bytes",
    "store_document_bytes",
    "append_document_version",
    "get_document_summary",
    "resolve_document_ref",
    "find_document_by_external_key",
    "first_chunk_id_for_version",
    "ensure_legacy_document",
    "list_documents",
    "read_version_bytes",
    "list_chunks_for_version",
):
    setattr(KnowledgeStore, _name, _kb_access_delegate("_documents", _name))

for _name in (
    "find_processing_job_by_idempotency_key",
    "create_processing_job",
    "get_version",
    "get_processing_context",
    "get_job",
    "list_processing_jobs",
    "set_job_result",
    "set_version_status",
    "set_job_status",
    "fail_version",
    "fail_job",
):
    setattr(KnowledgeStore, _name, _kb_access_delegate("_processing", _name))

for _name in (
    "get_or_create_entity_by_label",
    "create_entity",
    "count_entities_named",
    "has_statement_on_chunk",
    "has_equivalent_statement",
    "add_extraction_drop",
    "count_statements_for_version",
    "add_open_statement",
    "create_chunk",
    "create_chunks",
    "set_statement_status",
    "invalidate_statement",
):
    setattr(KnowledgeStore, _name, _kb_access_delegate("_ingest_ledger", _name))

for _name in (
    "create_review_item",
    "list_review_items",
    "find_open_review_item",
    "get_review_item",
    "resolve_review_item",
):
    setattr(KnowledgeStore, _name, _kb_access_delegate("_review", _name))

for _name in (
    "list_mappings",
    "create_mapping",
    "get_mapping",
    "update_mapping_status",
    "list_distinct_surface_phrases",
    "materialize_mapping_facts",
):
    setattr(KnowledgeStore, _name, _kb_access_delegate("_mappings", _name))

for _name in (
    "get_ledger_temporal_bounds",
    "ensure_projection_state",
    "get_projection_state",
    "set_projection_status",
    "bump_projection_revision",
    "list_ready_documents_for_projection",
    "list_entities_for_projection",
    "list_statements_for_projection",
    "list_statements_for_temporal_projection",
    "list_entities_for_temporal_projection",
    "list_typed_facts_for_temporal_projection",
    "list_derived_facts_for_temporal_projection",
    "list_typed_facts_for_projection",
    "list_derived_facts_for_projection",
):
    setattr(KnowledgeStore, _name, _kb_access_delegate("_projection", _name))

for _name in (
    "list_typed_facts",
    "insert_derived_fact",
    "list_derived_facts",
    "list_derived_facts_for_entity",
):
    setattr(KnowledgeStore, _name, _kb_access_delegate("_facts", _name))

for _name in (
    "entity_labels_by_ids",
    "ledger_entity_exists",
    "record_agent_decision",
    "record_entity_merge",
    "entity_merge_redirect",
    "revert_entity_merge",
    "list_entity_merges",
):
    setattr(KnowledgeStore, _name, _kb_access_delegate("_entity_merges", _name))

for _name in (
    "list_scheduled_ingest_sources_global",
    "list_http_poll_sources_global",
    "list_ingest_sources",
    "create_ingest_source",
    "get_ingest_source",
    "get_ingest_source_secret",
    "update_ingest_source",
    "delete_ingest_source",
    "rotate_ingest_source_token",
):
    setattr(KnowledgeStore, _name, _kb_access_delegate("_ingest_sources", _name))

for _name in (
    "list_reasoning_rules",
    "create_reasoning_rule",
    "get_reasoning_rule",
    "update_reasoning_rule",
    "delete_reasoning_rule",
):
    setattr(KnowledgeStore, _name, _kb_access_delegate("_reasoning_rules", _name))

for _name in (
    "create_kb_alert",
    "get_kb_alert",
    "list_kb_alerts",
    "count_kb_alerts",
    "count_kb_unread_alerts",
    "list_kb_alerts_since",
    "dismiss_kb_alert",
    "dismiss_all_kb_alerts",
    "mark_all_kb_alerts_read",
):
    setattr(KnowledgeStore, _name, _kb_access_delegate("_kb_alerts", _name))

for _name in (
    "get_governance_config",
    "update_governance_config",
    "touch_governor_last_run",
    "list_governor_enabled_kb_ids",
):
    setattr(KnowledgeStore, _name, _kb_access_delegate("_governance", _name))

for _name in (
    "get_search_config",
    "update_search_config",
    "search_chunks_keyword",
    "search_chunks",
    "get_chunks_by_ids",
    "list_chunks_for_indexing",
    "chunk_ids_matching_filters",
    "get_embedding_record",
    "upsert_embedding_record",
    "delete_all_embedding_records",
):
    setattr(KnowledgeStore, _name, _kb_access_delegate("_search", _name))

for _name in (
    "list_document_timeline_events",
    "list_active_statements",
    "list_active_entity_id_labels",
    "list_active_statements_below_confidence",
    "kb_mcp_stats",
    "list_statements_for_chunk",
    "get_chunk",
    "count_browse_entities",
    "list_recent_entities",
    "find_entities",
    "list_entity_facts",
    "get_statement_browse",
):
    setattr(KnowledgeStore, _name, _kb_access_delegate("_ledger", _name))
