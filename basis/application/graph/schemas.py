"""Pydantic models for named tool arguments and responses."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import Field

from basis.application.tool_catalog.schema_base import ExtraAllowedModel

class FindEntitiesInput(ExtraAllowedModel):
    query: str = Field(min_length=1)
    limit: int = Field(default=20, ge=1)

class FindEntitiesResponse(ExtraAllowedModel):
    query: str
    ledger_entities: list[Any] = Field(default_factory=list)
    graph_nodes: list[Any] = Field(default_factory=list)

class GraphSearchInput(ExtraAllowedModel):
    query: str = Field(min_length=1)
    limit: int = Field(default=20, ge=1)
    max_limit: int | None = Field(default=None, ge=1)
    at: str | None = None

class GraphSearchResponse(ExtraAllowedModel):
    results: list[Any] = Field(default_factory=list)
    engine: str | None = None

class NeighborsInput(ExtraAllowedModel):
    node_id: str = Field(min_length=1)
    depth: int = Field(default=1, ge=1, le=5)

class NeighborsResponse(ExtraAllowedModel):
    node_id: str
    depth: int
    neighbors: list[Any] = Field(default_factory=list)

class PathsInput(ExtraAllowedModel):
    source: str = Field(min_length=1)
    target: str = Field(min_length=1)
    algorithm: Literal["bfs", "dijkstra"] = "bfs"
    directed: bool = True

class PathsResponse(ExtraAllowedModel):
    pass

TOOL_INPUT_MODELS: dict[str, type[ExtraAllowedModel]] = {
    "find_entities": FindEntitiesInput,
    "graph_search": GraphSearchInput,
    "neighbors": NeighborsInput,
    "paths": PathsInput,
}

TOOL_RESPONSE_MODELS: dict[str, type[ExtraAllowedModel]] = {
    "find_entities": FindEntitiesResponse,
    "graph_search": GraphSearchResponse,
    "neighbors": NeighborsResponse,
    "paths": PathsResponse,
}
