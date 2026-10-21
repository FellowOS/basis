"""Ontology load into graph session + KB registry (no Explorer route handlers)."""

from __future__ import annotations

import logging
import os
import uuid
from collections.abc import Callable
from datetime import datetime, timezone
from tempfile import NamedTemporaryFile
from typing import Any

from basis.domain.graph.explorer.ontology.hub.catalog import _classify_node_type
from basis.domain.graph.explorer.ontology.browse.preview_read import detect_format, normalize_format
from basis.domain.errors import AdminError

logger = logging.getLogger(__name__)

_INGEST_FORMAT_SUFFIXES: dict[str, str] = {
    "turtle": ".ttl",
    "xml": ".rdf",
    "json-ld": ".jsonld",
    "nt": ".nt",
    "n3": ".n3",
    "trig": ".trig",
    "nquads": ".nq",
}


def _count_entity_types(nodes: list[dict[str, Any]]) -> tuple[int, int, int]:
    classes = concepts = properties = 0
    for node in nodes:
        kind = _classify_node_type(node.get("type", ""))
        if kind == "class":
            classes += 1
        elif kind == "concept":
            concepts += 1
        elif kind == "property":
            properties += 1
    return classes, concepts, properties


def _register_ontology(
    registry: dict[str, Any],
    *,
    ontology_uri: str,
    name: str,
    description: str | None,
    fmt: str,
    version: str | None,
    class_count: int,
    concept_count: int,
    property_count: int,
    tags: list[str] | None,
    source_url: str | None,
) -> None:
    registry[ontology_uri] = {
        "uri": ontology_uri,
        "name": name,
        "description": description,
        "format": fmt,
        "status": "external",
        "version": version or "1.0",
        "class_count": class_count,
        "concept_count": concept_count,
        "property_count": property_count,
        "loaded_at": datetime.now(timezone.utc).isoformat(),
        "enabled": True,
        "tags": list(tags or []),
        "source_url": source_url,
    }


def _load_response(
    *,
    ontology_uri: str,
    name: str,
    nodes_added: int,
    edges_added: int,
    fmt: str,
) -> dict[str, Any]:
    return {
        "status": "success",
        "uri": ontology_uri,
        "name": name,
        "nodes_added": nodes_added,
        "edges_added": edges_added,
        "format": fmt,
    }


def load_ontology(
    session: Any,
    registry: dict[str, Any],
    *,
    url: str | None,
    content: str | None,
    format: str | None,
    name: str | None = None,
    description: str | None = None,
    tags: list[str] | None = None,
    fetch_url_bytes: Callable[[str], bytes],
    parse_rdf_sync: Callable[[bytes, str], tuple[Any, Any, dict[str, Any]]],
    content_likely_owl: Callable[[str], bool],
    convert_ontology_to_graph: Callable[[dict[str, Any]], tuple[list[Any], list[Any]]],
) -> dict[str, Any]:
    if not url and not content:
        raise AdminError(422, "validation_error", "Provide either url or content.")

    if url:
        raw = fetch_url_bytes(url)
        content_str = raw.decode("utf-8", errors="replace")
    else:
        content_str = content or ""

    fmt = normalize_format(format) if format else detect_format(content_str)
    suffix = _INGEST_FORMAT_SUFFIXES.get(fmt)
    if suffix is None:
        raise AdminError(422, "validation_error", f"Unsupported ontology format: {fmt}")

    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]
    metadata: dict[str, Any]

    if not content_likely_owl(content_str):
        try:
            nodes, edges, metadata = parse_rdf_sync(content_str.encode("utf-8"), fmt)
        except AdminError:
            raise
        except Exception as exc:
            raise AdminError(422, "validation_error", f"Could not parse ontology: {exc}") from exc
    else:
        try:
            from semantica.ingest.ontology_ingestor import OntologyIngestor

            ingestor = OntologyIngestor()
            with NamedTemporaryFile(mode="w", suffix=suffix, delete=False, encoding="utf-8") as temp_file:
                temp_file.write(content_str)
                temp_path = temp_file.name
            try:
                ontology_data = ingestor.ingest_ontology(temp_path, format=fmt)
                data = ontology_data.data
                if not data.get("classes") and not data.get("properties"):
                    raise ValueError("No OWL classes or properties found by OntologyIngestor")

                nodes, edges = convert_ontology_to_graph(data)
                try:
                    nodes_added, edges_added = session.add_nodes_and_edges(nodes, edges)
                except ValueError as exc:
                    raise AdminError(422, "validation_error", str(exc)) from exc

                ontology_uri = data.get("uri", f"temp:{uuid.uuid4().hex[:12]}")
                display_name = name or data.get("name", "Imported Ontology")
                cc, cn, cp = _count_entity_types(nodes)
                _register_ontology(
                    registry,
                    ontology_uri=ontology_uri,
                    name=display_name,
                    description=description or data.get("description"),
                    fmt=fmt,
                    version=data.get("version", "1.0"),
                    class_count=cc,
                    concept_count=cn,
                    property_count=cp,
                    tags=tags,
                    source_url=url,
                )
                return _load_response(
                    ontology_uri=ontology_uri,
                    name=display_name,
                    nodes_added=nodes_added,
                    edges_added=edges_added,
                    fmt=fmt,
                )
            finally:
                try:
                    os.unlink(temp_path)
                except OSError as cleanup_exc:
                    logger.debug("Failed to remove temporary ontology file: %s", cleanup_exc)
        except AdminError:
            raise
        except Exception as ingest_exc:
            logger.warning("OntologyIngestor failed, falling back to basic parsing: %s", ingest_exc)
            try:
                nodes, edges, metadata = parse_rdf_sync(content_str.encode("utf-8"), fmt)
            except AdminError:
                raise
            except Exception as exc:
                raise AdminError(422, "validation_error", f"Could not parse ontology: {exc}") from exc

    try:
        nodes_added, edges_added = session.add_nodes_and_edges(nodes, edges)
    except ValueError as exc:
        raise AdminError(422, "validation_error", str(exc)) from exc

    ontology_uri = metadata.get("uri", f"temp:{uuid.uuid4().hex[:12]}")
    display_name = name or metadata.get("name", "Imported Ontology")
    cc, cn, cp = _count_entity_types(nodes)
    _register_ontology(
        registry,
        ontology_uri=ontology_uri,
        name=display_name,
        description=description or metadata.get("description"),
        fmt=fmt,
        version=metadata.get("version", "1.0"),
        class_count=cc,
        concept_count=cn,
        property_count=cp,
        tags=tags,
        source_url=url,
    )
    return _load_response(
        ontology_uri=ontology_uri,
        name=display_name,
        nodes_added=nodes_added,
        edges_added=edges_added,
        fmt=fmt,
    )
