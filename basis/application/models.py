"""Pydantic input models for core operations (MCP + HTTP args)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError


class _ExtraAllowed(BaseModel):
    model_config = ConfigDict(extra="allow")


class DescribeWorkspaceInput(_ExtraAllowed):
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
    limit: int = Field(default=50, ge=1, le=100)


class ListDerivedFactsInput(_ExtraAllowed):
    entity_id: str | None = None
    limit: int = Field(default=100, ge=1, le=200)


class ListTypedFactsInput(_ExtraAllowed):
    limit: int = Field(default=100, ge=1, le=200)


class ListReasoningGroundFactsInput(_ExtraAllowed):
    limit: int = Field(default=200, ge=1, le=500)


class ListRulesInput(_ExtraAllowed):
    limit: int = Field(default=100, ge=1, le=200)


class GetRuleInput(_ExtraAllowed):
    rule_id: str = Field(min_length=1)


class ListMappingsInput(_ExtraAllowed):
    status: str | None = None
    limit: int = Field(default=100, ge=1, le=200)


class GetStatementInput(_ExtraAllowed):
    statement_id: str = Field(min_length=1)


class GetCapabilitiesInput(_ExtraAllowed):
    pass


class RunReasoningInput(_ExtraAllowed):
    facts: list[str] | None = None
    rules: list[str] = Field(min_length=1)
    facts_limit: int = Field(default=200, ge=1, le=500)
    apply_to_graph: bool = False
    mode: str = "forward"
    inferred_edge_type: str | None = None


class ProposeRememberInput(_ExtraAllowed):
    content: str = Field(min_length=1)
    source: str | None = None


class GraphSearchInput(_ExtraAllowed):
    query: str = Field(min_length=1)
    limit: int = Field(default=20, ge=1)
    max_limit: int | None = Field(default=None, ge=1)
    at: str | None = None


class ListReviewItemsInput(_ExtraAllowed):
    status: str | None = None
    kind: str | None = None
    limit: int = Field(default=50, ge=1, le=200)


class GetReviewItemInput(_ExtraAllowed):
    item_id: str = Field(min_length=1)


class ListProcessingJobsInput(_ExtraAllowed):
    status: Literal["queued", "running", "succeeded", "failed", "cancelled"] | None = None
    limit: int = Field(default=100, ge=1, le=200)


class ResolveStatementRememberReviewInput(_ExtraAllowed):
    item_id: str = Field(min_length=1)
    rationale: str | None = None


class ResolveReviewItemInput(_ExtraAllowed):
    item_id: str = Field(min_length=1)
    rationale: str | None = None
    keeper_statement_id: str | None = None
    primary_id: str | None = None


class ProposeEntityWritebackInput(_ExtraAllowed):
    entity_id: str = Field(min_length=1)
    field_updates: dict[str, Any] = Field(min_length=1)


class DescribeWorkspaceResponse(_ExtraAllowed):
    workspace_id: str
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
    derived_facts: list[Any] = Field(default_factory=list)


class ListDerivedFactsResponse(_ExtraAllowed):
    entity_id: str | None = None
    derived_facts: list[Any] = Field(default_factory=list)


class ListTypedFactsResponse(_ExtraAllowed):
    facts: list[Any] = Field(default_factory=list)


class ListReasoningGroundFactsResponse(_ExtraAllowed):
    facts: list[str] = Field(default_factory=list)


class RunReasoningResponse(_ExtraAllowed):
    inferred_facts: list[str] = Field(default_factory=list)
    rules_fired: int | None = None
    added_edges: int | None = None
    mutated: bool | None = None
    proof_chains: list[Any] = Field(default_factory=list)
    facts_source: str | None = None
    ground_facts: list[str] = Field(default_factory=list)


class ListRulesResponse(_ExtraAllowed):
    rules: list[Any] = Field(default_factory=list)


class GetRuleResponse(_ExtraAllowed):
    rule: dict[str, Any]


class ListMappingsResponse(_ExtraAllowed):
    mappings: list[Any] = Field(default_factory=list)


class GetStatementResponse(_ExtraAllowed):
    statement: dict[str, Any]


class GraphSearchResponse(_ExtraAllowed):
    results: list[Any] = Field(default_factory=list)
    engine: str | None = None


class ListReviewItemsResponse(_ExtraAllowed):
    items: list[Any] = Field(default_factory=list)


class GetReviewItemResponse(_ExtraAllowed):
    item: dict[str, Any]


class ListProcessingJobsResponse(_ExtraAllowed):
    jobs: list[Any] = Field(default_factory=list)


class ResolveStatementRememberReviewResponse(_ExtraAllowed):
    item: dict[str, Any]
    decision_id: str | None = None


class ApproveReviewItemResponse(_ExtraAllowed):
    item: dict[str, Any]
    decision_id: str | None = None


OPERATION_INPUT_MODELS: dict[str, type[BaseModel]] = {
    "describe_workspace": DescribeWorkspaceInput,
    "search_chunks": SearchChunksInput,
    "get_chunk": GetChunkInput,
    "find_entities": FindEntitiesInput,
    "neighbors": NeighborsInput,
    "paths": PathsInput,
    "entity_facts": EntityFactsInput,
    "list_derived_facts": ListDerivedFactsInput,
    "list_typed_facts": ListTypedFactsInput,
    "list_reasoning_ground_facts": ListReasoningGroundFactsInput,
    "list_rules": ListRulesInput,
    "get_rule": GetRuleInput,
    "list_mappings": ListMappingsInput,
    "get_statement": GetStatementInput,
    "get_capabilities": GetCapabilitiesInput,
    "run_reasoning": RunReasoningInput,
    "list_processing_jobs": ListProcessingJobsInput,
    "propose_remember": ProposeRememberInput,
    "graph_search": GraphSearchInput,
    "list_review_items": ListReviewItemsInput,
    "get_review_item": GetReviewItemInput,
    "approve_statement_remember_review": ResolveStatementRememberReviewInput,
    "reject_statement_remember_review": ResolveStatementRememberReviewInput,
    "approve_review_item": ResolveReviewItemInput,
    "reject_review_item": ResolveStatementRememberReviewInput,
    "propose_entity_writeback": ProposeEntityWritebackInput,
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
    if name == "describe_workspace" and not raw:
        return {}
    validated = model_cls.model_validate(raw)
    return validated.model_dump(exclude_none=True)


OPERATION_RESPONSE_MODELS: dict[str, type[BaseModel]] = {
    "describe_workspace": DescribeWorkspaceResponse,
    "search_chunks": SearchChunksResponse,
    "get_chunk": GetChunkResponse,
    "find_entities": FindEntitiesResponse,
    "neighbors": NeighborsResponse,
    "paths": PathsResponse,
    "entity_facts": EntityFactsResponse,
    "list_derived_facts": ListDerivedFactsResponse,
    "list_typed_facts": ListTypedFactsResponse,
    "list_reasoning_ground_facts": ListReasoningGroundFactsResponse,
    "run_reasoning": RunReasoningResponse,
    "list_rules": ListRulesResponse,
    "get_rule": GetRuleResponse,
    "list_mappings": ListMappingsResponse,
    "get_statement": GetStatementResponse,
    "graph_search": GraphSearchResponse,
    "list_review_items": ListReviewItemsResponse,
    "get_review_item": GetReviewItemResponse,
    "list_processing_jobs": ListProcessingJobsResponse,
    "approve_statement_remember_review": ResolveStatementRememberReviewResponse,
    "reject_statement_remember_review": ResolveStatementRememberReviewResponse,
    "approve_review_item": ApproveReviewItemResponse,
    "reject_review_item": ResolveStatementRememberReviewResponse,
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
