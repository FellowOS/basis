"""Merge upstream assets + generators into one ``ConnectorManifest`` per service."""

from __future__ import annotations

from typing import Any

from basis.domain.integration.manifest_schema import ConnectorManifest, ProcedureActionSpec
from basis.domain.integration.manifest_executor import INVOKE_OPERATION
from basis.domain.integration.synthesis.airbyte_entity import merge_airbyte_entities
from basis.domain.integration.synthesis.anyconnect_catalog import load_anyconnect_procedures
from basis.domain.integration.synthesis.generators import manifest_from_generator
from basis.domain.integration.synthesis.nango_auth import nango_auth_specs


def _overlay_auth(manifest: ConnectorManifest, nango_auth: list) -> ConnectorManifest:
    if not nango_auth:
        return manifest
    payload = manifest.model_dump(mode="python")
    payload["auth"] = [a.model_dump(mode="python") for a in nango_auth]
    return ConnectorManifest.model_validate(payload)


def _procedure_invoke_path(procedure: ProcedureActionSpec) -> str:
    if procedure.rest is None:
        return ""
    op = procedure.rest.operations.get(INVOKE_OPERATION)
    if op is None:
        return ""
    return op.path or ""


def _invoke_ready_procedures(procedures: list[ProcedureActionSpec]) -> list[ProcedureActionSpec]:
    return [p for p in procedures if _procedure_invoke_path(p)]


def _overlay_anyconnect_procedures(
    manifest: ConnectorManifest,
    procedures: list[ProcedureActionSpec],
    meta: dict[str, Any],
) -> ConnectorManifest:
    payload = manifest.model_dump(mode="python")
    if meta.get("display_name"):
        payload["display_name"] = meta["display_name"]
    if meta.get("description"):
        payload["description"] = meta["description"]
    if meta.get("categories"):
        payload["categories"] = meta["categories"]
    if meta.get("homepage_url"):
        payload["homepage_url"] = meta["homepage_url"]
    if meta.get("docs_url"):
        payload["docs_url"] = meta["docs_url"]
    existing = list(payload.get("actions") or [])
    entity_actions = [a for a in existing if a.get("kind") == "entity"]
    proc_payload = [p.model_dump(mode="python") for p in procedures]
    payload["actions"] = entity_actions + proc_payload
    return ConnectorManifest.model_validate(payload)


def merge_service(
    service: str,
    *,
    ship_tier: str | None = None,
    prefer_anyconnect_procedures: bool = True,
    catalog_procedures_only: bool = False,
    overlay_nango_auth: bool = True,
) -> ConnectorManifest:
    """
    Build a provider manifest for ``service``.

    Order: generator baseline → Nango auth overlay → AnyConnect procedure overlay.
    """
    service = service.strip().lower()
    nango = nango_auth_specs(service)
    manifest = (
        None if catalog_procedures_only else manifest_from_generator(service)
    )

    ac_loaded = (
        load_anyconnect_procedures(service) if prefer_anyconnect_procedures else None
    )
    ac_meta: dict[str, Any] | None = None
    ac_all: list[ProcedureActionSpec] = []
    ac_ready: list[ProcedureActionSpec] = []
    if ac_loaded is not None:
        ac_meta, ac_all = ac_loaded
        ac_ready = _invoke_ready_procedures(ac_all)

    if manifest is None:
        if not ac_ready:
            raise ValueError(f"Unknown service '{service}' (no generator or AnyConnect catalog)")
        if not nango:
            raise ValueError(
                f"Service '{service}' has no auth; configure Nango or a generator auth block"
            )
        assert ac_meta is not None
        manifest = ConnectorManifest(
            service=service,
            display_name=ac_meta.get("display_name") or service,
            description=ac_meta.get("description"),
            categories=ac_meta.get("categories") or [],
            homepage_url=ac_meta.get("homepage_url"),
            docs_url=ac_meta.get("docs_url"),
            auth=nango,
            actions=ac_ready,
        )
    else:
        if nango and overlay_nango_auth:
            manifest = _overlay_auth(manifest, nango)
        if (
            ac_ready
            and ac_meta is not None
            and prefer_anyconnect_procedures
            and len(ac_ready) == len(ac_all)
        ):
            manifest = _overlay_anyconnect_procedures(manifest, ac_ready, ac_meta)

    airbyte_entities = merge_airbyte_entities(service)
    if airbyte_entities:
        payload = manifest.model_dump(mode="python")
        existing_entities = [
            a for a in payload.get("actions") or [] if a.get("kind") == "entity"
        ]
        proc = [a for a in payload.get("actions") or [] if a.get("kind") == "procedure"]
        payload["actions"] = existing_entities + [
            e.model_dump(mode="python") for e in airbyte_entities
        ] + proc
        manifest = ConnectorManifest.model_validate(payload)

    if ship_tier:
        payload = manifest.model_dump(mode="python")
        payload["x-basis-ship-tier"] = ship_tier
        manifest = ConnectorManifest.model_validate(payload)

    return manifest
