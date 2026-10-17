"""Pydantic input models for core operations (MCP + HTTP args)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError


class _ExtraAllowed(BaseModel):
    model_config = ConfigDict(extra="allow")


class DescribeKbInput(_ExtraAllowed):
    pass


class SearchChunksInput(_ExtraAllowed):
    query: str = Field(min_length=1)
    limit: int = Field(default=10, ge=1)
    document_id: str | None = None
    entity_id: str | None = None
    as_of: str | None = None
    created_after: str | None = None
    created_before: str | None = None
    mode: Literal["keyword", "semantic", "hybrid"] | None = None
    limit_max: int | None = Field(default=None, ge=1)


class GetChunkInput(_ExtraAllowed):
    chunk_id: str = Field(min_length=1)


class FindEntitiesInput(_ExtraAllowed):
    query: str = Field(min_length=1)
    limit: int = Field(default=20, ge=1)


class NeighborsInput(_ExtraAllowed):
    node_id: str = Field(min_length=1)
    depth: int = Field(default=1, ge=1, le=5)


class PathsInput(_ExtraAllowed):
    source: str = Field(min_length=1)
    target: str = Field(min_length=1)
    algorithm: Literal["bfs", "dijkstra"] = "bfs"
    directed: bool = True


class EntityFactsInput(_ExtraAllowed):
    entity_id: str = Field(min_length=1)
    limit: int = Field(default=50, ge=1)


class ProposeRememberInput(_ExtraAllowed):
    content: str = Field(min_length=1)
    source: str | None = None


class GraphSearchInput(_ExtraAllowed):
    query: str = Field(min_length=1)
    limit: int = Field(default=20, ge=1)
    max_limit: int | None = Field(default=None, ge=1)
    at: str | None = None


class DescribeKbResponse(_ExtraAllowed):
    kb_id: str
    name: str


class SearchChunksResponse(_ExtraAllowed):
    query: str | None = None
    mode: str | None = None
    chunks: list[Any] = Field(default_factory=list)


class GetChunkResponse(_ExtraAllowed):
    chunk: dict[str, Any]


class FindEntitiesResponse(_ExtraAllowed):
    query: str
    ledger_entities: list[Any] = Field(default_factory=list)
    graph_nodes: list[Any] = Field(default_factory=list)


class NeighborsResponse(_ExtraAllowed):
    node_id: str
    depth: int
    neighbors: list[Any] = Field(default_factory=list)


class PathsResponse(_ExtraAllowed):
    pass


class EntityFactsResponse(_ExtraAllowed):
    entity_id: str
    facts: list[Any] = Field(default_factory=list)


class GraphSearchResponse(_ExtraAllowed):
    results: list[Any] = Field(default_factory=list)
    engine: str | None = None


OPERATION_INPUT_MODELS: dict[str, type[BaseModel]] = {
    "describe_kb": DescribeKbInput,
    "search_chunks": SearchChunksInput,
    "get_chunk": GetChunkInput,
    "find_entities": FindEntitiesInput,
    "neighbors": NeighborsInput,
    "paths": PathsInput,
    "entity_facts": EntityFactsInput,
    "propose_remember": ProposeRememberInput,
    "graph_search": GraphSearchInput,
}


def validation_error_payload(exc: ValidationError) -> dict[str, Any]:
    first = exc.errors()[0] if exc.errors() else {}
    loc = first.get("loc", ())
    field = str(loc[0]) if loc else "arguments"
    return {"error": f"invalid {field}: {first.get('msg', 'validation failed')}"}


def coerce_operation_args(name: str, arguments: dict[str, Any] | None) -> dict[str, Any]:
    """Validate and normalize args; raises ValidationError on failure."""
    model_cls = OPERATION_INPUT_MODELS.get(name)
    raw = arguments or {}
    if model_cls is None:
        return raw
    if name == "describe_kb" and not raw:
        return {}
    validated = model_cls.model_validate(raw)
    return validated.model_dump(exclude_none=True)


OPERATION_RESPONSE_MODELS: dict[str, type[BaseModel]] = {
    "describe_kb": DescribeKbResponse,
    "search_chunks": SearchChunksResponse,
    "get_chunk": GetChunkResponse,
    "find_entities": FindEntitiesResponse,
    "neighbors": NeighborsResponse,
    "paths": PathsResponse,
    "entity_facts": EntityFactsResponse,
    "graph_search": GraphSearchResponse,
}


def validate_operation_response(name: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Best-effort response shape check (extra fields allowed)."""
    model_cls = OPERATION_RESPONSE_MODELS.get(name)
    if model_cls is None:
        return payload
    try:
        return model_cls.model_validate(payload).model_dump()
    except ValidationError:
        return payload
