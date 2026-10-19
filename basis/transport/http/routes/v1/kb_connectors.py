"""KB Basis Open Connector Protocol (BOCP) routes: catalog, connections, schema discovery, table mappings, sync, and outbox."""

from __future__ import annotations

import json
from typing import Any, Literal
import uuid

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from basis.domain.connectors import ConnectorRuntime, get_connector_catalog
from basis.domain.connectors.allowlist import effective_allowed_providers, normalize_allowed_providers
from basis.domain.kb.connector_mapping_schedule import poll_interval_minutes_for_mapping
from basis.domain.kb.connector_sync import (
    ConnectorLedgerSyncService,
    SourceTableMappingRecord,
)
from basis.domain.kb.structured_models import ColumnMappingSpec, ConnectorSourceConfig
from basis.domain.kb.store import KnowledgeStore
from basis.platform.admin.errors import AdminError
from basis.platform.admin.store import AdminStore, User
from basis.transport.http.deps import (
    get_current_user,
    get_kb_for_editor,
    get_kb_for_viewer,
    get_knowledge_store,
    get_store,
    rebuild_kb_projection,
)

router = APIRouter(tags=["knowledge-bases"])


class UpsertConnectorPolicyRequest(BaseModel):
    allowed_providers: list[str] | str = "*"
    action_policy: dict[str, Any] = Field(default_factory=dict)


class UpsertConnectorConnectionRequest(BaseModel):
    auth_type: str = Field(min_length=1)
    connection_config: dict[str, Any] = Field(default_factory=dict)
    credentials: dict[str, Any] = Field(default_factory=dict)


class UpdateTableMappingRequest(BaseModel):
    provider: str | None = None
    connection_name: str | None = None
    stream_name: str = Field(min_length=1)
    external_table: str = Field(min_length=1)
    stream_params: dict[str, Any] = Field(default_factory=dict)
    primary_key_column: str = Field(min_length=1)
    cursor_column: str | None = None
    label_column: str = Field(min_length=1)
    target_class_uri: str = Field(min_length=1)
    column_mappings: list[ColumnMappingSpec] = Field(default_factory=list)
    sync_mode: Literal["full_refresh", "incremental"] = "incremental"
    track_deletes: bool = False
    sync_direction: Literal["inbound", "bidirectional"] = "inbound"
    writeback_mode: Literal["disabled", "review", "auto"] = "review"
    max_rows: int = Field(default=10000, ge=1, le=100000)
    poll_interval_minutes: int = Field(
        default=0,
        ge=0,
        le=10080,
        description="Background inbound sync interval in minutes; 0 = manual only.",
    )


class CreateTableMappingRequest(BaseModel):
    source_id: str | None = None
    provider: str = Field(min_length=1)
    connection_name: str = Field(default="default", min_length=1)
    stream_name: str = Field(min_length=1)
    external_table: str = Field(min_length=1)
    stream_params: dict[str, Any] = Field(default_factory=dict)
    primary_key_column: str = Field(min_length=1)
    cursor_column: str | None = None
    label_column: str = Field(min_length=1)
    target_class_uri: str = Field(min_length=1)
    column_mappings: list[ColumnMappingSpec] = Field(default_factory=list)
    sync_mode: Literal["full_refresh", "incremental"] = "incremental"
    track_deletes: bool = False
    sync_direction: Literal["inbound", "bidirectional"] = "inbound"
    writeback_mode: Literal["disabled", "review", "auto"] = "review"
    max_rows: int = Field(default=10000, ge=1, le=100000)
    poll_interval_minutes: int = Field(
        default=0,
        ge=0,
        le=10080,
        description="Background inbound sync interval in minutes; 0 = manual only.",
    )


class ProposeEntityWritebackRequest(BaseModel):
    entity_id: str = Field(min_length=1)
    field_updates: dict[str, Any] = Field(min_length=1)


class UpsertOAuthConfigRequest(BaseModel):
    client_id: str = Field(min_length=1)
    client_secret: str = Field(min_length=1)
    redirect_uri: str | None = None
    extra: dict[str, Any] = Field(default_factory=dict)


class BuildOAuthAuthorizeUrlRequest(BaseModel):
    state: str | None = None
    redirect_uri: str | None = None
    connection_config: dict[str, Any] = Field(default_factory=dict)
    code_challenge: str | None = None


class ExchangeOAuthCodeRequest(BaseModel):
    code: str = Field(min_length=1)
    redirect_uri: str | None = None
    code_verifier: str | None = None
    connection_name: str = Field(default="default", min_length=1)
    connection_config: dict[str, Any] = Field(default_factory=dict)


