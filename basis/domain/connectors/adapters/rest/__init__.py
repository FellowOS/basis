"""REST protocol (`rest_declarative` retriever / mutations / tools)."""

from basis.domain.connectors.adapters.rest.adapter import (
    RestBatchResult,
    RestDeclarativeStreamAdapter,
)
from basis.domain.connectors.adapters.rest.curated_dev import curated_rest_manifests

__all__ = [
    "RestBatchResult",
    "RestDeclarativeStreamAdapter",
    "curated_rest_manifests",
]
