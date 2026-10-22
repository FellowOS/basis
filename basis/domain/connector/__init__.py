"""Connector domain (BOCP runtime, manifests, adapters, vault)."""

from basis.domain.connector.auth_vault import (
    ConnectorAuthVault,
    ConnectorPolicy,
    StoredConnection,
    decrypt_vault_payload,
    encrypt_vault_payload,
)
from basis.domain.connector.catalog import (
    ConnectorCatalog,
    get_connector_catalog,
)
from basis.domain.connector.manifest_schema import (
    AuthModeLiteral,
    AuthSpec,
    CheckEndpointSpec,
    ConfigFieldSpec,
    ConnectorManifest,
    DynamicSchemaLoaderSpec,
    OAuth2DialectSpec,
    PaginatorSpec,
    RateLimitQuotaSpec,
    RetrieverSpec,
    StreamFieldSpec,
    StreamMutationSpec,
    StreamSpec,
    SubstreamPartitionSpec,
    ToolAnnotationsSpec,
    ToolSpec,
    TwoStepAuthSpec,
)
from basis.domain.connector.adapters.rest import (
    RestBatchResult,
    RestDeclarativeStreamAdapter,
)
from basis.domain.connector.runtime import (
    ConnectorRuntime,
    DiscoveredStreamInfo,
    UnifiedReadResult,
)
from basis.domain.connector.adapters.sql import (
    DiscoveredTableSchema,
    SqlAlchemyStreamAdapter,
    SqlBatchResult,
)

__all__ = [
    "AuthModeLiteral",
    "AuthSpec",
    "CheckEndpointSpec",
    "ConfigFieldSpec",
    "ConnectorAuthVault",
    "ConnectorCatalog",
    "ConnectorManifest",
    "ConnectorPolicy",
    "ConnectorRuntime",
    "DiscoveredStreamInfo",
    "DiscoveredTableSchema",
    "DynamicSchemaLoaderSpec",
    "OAuth2DialectSpec",
    "PaginatorSpec",
    "RateLimitQuotaSpec",
    "RestBatchResult",
    "RestDeclarativeStreamAdapter",
    "RetrieverSpec",
    "SqlAlchemyStreamAdapter",
    "SqlBatchResult",
    "StoredConnection",
    "StreamFieldSpec",
    "StreamMutationSpec",
    "StreamSpec",
    "SubstreamPartitionSpec",
    "ToolAnnotationsSpec",
    "ToolSpec",
    "TwoStepAuthSpec",
    "UnifiedReadResult",
    "decrypt_vault_payload",
    "encrypt_vault_payload",
    "get_connector_catalog",
]
