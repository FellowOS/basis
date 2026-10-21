"""BOCP entry points on KnowledgeStore (no SQL)."""

from __future__ import annotations

from typing import Any, TYPE_CHECKING

from basis.domain.integration.canonical_db import LockedCanonicalConn
from basis.domain.knowledge.sql_connector_sync import ConnectorSyncPersistence
from basis.domain.knowledge.sql_connector_vault import ConnectorVaultPersistence

if TYPE_CHECKING:
    from basis.domain.knowledge.store import KnowledgeStore


class ConnectorKbAccess:
    def __init__(self, store: KnowledgeStore) -> None:
        self._store = store

    def connector_vault_persistence(self) -> ConnectorVaultPersistence:
        return ConnectorVaultPersistence(LockedCanonicalConn(self._store))

    def connector_sync_persistence(self) -> ConnectorSyncPersistence:
        return ConnectorSyncPersistence(LockedCanonicalConn(self._store))

    def get_platform_allowed_providers(self) -> list[str] | str:
        return LockedCanonicalConn(self._store).get_platform_allowed_providers()

    def connector_runtime(self):
        from basis.domain.integration.runtime import ConnectorRuntime

        return ConnectorRuntime(self._store)

    def connector_sync_service(self):
        from basis.domain.knowledge.services.connector_sync import ConnectorLedgerSyncService

        return ConnectorLedgerSyncService(self._store, self.connector_runtime())

    def list_source_table_mapping_ids(
        self,
        kb_id: str,
        *,
        limit: int | None = None,
    ) -> list[str]:
        return self.connector_sync_persistence().list_mapping_ids(kb_id, limit=limit)

    def list_entity_sync_outbox_ids(
        self,
        kb_id: str,
        *,
        status: str | None = None,
        limit: int = 50,
    ) -> list[str]:
        return self.connector_sync_persistence().list_outbox_ids(
            kb_id, status=status, limit=limit
        )

    def reject_entity_sync_outbox(self, kb_id: str, outbox_id: str) -> None:
        self.connector_sync_persistence().reject_outbox(kb_id, outbox_id)

    def list_kb_connector_runs(
        self,
        kb_id: str,
        *,
        service: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        return self.connector_vault_persistence().list_connector_runs(
            kb_id, service=service, limit=limit
        )

    def list_active_connector_table_mappings_global(self) -> list[tuple[str, str]]:
        return self.connector_sync_persistence().list_active_inbound_mapping_pairs()
