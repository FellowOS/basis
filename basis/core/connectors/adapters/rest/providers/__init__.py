"""REST providers generated into ``connectors/providers/{service}/``."""

from __future__ import annotations

from basis.core.connectors.adapters.rest.providers.github import github_manifest
from basis.core.connectors.manifest_schema import ConnectorManifest


def shipped_rest_provider_manifests() -> list[ConnectorManifest]:
    return [github_manifest()]