class ExecuteConnectorToolRequest(BaseModel):
    service: str = Field(min_length=1)
    tool_id: str = Field(min_length=1)
    connection_name: str = Field(default="default", min_length=1)
    arguments: dict[str, Any] = Field(default_factory=dict)


def _runtime_for(knowledge: KnowledgeStore) -> ConnectorRuntime:
    return knowledge.connector_runtime()


def _sync_service_for(knowledge: KnowledgeStore) -> ConnectorLedgerSyncService:
    return knowledge.connector_sync_service()


def _connector_policy_response(vault: Any, kb_id: str, pol: Any) -> dict[str, Any]:
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


def _table_mapping_api_dict(
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


@router.get("/{kb_id}/connectors/catalog")
async def list_connector_catalog(
    kb_id: str,
    request: Request,
    category: str | None = Query(default=None),
    auth_mode: str | None = Query(default=None),
    has_streams_only: bool = Query(default=False),
    query: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1500),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """List BOCP connector manifests available in the platform catalog."""
    get_kb_for_viewer(request, user, kb_id, store)
    catalog = get_connector_catalog()
    manifests = catalog.list_manifests(
        category=category,
        auth_mode=auth_mode,
        has_streams_only=has_streams_only,
        query=query,
    )
    rt = _runtime_for(knowledge)
    effective = rt.vault.effective_allowed_providers(kb_id)
    if effective != "*":
        allowed_set = set(effective) if isinstance(effective, list) else set()
        manifests = [m for m in manifests if m.service in allowed_set]
    return {
        "stats": catalog.summary_stats(),
        "total_matched": len(manifests),
        "connectors": [
            m.model_dump(mode="json", exclude_none=True) for m in manifests[:limit]
        ],
    }


@router.get("/{kb_id}/connectors/catalog/{service}")
async def get_connector_manifest_route(
    kb_id: str,
    service: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Fetch one BOCP connector manifest by service key."""
    get_kb_for_viewer(request, user, kb_id, store)
    rt = _runtime_for(knowledge)
    try:
        rt.vault.assert_service_allowed(kb_id, service)
    except PermissionError as exc:
        raise AdminError(403, "connector_policy_blocked", str(exc)) from exc
    manifest = get_connector_catalog().get(service)
    if not manifest:
        raise AdminError(404, "connector_not_found", f"未知的连接器服务: {service}")
    return {"connector": manifest.model_dump(mode="json", exclude_none=True)}


@router.get("/{kb_id}/connectors/policy")
async def get_kb_connector_policy(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Get KB-scoped connector allowlist and action governance policy."""
    get_kb_for_viewer(request, user, kb_id, store)
    rt = _runtime_for(knowledge)
    pol = rt.vault.get_policy(kb_id)
    return _connector_policy_response(rt.vault, kb_id, pol)


@router.put("/{kb_id}/connectors/policy")
async def put_kb_connector_policy(
    kb_id: str,
    body: UpsertConnectorPolicyRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Update KB-scoped connector allowlist and action governance policy."""
    get_kb_for_editor(request, user, kb_id, store)
    rt = _runtime_for(knowledge)
    try:
        pol = rt.vault.upsert_policy(
            kb_id,
            allowed_providers=normalize_allowed_providers(body.allowed_providers),
            action_policy=body.action_policy,
        )
    except PermissionError as exc:
        msg = str(exc)
        if "platform level" in msg:
            raise AdminError(400, "connector_allowlist_exceeds_platform", msg) from exc
        if "Unknown connector" in msg:
            raise AdminError(400, "connector_unknown_providers", msg) from exc
        raise AdminError(403, "connector_policy_blocked", msg) from exc
    return _connector_policy_response(rt.vault, kb_id, pol)


@router.get("/{kb_id}/connectors/connections")
async def list_kb_connector_connections(
    kb_id: str,
    request: Request,
    service: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """List configured BOCP connections for this KB (credentials redacted)."""
    get_kb_for_viewer(request, user, kb_id, store)
    rt = _runtime_for(knowledge)
    conns = rt.vault.list_connections(kb_id, service=service)
    return {"connections": [c.to_public_dict() for c in conns]}


@router.put("/{kb_id}/connectors/connections/{service}/{connection_name}")
async def upsert_kb_connector_connection(
    kb_id: str,
    service: str,
    connection_name: str,
    body: UpsertConnectorConnectionRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Create or update an encrypted BOCP connection for this KB."""
    get_kb_for_editor(request, user, kb_id, store)
    if not get_connector_catalog().get(service):
        raise AdminError(404, "connector_not_found", f"未知的连接器服务: {service}")
    rt = _runtime_for(knowledge)
    stored = rt.vault.upsert_connection(
        kb_id,
        service,
        connection_name=connection_name,
        auth_type=body.auth_type,
        connection_config=body.connection_config,
        credentials=body.credentials,
    )
    return {"connection": stored.to_public_dict()}


@router.delete("/{kb_id}/connectors/connections/{service}/{connection_name}")
async def delete_kb_connector_connection(
    kb_id: str,
    service: str,
    connection_name: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Delete a configured BOCP connection from this KB."""
    get_kb_for_editor(request, user, kb_id, store)
    rt = _runtime_for(knowledge)
    deleted = rt.vault.delete_connection(kb_id, service, connection_name=connection_name)
    if not deleted:
        raise AdminError(404, "connection_not_found", "连接不存在")
    return {"deleted": True}


@router.post("/{kb_id}/connectors/connections/{service}/{connection_name}/check")
async def check_kb_connector_connection(
    kb_id: str,
    service: str,
    connection_name: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Run the BOCP `CHECK` health check against an upstream connection."""
    get_kb_for_editor(request, user, kb_id, store)
    rt = _runtime_for(knowledge)
    try:
        profile = rt.check_connection(kb_id, service, connection_name=connection_name)
        return {"ok": True, "profile": profile}
    except LookupError as exc:
        raise AdminError(404, "connection_not_found", str(exc)) from exc
    except PermissionError as exc:
        raise AdminError(403, "connector_policy_blocked", str(exc)) from exc
    except Exception as exc:
        raise AdminError(422, "connector_check_failed", str(exc)) from exc


@router.get("/{kb_id}/connectors/connections/{service}/{connection_name}/discover")
async def discover_kb_connector_schema(
    kb_id: str,
    service: str,
    connection_name: str,
    request: Request,
    stream_name: str | None = Query(default=None),
    external_table: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Run the BOCP `DISCOVER` schema introspection for a SQL table or REST stream."""
    get_kb_for_viewer(request, user, kb_id, store)
    rt = _runtime_for(knowledge)
    try:
        info = rt.discover_schema(
            kb_id,
            service,
            connection_name=connection_name,
            stream_name=stream_name,
            external_table=external_table,
        )
        return {
            "stream_name": info.stream_name,
            "display_name": info.display_name,
            "external_table": info.external_table,
            "primary_key": info.primary_key,
            "cursor_field": info.cursor_field,
            "fields": [f.model_dump(mode="json") for f in info.fields],
        }
    except LookupError as exc:
        raise AdminError(404, "connection_not_found", str(exc)) from exc
    except PermissionError as exc:
        raise AdminError(403, "connector_policy_blocked", str(exc)) from exc
    except Exception as exc:
        raise AdminError(422, "connector_discover_failed", str(exc)) from exc


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
    svc = _sync_service_for(knowledge)
    mappings = []
    for m_id in knowledge.list_source_table_mapping_ids(kb_id):
        rec = svc.get_table_mapping(kb_id, m_id)
        if rec:
            mappings.append(_table_mapping_api_dict(svc, kb_id, rec))
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
    svc = _sync_service_for(knowledge)
    rec = svc.get_table_mapping(kb_id, mapping_id)
    if not rec:
        raise AdminError(404, "mapping_not_found", "表映射不存在")
    return {"mapping": _table_mapping_api_dict(svc, kb_id, rec)}


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
    svc = _sync_service_for(knowledge)
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
        return {"mapping": _table_mapping_api_dict(svc, kb_id, rec)}
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
    svc = _sync_service_for(knowledge)
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

    svc = _sync_service_for(knowledge)
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
    svc = _sync_service_for(knowledge)
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


@router.get("/{kb_id}/connectors/outbox")
async def list_kb_sync_outbox(
    kb_id: str,
    request: Request,
    status: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """List outbound entity writeback items in `entity_sync_outbox`."""
    get_kb_for_viewer(request, user, kb_id, store)
    svc = _sync_service_for(knowledge)
    outbox_ids = knowledge.list_entity_sync_outbox_ids(kb_id, status=status, limit=limit)
    items = [svc.get_outbox_item(kb_id, outbox_id) for outbox_id in outbox_ids]
    return {"items": items}


@router.post("/{kb_id}/connectors/outbox/propose")
async def propose_kb_entity_writeback(
    kb_id: str,
    body: ProposeEntityWritebackRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Propose an outbound writeback of ledger entity attributes to its external connector stream."""
    get_kb_for_editor(request, user, kb_id, store)
    svc = _sync_service_for(knowledge)
    try:
        outbox = svc.propose_entity_writeback(
            kb_id,
            entity_id=body.entity_id,
            field_updates=body.field_updates,
            created_by=user.id,
        )
        return {"outbox": outbox}
    except LookupError as exc:
        raise AdminError(404, "external_ref_not_found", str(exc)) from exc
    except PermissionError as exc:
        raise AdminError(403, "writeback_not_permitted", str(exc)) from exc
    except Exception as exc:
        raise AdminError(422, "writeback_propose_failed", str(exc)) from exc


@router.get("/{kb_id}/connectors/runs")
async def list_kb_connector_runs(
    kb_id: str,
    request: Request,
    service: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """List recent BOCP connector execution audit logs (`kb_connector_runs`)."""
    get_kb_for_viewer(request, user, kb_id, store)
    runs = knowledge.list_kb_connector_runs(kb_id, service=service, limit=limit)
    return {"runs": runs}


@router.put("/{kb_id}/connectors/oauth-configs/{service}")
async def upsert_kb_connector_oauth_config(
    kb_id: str,
    service: str,
    body: UpsertOAuthConfigRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Store encrypted OAuth2 client credentials (`client_id`, `client_secret`) for a connector service."""
    get_kb_for_editor(request, user, kb_id, store)
    if not get_connector_catalog().get(service):
        raise AdminError(404, "connector_not_found", f"未知的连接器服务: {service}")
    rt = _runtime_for(knowledge)
    saved = rt.vault.upsert_oauth_config(
        kb_id,
        service,
        client_id=body.client_id,
        client_secret=body.client_secret,
        redirect_uri=body.redirect_uri,
        extra=body.extra,
    )
    return {"oauth_config": saved}


@router.post("/{kb_id}/connectors/oauth/{service}/authorize-url")
async def build_kb_connector_oauth_authorize_url(
    kb_id: str,
    service: str,
    body: BuildOAuthAuthorizeUrlRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Build an OAuth2 authorization URL (with optional PKCE S256) for a connector service."""
    get_kb_for_editor(request, user, kb_id, store)
    rt = _runtime_for(knowledge)
    state = body.state or f"bocp_{uuid.uuid4().hex[:16]}"
    try:
        url = rt.vault.build_oauth2_authorize_url(
            kb_id,
            service,
            state=state,
            redirect_uri=body.redirect_uri,
            connection_config=body.connection_config,
            code_challenge=body.code_challenge,
        )
        return {"authorize_url": url, "state": state}
    except Exception as exc:
        raise AdminError(422, "oauth_authorize_url_failed", str(exc)) from exc


@router.post("/{kb_id}/connectors/oauth/{service}/exchange")
async def exchange_kb_connector_oauth_code(
    kb_id: str,
    service: str,
    body: ExchangeOAuthCodeRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Exchange an OAuth2 authorization code for tokens and save the encrypted BOCP connection."""
    get_kb_for_editor(request, user, kb_id, store)
    rt = _runtime_for(knowledge)
    try:
        stored = rt.vault.exchange_oauth2_code(
            kb_id,
            service,
            code=body.code,
            redirect_uri=body.redirect_uri,
            code_verifier=body.code_verifier,
            connection_name=body.connection_name,
            connection_config=body.connection_config,
        )
        return {"connection": stored.to_public_dict()}
    except Exception as exc:
        raise AdminError(422, "oauth_exchange_failed", str(exc)) from exc


@router.post("/{kb_id}/connectors/tools/execute")
async def execute_kb_connector_tool(
    kb_id: str,
    body: ExecuteConnectorToolRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Execute a standalone BOCP connector tool (`ToolSpec`) with KB policy enforcement."""
    get_kb_for_editor(request, user, kb_id, store)
    rt = _runtime_for(knowledge)
    try:
        res = rt.execute_tool(
            kb_id,
            body.service,
            body.tool_id,
            connection_name=body.connection_name,
            arguments=body.arguments,
        )
        return res
    except LookupError as exc:
        raise AdminError(404, "connection_not_found", str(exc)) from exc
    except PermissionError as exc:
        raise AdminError(403, "connector_policy_blocked", str(exc)) from exc
    except Exception as exc:
        raise AdminError(422, "connector_tool_execution_failed", str(exc)) from exc

