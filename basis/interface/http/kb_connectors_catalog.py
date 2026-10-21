"""BOCP connector routes — catalog and KB policy."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request

from basis.domain.integration import get_connector_catalog
from basis.domain.integration.allowlist import normalize_allowed_providers
from basis.domain.errors import AdminError
from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.deps import (
    get_current_user,
    get_kb_for_editor,
    get_kb_for_viewer,
    get_knowledge_store,
    get_store,
)
from basis.domain.knowledge.store import KnowledgeStore
from basis.interface.http.kb_connectors_models import UpsertConnectorPolicyRequest
from basis.interface.http.kb_connectors_support import (
    connector_policy_response,
    runtime_for,
)

router = APIRouter(tags=["knowledge-bases"])

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
    rt = runtime_for(knowledge)
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
    rt = runtime_for(knowledge)
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
    rt = runtime_for(knowledge)
    pol = rt.vault.get_policy(kb_id)
    return connector_policy_response(rt.vault, kb_id, pol)


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
    rt = runtime_for(knowledge)
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
    return connector_policy_response(rt.vault, kb_id, pol)

