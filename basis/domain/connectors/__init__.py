"""Basis Open Connector Protocol (BOCP) domain package."""

from basis.domain.connectors.auth_vault import (
    ConnectorAuthVault,
    ConnectorPolicy,
    StoredConnection,
    decrypt_vault_payload,
    encrypt_vault_payload,
)
from basis.domain.connectors.catalog import (
    ConnectorCatalog,
    get_connector_catalog,
)
from basis.domain.connectors.manifest_schema import (
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
from basis.domain.connectors.rest_declarative_adapter import (
    RestBatchResult,
    RestDeclarativeStreamAdapter,
)
from basis.domain.connectors.runtime import (
    ConnectorRuntime,
    DiscoveredStreamInfo,
    UnifiedReadResult,
)
from basis.domain.connectors.sql_adapter import (
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
