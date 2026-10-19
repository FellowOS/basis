"""In-memory registry and loader for Basis Open Connector Protocol (BOCP) manifests."""

from __future__ import annotations

from functools import lru_cache
import json
from pathlib import Path
from typing import Any

from basis.domain.connectors.manifest_schema import (
    AuthSpec,
    CheckEndpointSpec,
    ConfigFieldSpec,
    ConnectorManifest,
    DynamicSchemaLoaderSpec,
    RetrieverSpec,
    StreamMutationSpec,
    StreamSpec,
)


def _builtin_database_manifests() -> list[ConnectorManifest]:
    """Built-in SQLAlchemy 2.0 relational database connectors (postgres & mysql)."""
    common_dsn_fields = [
        ConfigFieldSpec(
            key="host",
            label="Host",
            input_type="text",
            required=True,
            placeholder="localhost",
        ),
        ConfigFieldSpec(
            key="port",
            label="Port",
            input_type="number",
            required=True,
            default=5432,
        ),
        ConfigFieldSpec(
            key="database",
            label="Database",
            input_type="text",
            required=True,
            placeholder="erp_prod",
        ),
        ConfigFieldSpec(
            key="schema",
            label="Default Schema",
            input_type="text",
            required=False,
            default="public",
        ),
    ]
    common_credentials = [
        ConfigFieldSpec(
            key="username",
            label="Username",
            input_type="text",
            required=True,
        ),
        ConfigFieldSpec(
            key="password",
            label="Password",
            input_type="password",
            required=True,
            secret=True,
        ),
    ]
    sql_stream = StreamSpec(
        name="table_records",
        display_name="Database Table Records",
        description="Relational table rows introspected and synced via SQLAlchemy 2.0.",
        primary_key=["id"],
        dynamic_schema_loader=DynamicSchemaLoaderSpec(
            type="sql_inspector",
        ),
        retriever=RetrieverSpec(
            adapter="sql_alchemy",
        ),
        mutations={
            "update": StreamMutationSpec(
                operation="update",
                adapter="sql_alchemy",
            ),
            "create": StreamMutationSpec(
                operation="create",
                adapter="sql_alchemy",
            ),
        },
    )

    pg = ConnectorManifest(
        service="postgres",
        display_name="PostgreSQL",
        description="PostgreSQL relational database connector backed by SQLAlchemy 2.0 reflection & parameterized queries.",
        categories=["Database"],
        homepage_url="https://www.postgresql.org",
        auth=[
            AuthSpec(
                auth_mode="database_dsn",
                connection_config=common_dsn_fields,
                credentials=common_credentials,
                check=CheckEndpointSpec(
                    method="GET",
                    path="SELECT current_user AS id, current_database() AS name",
                    account_id_path="id",
                    display_name_path="name",
                ),
            )
        ],
        streams=[sql_stream],
    )

    mysql_dsn_fields = [
        f.model_copy(update={"default": 3306}) if f.key == "port" else f
        for f in common_dsn_fields
        if f.key != "schema"
    ]
    mysql = ConnectorManifest(
        service="mysql",
        display_name="MySQL",
        description="MySQL relational database connector backed by SQLAlchemy 2.0 reflection & parameterized queries.",
        categories=["Database"],
        homepage_url="https://www.mysql.com",
        auth=[
            AuthSpec(
                auth_mode="database_dsn",
                connection_config=mysql_dsn_fields,
                credentials=common_credentials,
                check=CheckEndpointSpec(
                    method="GET",
                    path="SELECT CURRENT_USER() AS id, DATABASE() AS name",
                    account_id_path="id",
                    display_name_path="name",
                ),
            )
        ],
        streams=[sql_stream],
    )
    return [pg, mysql]


def default_manifests_dir() -> Path:
    return Path(__file__).resolve().parent / "manifests"


class ConnectorCatalog:
    """Loaded registry of BOCP ConnectorManifest objects."""

    def __init__(self, manifests: list[ConnectorManifest]) -> None:
        by_service: dict[str, ConnectorManifest] = {}
        for item in manifests:
            by_service[item.service] = item
        self._by_service = dict(sorted(by_service.items()))

    @classmethod
    def load_from_directory(cls, directory: Path | None = None) -> ConnectorCatalog:
        target = directory or default_manifests_dir()
        manifests: dict[str, ConnectorManifest] = {
            m.service: m for m in _builtin_database_manifests()
        }
        if target.is_dir():
            bundle_file = target / "catalog_bundle.json"
            if bundle_file.is_file():
                raw_list = json.loads(bundle_file.read_text(encoding="utf-8"))
                if isinstance(raw_list, list):
                    for item in raw_list:
                        manifest = ConnectorManifest.model_validate(item)
                        manifests[manifest.service] = manifest
            for path in sorted(target.glob("*.json")):
                if path.name == "catalog_bundle.json":
                    continue
                raw = json.loads(path.read_text(encoding="utf-8"))
                manifest = ConnectorManifest.model_validate(raw)
                manifests[manifest.service] = manifest
        return cls(list(manifests.values()))

    def list_manifests(
        self,
        *,
        category: str | None = None,
        auth_mode: str | None = None,
        has_streams_only: bool = False,
        query: str | None = None,
    ) -> list[ConnectorManifest]:
        results = list(self._by_service.values())
        if category:
            cat_lower = category.lower()
            results = [
                m
                for m in results
                if any(c.lower() == cat_lower for c in m.categories)
            ]
        if auth_mode:
            results = [
                m
                for m in results
                if any(a.auth_mode == auth_mode for a in m.auth)
            ]
        if has_streams_only:
            results = [m for m in results if len(m.streams) > 0]
        if query and query.strip():
            q = query.strip().lower()
            results = [
                m
                for m in results
                if q in m.service.lower()
                or q in m.display_name.lower()
                or (m.description and q in m.description.lower())
            ]
        return results

    def get(self, service: str) -> ConnectorManifest | None:
        return self._by_service.get(service)

    def service_ids(self) -> list[str]:
        return list(self._by_service.keys())

    def category_labels(self) -> list[str]:
        labels: set[str] = set()
        for manifest in self._by_service.values():
            labels.update(manifest.categories)
        return sorted(labels, key=str.lower)

    def category_breakdown(
        self,
        *,
        platform_allowed: list[str] | str = "*",
    ) -> list[dict[str, int | str]]:
        """Count providers per primary category (first tag), with platform-enabled totals."""
        from basis.domain.connectors.allowlist import is_platform_provider_allowed

        totals: dict[str, int] = {}
        enabled: dict[str, int] = {}
        for manifest in self._by_service.values():
            label = (manifest.categories[0] if manifest.categories else "other").lower()
            totals[label] = totals.get(label, 0) + 1
            if is_platform_provider_allowed(manifest.service, platform_allowed):
                enabled[label] = enabled.get(label, 0) + 1
        return [
            {
                "category": key,
                "total": totals[key],
                "enabled": enabled.get(key, 0),
            }
            for key in sorted(totals.keys())
        ]

    def __len__(self) -> int:
        return len(self._by_service)

    def summary_stats(self) -> dict[str, int]:
        total_streams = sum(len(m.streams) for m in self._by_service.values())
        total_tools = sum(len(m.tools) for m in self._by_service.values())
        with_streams = sum(1 for m in self._by_service.values() if m.streams)
        return {
            "providers": len(self._by_service),
            "providers_with_streams": with_streams,
            "total_streams": total_streams,
            "total_tools": total_tools,
        }


@lru_cache(maxsize=1)
def get_connector_catalog() -> ConnectorCatalog:
    return ConnectorCatalog.load_from_directory()
