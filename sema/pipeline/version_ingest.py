"""Ingest a stored document version: parse → chunk → graph extract (dual-write phase)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sema.graph.session import GraphSession
from sema.knowledge.chunk_search import ChunkSearchService
from sema.knowledge.store import KnowledgeStore
from sema.pipeline.document import TextIngestOptions, _normalize_text, build_kg_from_text
from sema.pipeline.file_ingest import FileParseError, text_from_bytes
from sema.graph.projector import apply_rebuild_to_session
from sema.pipeline.ledger_extract import apply_kg_to_ledger


@dataclass(frozen=True)
class ParsedDocument:
    """Normalized parser output for a single uploaded file."""

    full_text: str
    filename: str


def parse_uploaded_bytes(filename: str, data: bytes) -> ParsedDocument:
    text = text_from_bytes(filename, data)
    return ParsedDocument(full_text=text, filename=filename)


def _chunk_texts(
    full_text: str, options: TextIngestOptions
) -> list[str]:
    if not full_text.strip():
        return []
    if not options.chunk or len(full_text) <= options.chunk_size:
        return [full_text]
    from semantica.split import TextSplitter

    splitter = TextSplitter(
        method="recursive",
        chunk_size=options.chunk_size,
        chunk_overlap=options.chunk_overlap,
    )
    parts = splitter.split(full_text)
    return [part.text for part in parts if getattr(part, "text", "").strip()]


def run_version_ingest(
    knowledge: KnowledgeStore,
    graph: GraphSession,
    kb_id: str,
    version_id: str,
    job_id: str,
    *,
    filename: str,
    graph_doc_id: str,
    options: TextIngestOptions | None = None,
    chunk_search: ChunkSearchService | None = None,
) -> dict[str, Any]:
    """Run the ingest pipeline for one version. Updates job/version status in the ledger."""
    options = options or TextIngestOptions(chunk=True)
    knowledge.set_job_status(kb_id, job_id, "running")
    knowledge.set_version_status(kb_id, version_id, "parsing")

    try:
        raw = knowledge.read_version_bytes(kb_id, version_id)
        parsed = parse_uploaded_bytes(filename, raw)
        knowledge.set_version_status(kb_id, version_id, "chunking")

        chunk_texts = _chunk_texts(parsed.full_text, options)
        if not chunk_texts and parsed.full_text.strip():
            chunk_texts = [parsed.full_text]

        existing_chunks = knowledge.list_chunks_for_version(kb_id, version_id)
        if existing_chunks:
            existing_texts = [row["text"] for row in existing_chunks]
            if existing_texts != chunk_texts:
                raise ValueError(
                    "version_already_chunked: create a new document version to change chunk options"
                )
        else:
            knowledge.create_chunks(kb_id, version_id, chunk_texts)

        embed_stats: dict[str, int] = {"indexed": 0, "skipped": 0}
        search_config = knowledge.get_search_config(kb_id)
        if (
            chunk_search is not None
            and chunk_texts
            and search_config.semantic_enabled
            and search_config.auto_index
        ):
            knowledge.set_version_status(kb_id, version_id, "embedding")
            embed_stats = chunk_search.index_version(kb_id, version_id)

        knowledge.set_version_status(kb_id, version_id, "extracting")
        chunk_rows = knowledge.list_chunks_for_version(kb_id, version_id)
        normalized = _normalize_text(parsed.full_text)
        ledger_stats = {
            "ledger_entities_written": 0,
            "ledger_statements_written": 0,
            "ledger_drops_recorded": 0,
        }
        proposed_by = f"extract:{options.ner_method}:{options.relation_method}"

        if options.extract and normalized.strip():
            for row in chunk_rows:
                chunk_doc_id = (
                    graph_doc_id
                    if len(chunk_rows) == 1
                    else f"{graph_doc_id}::chunk_{row['ordinal']}"
                )
                part = build_kg_from_text(chunk_doc_id, row["text"], options)
                part_stats = apply_kg_to_ledger(
                    knowledge,
                    kb_id,
                    version_id,
                    row["id"],
                    row["text"],
                    part,
                    proposed_by=proposed_by,
                    statement_status="pending",
                )
                for key in ledger_stats:
                    ledger_stats[key] += part_stats.get(key, 0)

        projection_meta = apply_rebuild_to_session(
            knowledge, kb_id, graph, include_version_ids=(version_id,)
        )
        knowledge.set_version_status(kb_id, version_id, "ready")

        graph_result: dict[str, Any] = {
            **projection_meta,
            "doc_id": graph_doc_id,
            "extracted": bool(options.extract and normalized.strip()),
            **ledger_stats,
        }

        result = {
            **graph_result,
            "version_id": version_id,
            "job_id": job_id,
            "document_id": graph_doc_id,
            "chunk_count": len(chunk_texts),
            "embed_indexed": embed_stats.get("indexed", 0),
            "embed_skipped": embed_stats.get("skipped", 0),
            "ledger_status": "ready",
            "ledger_statement_count": knowledge.count_statements_for_version(kb_id, version_id),
        }
        knowledge.set_job_result(kb_id, job_id, result)
        knowledge.set_job_status(kb_id, job_id, "succeeded")
        return result
    except FileParseError as exc:
        knowledge.fail_version(kb_id, version_id, "parse_failed", exc.message)
        knowledge.fail_job(kb_id, job_id, "parse_failed", exc.message)
        raise
    except Exception as exc:
        message = str(exc) or "ingest_failed"
        knowledge.fail_version(kb_id, version_id, "ingest_failed", message)
        knowledge.fail_job(kb_id, job_id, "ingest_failed", message)
        projection = knowledge.get_projection_state(kb_id)
        if projection["status"] != "failed":
            knowledge.set_projection_status(kb_id, "dirty", error_code="ingest_incomplete")
        raise
