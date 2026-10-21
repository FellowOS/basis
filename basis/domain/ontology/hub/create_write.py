"""Create ontology in graph session + workspace registry (no Explorer route handlers)."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from basis.domain.errors import AdminError

logger = logging.getLogger(__name__)


def _engine_config(session: Any, provider: str | None, model: str | None) -> dict[str, Any]:
    config: dict[str, Any] = {
        "store": session.graph.store if hasattr(session.graph, "store") else None,
    }
    if provider:
        config["provider"] = provider
    if model:
        config["model"] = model
    return config


def _append_engine_result(
    ns: str,
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
    result: dict[str, Any],
) -> None:
    for cls in result.get("classes", []):
        cls_uri = f"{ns}/{cls.get('name', uuid.uuid4().hex[:6])}"
        nodes.append(
            {
                "id": cls_uri,
                "type": "owl:Class",
                "content": cls.get("name", ""),
                "properties": {
                    "rdfs:label": cls.get("name", ""),
                    "rdfs:comment": cls.get("description", ""),
                },
            }
        )

    for prop in result.get("properties", []):
        prop_uri = f"{ns}/{prop.get('name', uuid.uuid4().hex[:6])}"
        nodes.append(
            {
                "id": prop_uri,
                "type": "owl:ObjectProperty",
                "content": prop.get("name", ""),
                "properties": {"rdfs:label": prop.get("name", "")},
            }
        )
        domain = prop.get("domain")
        if domain and str(domain).strip():
            domain_uri = f"{ns}/{domain}"
            edges.append(
                {
                    "source": prop_uri,
                    "target": domain_uri,
                    "type": "rdfs:domain",
                    "weight": 1.0,
                }
            )
        range_val = prop.get("range")
        if range_val and str(range_val).strip():
            range_uri = f"{ns}/{range_val}"
            edges.append(
                {
                    "source": prop_uri,
                    "target": range_uri,
                    "type": "rdfs:range",
                    "weight": 1.0,
                }
            )

    for cls in result.get("classes", []):
        cls_uri = f"{ns}/{cls.get('name', '')}"
        for parent in cls.get("superclasses", []):
            parent_uri = f"{ns}/{parent}"
            edges.append(
                {
                    "source": cls_uri,
                    "target": parent_uri,
                    "type": "rdfs:subClassOf",
                    "weight": 1.0,
                }
            )


def create_ontology(
    session: Any,
    registry: dict[str, Any],
    *,
    namespace: str,
    name: str,
    description: str | None = None,
    tags: list[str] | None = None,
    mode: str = "scratch",
    sample_data: str | None = None,
    schema_text: str | None = None,
    provider: str | None = None,
    model: str | None = None,
) -> dict[str, Any]:
    ns = namespace.rstrip("/#")
    onto_uri = f"{ns}#ontology"

    nodes: list[dict[str, Any]] = [
        {
            "id": onto_uri,
            "type": "owl:Ontology",
            "content": name,
            "properties": {
                "rdfs:label": name,
                "rdfs:comment": description or "",
                "namespace": namespace,
            },
        }
    ]
    edges: list[dict[str, Any]] = []

    if mode == "data" and sample_data:
        try:
            from semantica.ontology import OntologyEngine

            engine = OntologyEngine(**_engine_config(session, provider, model))
            result = engine.from_data(sample_data)
            if isinstance(result, dict):
                _append_engine_result(ns, nodes, edges, result)
            logger.info("Generated ontology from sample data with %s nodes, %s edges", len(nodes), len(edges))
        except Exception as exc:
            logger.exception("Failed to generate ontology from sample data")
            raise AdminError(500, "internal_error", f"Ontology generation failed: {exc}") from exc

    elif mode == "text" and schema_text:
        try:
            from semantica.ontology import OntologyEngine

            engine = OntologyEngine(**_engine_config(session, provider, model))
            result = engine.from_text(schema_text, provider=provider, model=model)
            if isinstance(result, dict):
                _append_engine_result(ns, nodes, edges, result)
            logger.info("Generated ontology from text with %s nodes, %s edges", len(nodes), len(edges))
        except Exception as exc:
            logger.exception("Failed to generate ontology from schema text")
            raise AdminError(500, "internal_error", f"Ontology generation failed: {exc}") from exc

    try:
        nodes_added, edges_added = session.add_nodes_and_edges(nodes, edges)
    except ValueError as exc:
        raise AdminError(422, "validation_error", str(exc)) from exc

    registry[onto_uri] = {
        "uri": onto_uri,
        "name": name,
        "description": description,
        "format": "turtle",
        "status": "draft",
        "version": "0.1.0",
        "class_count": sum(1 for n in nodes if n.get("type") == "owl:Class"),
        "loaded_at": datetime.now(timezone.utc).isoformat(),
        "enabled": True,
        "tags": list(tags or []),
    }

    return {
        "status": "success",
        "uri": onto_uri,
        "name": name,
        "nodes_added": nodes_added,
        "edges_added": edges_added,
        "format": "turtle",
    }
