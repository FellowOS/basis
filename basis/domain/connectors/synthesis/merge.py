"""Merge upstream assets + generators into one ``ConnectorManifest`` per service."""

from __future__ import annotations

from typing import Any

from basis.domain.connectors.manifest_schema import ConnectorManifest
from basis.domain.connectors.synthesis.anyconnect_catalog import load_anyconnect_procedures
from basis.domain.connectors.synthesis.generators import manifest_from_generator
from basis.domain.connectors.synthesis.nango_auth import nango_auth_specs


def _overlay_auth(manifest: ConnectorManifest, nango_auth: list) -> ConnectorManifest:
    if not nango_auth:
        return manifest
    payload = manifest.model_dump(mode="python")
    payload["auth"] = [a.model_dump(mode="python") for a in nango_auth]
    return ConnectorManifest.model_validate(payload)


def _overlay_anyconnect_procedures(
    manifest: ConnectorManifest,
    procedures: list,
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
) -> ConnectorManifest:
    """
    Build a provider manifest for ``service``.

    Order: generator baseline → Nango auth overlay → AnyConnect procedure overlay.
    """
    service = service.strip().lower()
    manifest = manifest_from_generator(service)

    ac = load_anyconnect_procedures(service) if prefer_anyconnect_procedures else None
    if manifest is None and ac is not None:
        meta, procedures = ac
        if not procedures:
            raise ValueError(f"No generator or AnyConnect actions for '{service}'")
        manifest = ConnectorManifest(
            service=service,
            display_name=meta.get("display_name") or service,
            description=meta.get("description"),
            categories=meta.get("categories") or [],
            homepage_url=meta.get("homepage_url"),
            docs_url=meta.get("docs_url"),
            auth=[],  # filled by Nango or must be added before ship
            actions=procedures,
        )
    if manifest is None:
        raise ValueError(f"Unknown service '{service}' (no generator or AnyConnect catalog)")

    nango = nango_auth_specs(service)
    if nango:
        manifest = _overlay_auth(manifest, nango)
    elif ac is not None and not manifest.auth:
        raise ValueError(
            f"Service '{service}' has no auth block; add a generator auth or Nango providers.yaml"
        )

    if ac is not None and prefer_anyconnect_procedures:
        meta, procedures = ac
        if procedures:
            manifest = _overlay_anyconnect_procedures(manifest, procedures, meta)

    if ship_tier:
        payload = manifest.model_dump(mode="python")
        payload["x-basis-ship-tier"] = ship_tier
        manifest = ConnectorManifest.model_validate(payload)

    return manifest
