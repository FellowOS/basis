"""Workspace connector policy use cases."""

from __future__ import annotations

from typing import Any

from basis.application.connectors import authz
from basis.application.kernel import WorkspaceCoreContext
from basis.domain.connector.allowlist import effective_allowed_providers, normalize_allowed_providers
from basis.domain.errors import AdminError


def policy_response(vault: Any, workspace_id: str, pol: Any) -> dict[str, Any]:
    platform_allowed = vault.get_platform_allowed_providers()
    effective = effective_allowed_providers(platform_allowed, pol.allowed_providers)
    return {
        "workspace_id": workspace_id,
        "platform_allowed_providers": platform_allowed,
        "allowed_providers": pol.allowed_providers,
        "effective_allowed_providers": effective,
        "action_policy": pol.action_policy,
        "updated_at": pol.updated_at,
    }


def get_policy(ctx: WorkspaceCoreContext) -> dict[str, Any]:
    authz.require_workspace_viewer(ctx)
    runtime = ctx.knowledge.connector_runtime()
    pol = runtime.vault.get_policy(ctx.workspace.id)
    return policy_response(runtime.vault, ctx.workspace.id, pol)


def upsert_policy(
    ctx: WorkspaceCoreContext,
    *,
    allowed_providers: list[str] | str,
    action_policy: dict[str, Any],
) -> dict[str, Any]:
    authz.require_workspace_editor(ctx)
    runtime = ctx.knowledge.connector_runtime()
    try:
        pol = runtime.vault.upsert_policy(
            ctx.workspace.id,
            allowed_providers=normalize_allowed_providers(allowed_providers),
            action_policy=action_policy,
        )
    except PermissionError as exc:
        msg = str(exc)
        if "platform level" in msg:
            raise AdminError(400, "connector_allowlist_exceeds_platform", msg) from exc
        if "Unknown connector" in msg:
            raise AdminError(400, "connector_unknown_providers", msg) from exc
        raise AdminError(403, "connector_policy_blocked", msg) from exc
    return policy_response(runtime.vault, ctx.workspace.id, pol)
