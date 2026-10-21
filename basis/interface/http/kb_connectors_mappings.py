"""BOCP connector routes — table mappings and inbound sync."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request

from basis.domain.errors import AdminError
from basis.domain.knowledge.structured_models import ConnectorSourceConfig
from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.deps import (
    get_current_user,
    get_kb_for_editor,
    get_kb_for_viewer,
    get_knowledge_store,
    get_store,
    rebuild_kb_projection,
)
from basis.domain.knowledge.store import KnowledgeStore
from basis.interface.http.kb_connectors_models import (
    BatchCreateTableMappingsRequest,
    CreateTableMappingRequest,
    SuggestTableMappingsRequest,
    UpdateTableMappingRequest,
)
from basis.interface.http.kb_connectors_support import (
    runtime_for,
    sync_service_for,
    table_mapping_api_dict,
)
from basis.domain.knowledge.services.mapping_suggestions import (
    SuggestStreamTarget,
    expand_auto_targets,
    suggest_table_mapping_drafts,
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


@router.post("/{kb_id}/connectors/table-mappings/suggest")
async def suggest_kb_table_mappings(
    kb_id: str,
    body: SuggestTableMappingsRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Propose cross-stream connector mapping drafts grouped by inferred entity type (discover-backed)."""
    get_kb_for_viewer(request, user, kb_id, store)
    rt = runtime_for(knowledge)
    svc = sync_service_for(knowledge)

    existing: set[tuple[str, str, str, str]] = set()
    for m_id in knowledge.list_source_table_mapping_ids(kb_id):
        rec = svc.get_table_mapping(kb_id, m_id)
        if not rec:
            continue
        binding = svc.get_mapping_connection_binding(kb_id, rec.source_id)
        existing.add(
            (
                binding.provider,
                binding.connection_name,
                rec.stream_name,
                rec.external_table,
            )
        )

    targets: list[SuggestStreamTarget] = []
    for item in body.targets:
        targets.append(
            SuggestStreamTarget(
                provider=item.provider,
                connection_name=item.connection_name,
                stream_name=item.stream_name,
                external_table=item.external_table,
            )
        )
    for item in body.sql_tables:
        targets.append(
            SuggestStreamTarget(
                provider=item.provider,
                connection_name=item.connection_name,
                stream_name=item.stream_name or "table_records",
                external_table=item.external_table,
            )
        )
    if not targets:
        targets = expand_auto_targets(
            rt,
            kb_id,
            max_streams_per_connection=body.max_streams_per_connection,
        )

    result = suggest_table_mapping_drafts(rt, kb_id, targets, existing_fingerprints=existing)
    return {
        "groups": result.groups,
        "skipped": [
            {
                "provider": s.provider,
                "connection_name": s.connection_name,
                "stream_name": s.stream_name,
                "external_table": s.external_table,
                "reason": s.reason,
            }
            for s in result.skipped
        ],
    }


@router.post("/{kb_id}/connectors/table-mappings/batch-create")
async def batch_create_kb_table_mappings(
    kb_id: str,
    body: BatchCreateTableMappingsRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Create multiple stream-to-ontology table mappings and optionally run first inbound sync."""
    get_kb_for_editor(request, user, kb_id, store)
    svc = sync_service_for(knowledge)
    created: list[dict[str, Any]] = []
    sync_results: list[dict[str, Any]] = []

    for mapping_body in body.mappings:
        source_id = mapping_body.source_id
        if not source_id:
            src_cfg = ConnectorSourceConfig(
                provider=mapping_body.provider,
                connection_name=mapping_body.connection_name,
            )
            created_src, _ = knowledge.create_ingest_source(
                kb_id,
                user.id,
                kind="connector",
                name=f"{mapping_body.provider}:{mapping_body.external_table}",
                config=src_cfg.model_dump(mode="json", exclude_none=True),
                enabled=True,
            )
            source_id = str(created_src["id"])

        rec = svc.create_table_mapping(
            kb_id,
            source_id=source_id,
            stream_name=mapping_body.stream_name,
            external_table=mapping_body.external_table,
            primary_key_column=mapping_body.primary_key_column,
            cursor_column=mapping_body.cursor_column,
            label_column=mapping_body.label_column,
            target_class_uri=mapping_body.target_class_uri,
            column_mappings=mapping_body.column_mappings,
            stream_params=mapping_body.stream_params,
            sync_mode=mapping_body.sync_mode,
            track_deletes=mapping_body.track_deletes,
            sync_direction=mapping_body.sync_direction,
            writeback_mode=mapping_body.writeback_mode,
            max_rows=mapping_body.max_rows,
            poll_interval_minutes=mapping_body.poll_interval_minutes,
        )
        row = table_mapping_api_dict(svc, kb_id, rec)
        created.append(row)
        if body.run_sync:
            try:
                stats = svc.sync_inbound_mapping(kb_id, rec.id)
                if stats.added > 0 or stats.updated > 0 or stats.deleted > 0:
                    rebuild_kb_projection(request, kb_id)
                sync_results.append(
                    {
                        "mapping_id": stats.mapping_id,
                        "external_table": stats.external_table,
                        "fetched_rows": stats.fetched_rows,
                        "added": stats.added,
                        "updated": stats.updated,
                        "unchanged": stats.unchanged,
                        "deleted": stats.deleted,
                        "new_cursor_watermark": stats.new_cursor_watermark,
                    }
                )
            except Exception as exc:
                sync_results.append(
                    {"mapping_id": rec.id, "error": str(exc)},
                )

    return {"mappings": created, "sync_results": sync_results}


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

