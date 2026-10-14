"""Document ingest via Semantica SDK (normalize → extract → GraphBuilder → ContextGraph)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sema.graph.session import GraphSession
from sema.pipeline.kg_apply import apply_kg_to_session


@dataclass(frozen=True)
class TextIngestOptions:
    """Controls how raw text is processed before landing on the KB graph."""

    extract: bool = True
    chunk: bool = False
    chunk_size: int = 1800
    chunk_overlap: int = 250
    ner_method: str = "pattern"
    relation_method: str = "pattern"
    extract_relations: bool = True
    extract_triplets: bool = False
    merge_entities: bool = True


def _normalize_text(text: str) -> str:
    from semantica.normalize import clean_text, normalize_text

    cleaned = clean_text(text, method="default")
    if not cleaned:
        return ""
    return normalize_text(cleaned, method="default")


def build_kg_from_text(doc_id: str, text: str, options: TextIngestOptions) -> dict[str, Any]:
    """Run Semantica GraphBuilder on plain text segments.

    ``doc_id`` is Sema's graph/ledger document key only — it must not be passed as a
    GraphBuilder source ``id``, or extraction is skipped (prebuilt-entity shortcut).
    """
    from semantica.kg import GraphBuilder

    builder = GraphBuilder(merge_entities=options.merge_entities, resolve_conflicts=False)
    segments: list[str] = [text]

    if options.chunk and len(text) > options.chunk_size:
        from semantica.split import TextSplitter

        splitter = TextSplitter(
            method="recursive",
            chunk_size=options.chunk_size,
            chunk_overlap=options.chunk_overlap,
        )
        chunks = splitter.split(text)
        segments = [
            chunk.text
            for chunk in chunks
            if getattr(chunk, "text", "").strip()
        ] or [text]

    build_kwargs = {
        "extract": options.extract,
        "ner_method": options.ner_method,
        "relation_method": options.relation_method,
        "extract_relations": options.extract_relations,
        "extract_triplets": options.extract_triplets,
    }

    merged: dict[str, Any] = {"entities": [], "relationships": [], "metadata": {}}
    for segment in segments:
        kg_part = builder.build(segment, **build_kwargs)
        merged["entities"].extend(kg_part.get("entities") or [])
        merged["relationships"].extend(kg_part.get("relationships") or [])
    return merged


def ingest_text(
    session: GraphSession,
    doc_id: str,
    text: str,
    *,
    options: TextIngestOptions | None = None,
) -> dict[str, Any]:
    """Record a document and optionally run Semantica extraction into the KB graph."""
    options = options or TextIngestOptions()
    session.add_node(doc_id, "document", content=text, text=text)

    normalized = _normalize_text(text)
    result: dict[str, Any] = {
        **session.stats(),
        "doc_id": doc_id,
        "entities_added": 0,
        "relationships_added": 0,
        "extracted": False,
    }

    if not options.extract or not normalized.strip():
        return result

    kg = build_kg_from_text(doc_id, normalized, options)
    applied = apply_kg_to_session(session, kg, doc_id=doc_id)
    result.update(applied)
    result["extracted"] = True
    result.update(session.stats())
    return result
