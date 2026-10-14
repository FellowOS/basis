"""Rebuild ContextGraph snapshots from the canonical knowledge ledger."""

from __future__ import annotations

from typing import Any

from sema.graph.session import GraphSession
from sema.knowledge.store import KnowledgeStore

PROJECTION_SCHEMA_VERSION = 1
_PRESERVED_NODE_TYPES = frozenset({"owl:Ontology"})


def _predicate_edge_label(predicate_uri: str) -> str:
    cleaned = (predicate_uri or "").strip().rstrip("/#")
    if not cleaned:
        return "related_to"
    if "/" in cleaned:
        return cleaned.rsplit("/", 1)[-1] or cleaned
    if ":" in cleaned:
        return cleaned.rsplit(":", 1)[-1] or cleaned
    return cleaned


def _copy_preserved_nodes(source: GraphSession, target: GraphSession) -> None:
    for node in source.graph.nodes.values():
        if node.node_type not in _PRESERVED_NODE_TYPES:
            continue
        props = dict(node.properties) if isinstance(node.properties, dict) else {}
        target.add_node(
            node.node_id,
            node.node_type,
            content=node.content,
            **props,
        )


def _edge_signature(session: GraphSession) -> list[tuple[str, str, str]]:
    edges = session.graph.edges
    if isinstance(edges, dict):
        values = edges.values()
    else:
        values = edges
    return sorted(
        (edge.source_id, edge.target_id, edge.edge_type)
        for edge in values
    )


def graph_projection_signature(session: GraphSession) -> dict[str, Any]:
    """Stable summary for tests and migration checks."""
    return {
        "node_ids": sorted(session.graph.nodes.keys()),
        "edges": _edge_signature(session),
        "node_count": len(session.graph.nodes),
        "edge_count": len(_edge_signature(session)),
    }


def _canon_entity_id(entity_id: str, merge_redirect: dict[str, str]) -> str:
    return merge_redirect.get(entity_id, entity_id)


def rebuild_graph_from_ledger(
    knowledge: KnowledgeStore,
    kb_id: str,
    *,
    preserve_from: GraphSession | None = None,
    include_version_ids: tuple[str, ...] | None = None,
) -> GraphSession:
    """Full rebuild of KB graph content from ledger rows (ontology nodes may be preserved)."""
    knowledge.ensure_projection_state(kb_id)
    knowledge.set_projection_status(kb_id, "building")
    merge_redirect = knowledge.entity_merge_redirect(kb_id)
    try:
        session = GraphSession()
        if preserve_from is not None:
            _copy_preserved_nodes(preserve_from, session)

        for doc in knowledge.list_ready_documents_for_projection(
            kb_id, include_version_ids=include_version_ids
        ):
            graph_doc_id = doc["graph_doc_id"]
            text = doc["text"]
            session.add_node(
                graph_doc_id,
                "document",
                content=text,
                text=text,
                ledger_document_id=doc["document_id"],
                ledger_version_id=doc["version_id"],
                projection_layer="ledger",
                projection_schema_version=PROJECTION_SCHEMA_VERSION,
            )

        for entity in knowledge.list_entities_for_projection(kb_id):
            if entity["id"] in merge_redirect:
                continue
            label = entity["canonical_label"] or ""
            session.add_node(
                entity["id"],
                "entity",
                content=label,
                name=label,
                ledger_entity_id=entity["id"],
                projection_layer="ledger",
            )

        typed_triples: set[tuple[str, str, str]] = set()
        for fact in knowledge.list_typed_facts_for_projection(kb_id):
            subject_id = _canon_entity_id(fact["subject_id"], merge_redirect)
            if fact["object_entity_id"]:
                target_id = _canon_entity_id(fact["object_entity_id"], merge_redirect)
            elif fact["object_value"]:
                target_id = f"typed:{fact['id']}"
            else:
                continue
            typed_triples.add((subject_id, target_id, _predicate_edge_label(fact["predicate_uri"])))

        mentioned: set[tuple[str, str]] = set()
        for row in knowledge.list_statements_for_projection(kb_id):
            surface = row["surface_phrase"]
            statement_id = row["statement_id"]
            evidence_id = row.get("evidence_id")
            chunk_id = row.get("chunk_id")
            confidence = row.get("confidence")
            graph_doc_id = row.get("graph_doc_id")
            subject_id = _canon_entity_id(row["subject_id"], merge_redirect)

            edge_props: dict[str, Any] = {
                "statement_id": statement_id,
                "evidence_id": evidence_id,
                "chunk_id": chunk_id,
                "projection_layer": "open",
                "statement_status": row["status"],
            }
            if confidence is not None:
                edge_props["confidence"] = confidence

            if row["object_entity_id"]:
                target_id = _canon_entity_id(row["object_entity_id"], merge_redirect)
            elif row["object_value"]:
                target_id = f"literal:{statement_id}"
                session.add_node(
                    target_id,
                    "literal",
                    content=row["object_value"],
                    projection_layer="ledger",
                    statement_id=statement_id,
                )
            else:
                continue

            if (subject_id, target_id, surface) in typed_triples:
                continue

            session.add_edge(
                subject_id,
                target_id,
                surface,
                **edge_props,
            )
            if graph_doc_id:
                pair = (subject_id, graph_doc_id)
                if pair not in mentioned:
                    session.add_edge(
                        subject_id,
                        graph_doc_id,
                        "mentioned_in",
                        projection_layer="ledger",
                        chunk_id=chunk_id,
                    )
                    mentioned.add(pair)

        for fact in knowledge.list_typed_facts_for_projection(kb_id):
            subject_id = _canon_entity_id(fact["subject_id"], merge_redirect)
            if fact["object_entity_id"]:
                target_id = _canon_entity_id(fact["object_entity_id"], merge_redirect)
            elif fact["object_value"]:
                target_id = f"typed:{fact['id']}"
                session.add_node(
                    target_id,
                    "literal",
                    content=fact["object_value"],
                    projection_layer="typed",
                    typed_fact_id=fact["id"],
                )
            else:
                continue
            edge_label = _predicate_edge_label(fact["predicate_uri"])
            edge_props: dict[str, Any] = {
                "projection_layer": "typed",
                "typed_fact_id": fact["id"],
                "predicate_uri": fact["predicate_uri"],
            }
            if fact.get("mapping_id"):
                edge_props["mapping_id"] = fact["mapping_id"]
            if fact.get("confidence") is not None:
                edge_props["confidence"] = fact["confidence"]
            session.add_edge(subject_id, target_id, edge_label, **edge_props)

        knowledge.bump_projection_revision(kb_id)
        return session
    except Exception:
        knowledge.set_projection_status(kb_id, "failed", error_code="build_failed")
        raise


def apply_rebuild_to_session(
    knowledge: KnowledgeStore,
    kb_id: str,
    session: GraphSession,
    *,
    include_version_ids: tuple[str, ...] | None = None,
) -> dict[str, Any]:
    """Replace session graph from ledger; returns build metadata."""
    rebuilt = rebuild_graph_from_ledger(
        knowledge,
        kb_id,
        preserve_from=session,
        include_version_ids=include_version_ids,
    )
    session.graph = rebuilt.graph
    state = knowledge.get_projection_state(kb_id)
    return {
        "projection_revision": state["revision"],
        "projection_status": state["status"],
        **session.stats(),
    }
