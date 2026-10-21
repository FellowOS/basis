"""Shared helpers for BOCP connector routes."""

from __future__ import annotations

from typing import Any

from basis.domain.integration import ConnectorRuntime
from basis.domain.integration.allowlist import effective_allowed_providers
from basis.domain.knowledge.schedulers.connector_mapping_poll_due import poll_interval_minutes_for_mapping
from basis.domain.knowledge.services.connector_sync import (
    ConnectorLedgerSyncService,
    SourceTableMappingRecord,
)
from basis.domain.knowledge.store import KnowledgeStore

def runtime_for(knowledge: KnowledgeStore) -> ConnectorRuntime:
    return knowledge.connector_runtime()


def sync_service_for(knowledge: KnowledgeStore) -> ConnectorLedgerSyncService:
    return knowledge.connector_sync_service()


def connector_policy_response(vault: Any, kb_id: str, pol: Any) -> dict[str, Any]:
    platform_allowed = vault.get_platform_allowed_providers()
    effective = effective_allowed_providers(platform_allowed, pol.allowed_providers)
    return {
        "kb_id": kb_id,
        "platform_allowed_providers": platform_allowed,
        "allowed_providers": pol.allowed_providers,
        "effective_allowed_providers": effective,
        "action_policy": pol.action_policy,
        "updated_at": pol.updated_at,
    }


def table_mapping_api_dict(
    svc: ConnectorLedgerSyncService, kb_id: str, rec: SourceTableMappingRecord
) -> dict[str, Any]:
    binding = svc.get_mapping_connection_binding(kb_id, rec.source_id)
    return {
        "id": rec.id,
        "kb_id": rec.kb_id,
        "source_id": rec.source_id,
        "provider": binding.provider,
        "connection_name": binding.connection_name,
        "stream_name": rec.stream_name,
        "external_table": rec.external_table,
        "stream_params": rec.stream_params,
        "primary_key_column": rec.primary_key_column,
        "cursor_column": rec.cursor_column,
        "label_column": rec.label_column,
        "target_class_uri": rec.target_class_uri,
        "column_mappings": [c.model_dump(mode="json") for c in rec.column_mappings],
        "sync_mode": rec.sync_mode,
        "track_deletes": rec.track_deletes,
        "checkpoint": rec.checkpoint,
        "sync_direction": rec.sync_direction,
        "writeback_mode": rec.writeback_mode,
        "max_rows": rec.max_rows,
        "poll_interval_minutes": poll_interval_minutes_for_mapping(rec),
        "status": rec.status,
        "created_at": rec.created_at,
        "updated_at": rec.updated_at,
    }

