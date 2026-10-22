"""BOCP routes under ``/workspaces/{id}/integration/*`` (end_user / embed clients)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request

from basis.domain.errors import AdminError
from basis.domain.integration import get_connector_catalog
from basis.domain.integration.connection_scope import (
    DEFAULT_END_USER_CONNECTION_NAME,
    SCOPE_END_USER,
)
from basis.domain.integration.integration_oauth_state import (
    pack_integration_oauth_state,
    unpack_integration_oauth_state,
)
from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.deps import (
    get_current_user,
    get_knowledge_store,
    get_store,
    get_workspace_for_editor,
    get_workspace_for_viewer,
)
from basis.domain.knowledge.store import KnowledgeStore
from basis.interface.http.connectors_models import (
    ExchangeOAuthCodeRequest,
    IntegrationOAuthAuthorizeRequest,
    IntegrationUpsertConnectionRequest,
)
from basis.interface.http.connectors_support import runtime_for

router = APIRouter(tags=["workspaces"])


@router.get("/{workspace_id}/integration/providers")
async def integration_list_providers(
    workspace_id: str,
    request: Request,
    has_streams_only: bool = Query(default=False),
    limit: int = Query(default=100, ge=1, le=500),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """List connector manifests for embed/integration clients (includes auth[] definitions)."""
    get_workspace_for_viewer(request, user, workspace_id, store)
    catalog = get_connector_catalog()
    manifests = catalog.list_manifests(has_streams_only=has_streams_only)
    rt = runtime_for(knowledge)
    effective = rt.vault.effective_allowed_providers(workspace_id)
    if effective != "*":
        allowed_set = set(effective) if isinstance(effective, list) else set()
        manifests = [m for m in manifests if m.service in allowed_set]
    sliced = manifests[:limit]
    return {
        "providers": [
            m.model_dump(mode="json", exclude_none=True) for m in sliced
        ],
        "total": len(sliced),
    }


@router.get("/{workspace_id}/integration/connections")
async def integration_list_connections(
    workspace_id: str,
    request: Request,
    subject_id: str = Query(..., min_length=1),
    service: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """List end_user connections for one embed subject (credentials redacted)."""
    get_workspace_for_viewer(request, user, workspace_id, store)
    rt = runtime_for(knowledge)
    conns = rt.vault.list_connections(
        workspace_id,
        service=service,
        connection_scope=SCOPE_END_USER,
        subject_id=subject_id.strip(),
    )
    return {"connections": [c.to_public_dict() for c in conns]}


@router.put("/{workspace_id}/integration/connections/{service}")
async def integration_upsert_connection(
    workspace_id: str,
    service: str,
    body: IntegrationUpsertConnectionRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Create or update an end_user connection for an embed subject."""
    get_workspace_for_editor(request, user, workspace_id, store)
    if not get_connector_catalog().get(service):
        raise AdminError(404, "connector_not_found", f"未知的连接器服务: {service}")
    rt = runtime_for(knowledge)
    stored = rt.vault.upsert_connection(
        workspace_id,
        service,
        connection_name=DEFAULT_END_USER_CONNECTION_NAME,
        connection_scope=SCOPE_END_USER,
        subject_id=body.subject_id.strip(),
        auth_type=body.auth_type,
        connection_config=body.connection_config,
        credentials=body.credentials,
    )
    return {"connection": stored.to_public_dict()}


@router.delete("/{workspace_id}/integration/connections/{service}")
async def integration_delete_connection(
    workspace_id: str,
    service: str,
    request: Request,
    subject_id: str = Query(..., min_length=1),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Delete an end_user connection for one embed subject."""
    get_workspace_for_editor(request, user, workspace_id, store)
    rt = runtime_for(knowledge)
    deleted = rt.vault.delete_connection(
        workspace_id,
        service,
        connection_name=DEFAULT_END_USER_CONNECTION_NAME,
        connection_scope=SCOPE_END_USER,
        subject_id=subject_id.strip(),
    )
    if not deleted:
        raise AdminError(404, "connection_not_found", "连接不存在")
    return {"deleted": True}


@router.post("/{workspace_id}/integration/connections/{service}/check")
async def integration_check_connection(
    workspace_id: str,
    service: str,
    request: Request,
    subject_id: str = Query(..., min_length=1),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Run BOCP CHECK for an end_user connection."""
    get_workspace_for_editor(request, user, workspace_id, store)
    rt = runtime_for(knowledge)
    try:
        profile = rt.check_connection(
            workspace_id,
            service,
            connection_name=DEFAULT_END_USER_CONNECTION_NAME,
            connection_scope=SCOPE_END_USER,
            subject_id=subject_id.strip(),
        )
        return {"ok": True, "profile": profile}
    except LookupError as exc:
        raise AdminError(404, "connection_not_found", str(exc)) from exc
    except Exception as exc:
        raise AdminError(422, "connector_check_failed", str(exc)) from exc


@router.post("/{workspace_id}/integration/oauth/{service}/authorize-url")
async def integration_oauth_authorize_url(
    workspace_id: str,
    service: str,
    body: IntegrationOAuthAuthorizeRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Build OAuth2 authorize URL; state binds service + end_user subject_id."""
    get_workspace_for_editor(request, user, workspace_id, store)
    rt = runtime_for(knowledge)
    # Packed state binds service + subject_id for callback/exchange (ignore client nonce).
    state = pack_integration_oauth_state(service, body.subject_id.strip())
    try:
        url = rt.vault.build_oauth2_authorize_url(
            workspace_id,
            service,
            state=state,
            redirect_uri=body.redirect_uri,
            connection_config=body.connection_config,
            code_challenge=body.code_challenge,
        )
    except Exception as exc:
        raise AdminError(422, "oauth_authorize_url_failed", str(exc)) from exc
    return {"authorize_url": url, "state": state}


@router.post("/{workspace_id}/integration/oauth/{service}/exchange")
async def integration_oauth_exchange(
    workspace_id: str,
    service: str,
    body: ExchangeOAuthCodeRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Exchange OAuth code; defaults to end_user scope when subject_id is set."""
    get_workspace_for_editor(request, user, workspace_id, store)
    scope = body.connection_scope
    subject_id = body.subject_id
    if body.state and not subject_id:
        try:
            parsed = unpack_integration_oauth_state(body.state)
            if parsed["service"] != service:
                raise AdminError(422, "oauth_state_mismatch", "state service mismatch")
            subject_id = parsed["subject_id"]
            scope = SCOPE_END_USER
        except ValueError as exc:
            raise AdminError(422, "oauth_state_invalid", str(exc)) from exc
    if scope == SCOPE_END_USER and not (subject_id or "").strip():
        raise AdminError(422, "subject_id_required", "end_user OAuth requires subject_id")
    rt = runtime_for(knowledge)
    try:
        stored = rt.vault.exchange_oauth2_code(
            workspace_id,
            service,
            code=body.code,
            redirect_uri=body.redirect_uri,
            code_verifier=body.code_verifier,
            connection_name=body.connection_name or DEFAULT_END_USER_CONNECTION_NAME,
            connection_scope=scope,
            subject_id=subject_id,
            connection_config=body.connection_config,
        )
    except Exception as exc:
        raise AdminError(422, "oauth_exchange_failed", str(exc)) from exc
    return {"connection": stored.to_public_dict()}
