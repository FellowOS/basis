"""REST providers generated into ``connectors/providers/{service}/``."""

from __future__ import annotations

from basis.domain.integration.adapters.rest.providers.github import github_manifest
from basis.domain.integration.manifest_schema import ConnectorManifest


def shipped_rest_provider_manifests() -> list[ConnectorManifest]:
    return [github_manifest()]
