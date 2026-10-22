"""In-memory graph projection load/save/rebuild (transport-agnostic)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Callable

from basis.domain.graph.projection.projector import apply_rebuild_to_session
from basis.domain.graph.projection.session import GraphSession
from basis.domain.graph.projection.snapshot_store import GraphPersistence
from basis.domain.knowledge.store import KnowledgeStore

if TYPE_CHECKING:
    from basis.domain.graph.session.registry import GraphSessionRegistry


@dataclass
class GraphProjectionBindings:
    graphs: dict[str, GraphSession]
    persistence: GraphPersistence
    knowledge: KnowledgeStore
    graph_session_registry: GraphSessionRegistry
    persist_ontology_hub: Callable[[str], None]
    broadcast_projection: Callable[[str, int], None]


def graph_session_for_workspace(bindings: GraphProjectionBindings, workspace_id: str) -> GraphSession:
    session = bindings.graphs.get(workspace_id)
    if session is not None:
        return session

    session, meta = bindings.persistence.load_snapshot(workspace_id)
    ledger = bindings.knowledge.get_projection_state(workspace_id)
    stale = meta is None or meta.projection_revision < ledger["revision"]
    has_ledger_docs = bool(bindings.knowledge.list_ready_documents_for_projection(workspace_id))
    if stale and (ledger["revision"] > 0 or has_ledger_docs):
        apply_rebuild_to_session(bindings.knowledge, workspace_id, session)
        ledger = bindings.knowledge.get_projection_state(workspace_id)
        bindings.persistence.save(
            workspace_id,
            session,
            projection_revision=ledger["revision"],
            schema_version=ledger["schema_version"],
        )
    bindings.graphs[workspace_id] = session
    return session


def save_graph(bindings: GraphProjectionBindings, workspace_id: str, *, sync_ledger: bool = True) -> None:
    session = graph_session_for_workspace(bindings, workspace_id)
    knowledge = bindings.knowledge
    if sync_ledger:
        from basis.domain.knowledge.services.graph_sync import sync_graph_to_ledger

        synced = sync_graph_to_ledger(knowledge, workspace_id, session)
        if synced["entities_created"] or synced["statements_created"]:
            apply_rebuild_to_session(knowledge, workspace_id, session)
    ledger = knowledge.get_projection_state(workspace_id)
    bindings.persistence.save(
        workspace_id,
        session,
        projection_revision=ledger["revision"],
        schema_version=ledger["schema_version"],
    )
    bindings.graph_session_registry.invalidate(workspace_id)
    bindings.persist_ontology_hub(workspace_id)
    bindings.broadcast_projection(workspace_id, int(ledger["revision"]))


def rebuild_graph_projection(bindings: GraphProjectionBindings, workspace_id: str) -> dict:
    bindings.graph_session_registry.invalidate(workspace_id)
    session = graph_session_for_workspace(bindings, workspace_id)
    meta = apply_rebuild_to_session(bindings.knowledge, workspace_id, session)
    save_graph(bindings, workspace_id)
    return meta
