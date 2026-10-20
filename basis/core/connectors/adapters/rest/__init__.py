"""REST protocol (`rest_declarative` retriever / mutations / tools)."""

from basis.core.connectors.adapters.rest.adapter import (
    RestBatchResult,
    RestDeclarativeStreamAdapter,
)
from basis.core.connectors.adapters.rest.curated_dev import curated_rest_manifests

__all__ = [
    "RestBatchResult",
    "RestDeclarativeStreamAdapter",
    "curated_rest_manifests",
]
