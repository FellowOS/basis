"""In-memory graph projection load/save/rebuild (transport-agnostic)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from basis.domain.graph.explorer.session.registry import ExplorerSessionRegistry
from basis.domain.graph.projection.projector import apply_rebuild_to_session
from basis.domain.graph.projection.session import GraphSession
from basis.domain.graph.projection.snapshot_store import GraphPersistence
from basis.domain.knowledge.store import KnowledgeStore


@dataclass
class GraphProjectionBindings:
    graphs: dict[str, GraphSession]
    persistence: GraphPersistence
    knowledge: KnowledgeStore
    explorer_registry: ExplorerSessionRegistry
    persist_ontology_hub: Callable[[str], None]
    broadcast_projection: Callable[[str, int], None]


def graph_session_for_kb(bindings: GraphProjectionBindings, kb_id: str) -> GraphSession:
    session = bindings.graphs.get(kb_id)
    if session is not None:
        return session

    session, meta = bindings.persistence.load_snapshot(kb_id)
    ledger = bindings.knowledge.get_projection_state(kb_id)
    stale = meta is None or meta.projection_revision < ledger["revision"]
    has_ledger_docs = bool(bindings.knowledge.list_ready_documents_for_projection(kb_id))
    if stale and (ledger["revision"] > 0 or has_ledger_docs):
        apply_rebuild_to_session(bindings.knowledge, kb_id, session)
        ledger = bindings.knowledge.get_projection_state(kb_id)
        bindings.persistence.save(
            kb_id,
            session,
            projection_revision=ledger["revision"],
            schema_version=ledger["schema_version"],
        )
    bindings.graphs[kb_id] = session
    return session


def save_graph(bindings: GraphProjectionBindings, kb_id: str, *, sync_ledger: bool = True) -> None:
    session = graph_session_for_kb(bindings, kb_id)
    knowledge = bindings.knowledge
    if sync_ledger:
        from basis.domain.knowledge.services.graph_sync import sync_graph_to_ledger

        synced = sync_graph_to_ledger(knowledge, kb_id, session)
        if synced["entities_created"] or synced["statements_created"]:
            apply_rebuild_to_session(knowledge, kb_id, session)
    ledger = knowledge.get_projection_state(kb_id)
    bindings.persistence.save(
        kb_id,
        session,
        projection_revision=ledger["revision"],
        schema_version=ledger["schema_version"],
    )
    bindings.explorer_registry.invalidate(kb_id)
    bindings.persist_ontology_hub(kb_id)
    bindings.broadcast_projection(kb_id, int(ledger["revision"]))


def rebuild_kb_projection(bindings: GraphProjectionBindings, kb_id: str) -> dict:
    bindings.explorer_registry.invalidate(kb_id)
    session = graph_session_for_kb(bindings, kb_id)
    meta = apply_rebuild_to_session(bindings.knowledge, kb_id, session)
    save_graph(bindings, kb_id)
    return meta
