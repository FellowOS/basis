"""BOCP connector routes — table mappings and inbound sync."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request

from basis.core.errors import AdminError
from basis.core.ledger.structured_models import ConnectorSourceConfig
from basis.control.admin.store import AdminStore, User
from basis.api.http.deps import (
    get_current_user,
    get_kb_for_editor,
    get_kb_for_viewer,
    get_knowledge_store,
    get_store,
    rebuild_kb_projection,
)
from basis.core.ledger.store import KnowledgeStore
from basis.api.http.routes.v1.kb.connectors.models import (
    CreateTableMappingRequest,
    UpdateTableMappingRequest,
)
from basis.api.http.routes.v1.kb.connectors.support import (
    sync_service_for,
    table_mapping_api_dict,
)

router = APIRouter(tags=["knowledge-bases"])

@router.get("/{kb_id}/connectors/table-mappings")
async def list_kb_table_mappings(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """List structured stream-to-ontology table mappings configured in this KB."""
    get_kb_for_viewer(request, user, kb_id, store)
    svc = sync_service_for(knowledge)
    mappings = []
    for m_id in knowledge.list_source_table_mapping_ids(kb_id):
        rec = svc.get_table_mapping(kb_id, m_id)
        if rec:
            mappings.append(table_mapping_api_dict(svc, kb_id, rec))
    return {"mappings": mappings}


@router.get("/{kb_id}/connectors/table-mappings/{mapping_id}")
async def get_kb_table_mapping(
    kb_id: str,
    mapping_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Fetch one stream-to-ontology table mapping with connector connection binding."""
    get_kb_for_viewer(request, user, kb_id, store)
    svc = sync_service_for(knowledge)
    rec = svc.get_table_mapping(kb_id, mapping_id)
    if not rec:
        raise AdminError(404, "mapping_not_found", "表映射不存在")
    return {"mapping": table_mapping_api_dict(svc, kb_id, rec)}


@router.put("/{kb_id}/connectors/table-mappings/{mapping_id}")
async def update_kb_table_mapping(
    kb_id: str,
    mapping_id: str,
    body: UpdateTableMappingRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Update a stream-to-ontology table mapping and optional connector connection binding."""
    get_kb_for_editor(request, user, kb_id, store)
    svc = sync_service_for(knowledge)
    try:
        rec = svc.update_table_mapping(
            kb_id,
            mapping_id,
            provider=body.provider,
            connection_name=body.connection_name,
            stream_name=body.stream_name,
            external_table=body.external_table,
            primary_key_column=body.primary_key_column,
            cursor_column=body.cursor_column,
            label_column=body.label_column,
            target_class_uri=body.target_class_uri,
            column_mappings=body.column_mappings,
            stream_params=body.stream_params,
            sync_mode=body.sync_mode,
            track_deletes=body.track_deletes,
            sync_direction=body.sync_direction,
            writeback_mode=body.writeback_mode,
            max_rows=body.max_rows,
            poll_interval_minutes=body.poll_interval_minutes,
        )
        return {"mapping": table_mapping_api_dict(svc, kb_id, rec)}
    except LookupError as exc:
        raise AdminError(404, "mapping_not_found", str(exc)) from exc
    except Exception as exc:
        raise AdminError(422, "mapping_update_failed", str(exc)) from exc


@router.delete("/{kb_id}/connectors/table-mappings/{mapping_id}")
async def delete_kb_table_mapping(
    kb_id: str,
    mapping_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Delete a stream-to-ontology table mapping (cascades `entity_external_refs`)."""
    get_kb_for_editor(request, user, kb_id, store)
    svc = sync_service_for(knowledge)
    deleted = svc.delete_table_mapping(kb_id, mapping_id)
    if not deleted:
        raise AdminError(404, "mapping_not_found", "表映射不存在")
    return {"deleted": True, "mapping_id": mapping_id}


@router.post("/{kb_id}/connectors/table-mappings")
async def create_kb_table_mapping(
    kb_id: str,
    body: CreateTableMappingRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Create a stream-to-ontology table mapping (auto-creating a `connector` ingest_source if omitted)."""
    get_kb_for_editor(request, user, kb_id, store)
    source_id = body.source_id
    if not source_id:
        src_cfg = ConnectorSourceConfig(
            provider=body.provider,
            connection_name=body.connection_name,
        )
        created_src, _ = knowledge.create_ingest_source(
            kb_id,
            user.id,
            kind="connector",
            name=f"{body.provider}:{body.external_table}",
            config=src_cfg.model_dump(mode="json", exclude_none=True),
            enabled=True,
        )
        source_id = str(created_src["id"])

    svc = sync_service_for(knowledge)
    rec = svc.create_table_mapping(
        kb_id,
        source_id=source_id,
        stream_name=body.stream_name,
        external_table=body.external_table,
        primary_key_column=body.primary_key_column,
        cursor_column=body.cursor_column,
        label_column=body.label_column,
        target_class_uri=body.target_class_uri,
        column_mappings=body.column_mappings,
        stream_params=body.stream_params,
        sync_mode=body.sync_mode,
        track_deletes=body.track_deletes,
        sync_direction=body.sync_direction,
        writeback_mode=body.writeback_mode,
        max_rows=body.max_rows,
        poll_interval_minutes=body.poll_interval_minutes,
    )
    return {
        "mapping": {
            "id": rec.id,
            "kb_id": rec.kb_id,
            "source_id": rec.source_id,
            "stream_name": rec.stream_name,
            "external_table": rec.external_table,
            "primary_key_column": rec.primary_key_column,
            "label_column": rec.label_column,
            "target_class_uri": rec.target_class_uri,
            "sync_direction": rec.sync_direction,
            "writeback_mode": rec.writeback_mode,
        }
    }


@router.post("/{kb_id}/connectors/table-mappings/{mapping_id}/sync")
async def sync_kb_table_mapping(
    kb_id: str,
    mapping_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Execute inbound 4-way sync from the BOCP stream into the Evidence Ledger."""
    get_kb_for_editor(request, user, kb_id, store)
    svc = sync_service_for(knowledge)
    try:
        stats = svc.sync_inbound_mapping(kb_id, mapping_id)
        if stats.added > 0 or stats.updated > 0 or stats.deleted > 0:
            rebuild_kb_projection(request, kb_id)
        return {
            "mapping_id": stats.mapping_id,
            "external_table": stats.external_table,
            "fetched_rows": stats.fetched_rows,
            "added": stats.added,
            "updated": stats.updated,
            "unchanged": stats.unchanged,
            "deleted": stats.deleted,
            "new_cursor_watermark": stats.new_cursor_watermark,
        }
    except LookupError as exc:
        raise AdminError(404, "mapping_not_found", str(exc)) from exc
    except Exception as exc:
        raise AdminError(422, "connector_sync_failed", str(exc)) from exc

