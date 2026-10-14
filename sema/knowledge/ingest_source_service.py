"""Shared ingest-source helpers (webhook, URL pull)."""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import FastAPI

from sema.admin.errors import AdminError
from sema.knowledge.store import KnowledgeStore
from sema.pipeline.document import TextIngestOptions

_HTTP_POLL_TIMEOUT = 30.0
_HTTP_POLL_MAX_BYTES = 5 * 1024 * 1024

_DEFAULT_PROCESSING_OPTIONS = {
    "chunk": True,
    "chunk_size": 1800,
    "chunk_overlap": 250,
    "extract": True,
    "ner_method": "pattern",
    "relation_method": "pattern",
    "extract_relations": True,
    "extract_triplets": False,
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _doc_id_from_external_key(external_key: str | None, title: str) -> str:
    if external_key and external_key.strip():
        return external_key.strip()
    stem = re.sub(r"[^a-zA-Z0-9._-]+", "-", (title or "ingest").strip()).strip("-._")
    return stem or f"ingest-{uuid.uuid4().hex[:12]}"


def is_http_poll_due(source: dict[str, Any], now: datetime) -> bool:
    config = source.get("config") or {}
    interval = int(config.get("poll_interval_minutes") or 0)
    if interval <= 0:
        return False
    last = config.get("last_sync_at")
    if not last:
        return True
    try:
        last_dt = datetime.fromisoformat(str(last).replace("Z", "+00:00"))
        if last_dt.tzinfo is None:
            last_dt = last_dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return True
    elapsed = (now - last_dt).total_seconds()
    return elapsed >= interval * 60


def record_ingest_source_event(
    knowledge: KnowledgeStore,
    kb_id: str,
    source_id: str,
    event: dict[str, Any],
    *,
    max_events: int = 30,
) -> None:
    source = knowledge.get_ingest_source(kb_id, source_id)
    config = dict(source.get("config") or {})
    events = list(config.get("sync_events") or [])
    events.insert(0, event)
    config["sync_events"] = events[:max_events]
    config["last_sync_at"] = event.get("at")
    config["last_sync_status"] = event.get("status")
    knowledge.update_ingest_source(kb_id, source_id, config=config)


def fetch_http_poll_text(url: str) -> str:
    try:
        with httpx.Client(timeout=_HTTP_POLL_TIMEOUT, follow_redirects=True) as client:
            response = client.get(url)
        response.raise_for_status()
        raw = response.content
        if len(raw) > _HTTP_POLL_MAX_BYTES:
            raise AdminError(413, "payload_too_large", "响应体过大")
        text = raw.decode(response.encoding or "utf-8", errors="replace").strip()
        if not text:
            raise AdminError(422, "empty_body", "URL 返回空内容")
        return text
    except AdminError:
        raise
    except Exception as exc:
        raise AdminError(502, "fetch_failed", "拉取 URL 失败") from exc


def enqueue_text_from_source(
    app: FastAPI,
    knowledge: KnowledgeStore,
    kb_id: str,
    source_id: str,
    *,
    title: str,
    text: str,
    doc_id: str,
    auto_process: bool,
) -> dict[str, Any]:
    from sema.api.routes.ingest_helpers import enqueue_version_ingest, ingest_accept_payload

    filename = f"{doc_id}.txt"
    outcome = knowledge.store_document_bytes(
        kb_id,
        title=title,
        mime_type="text/plain",
        data=text.encode("utf-8"),
        created_by=None,
        original_filename=filename,
        external_key=doc_id,
        source_id=source_id,
    )
    if not auto_process:
        return {
            "accepted": True,
            "document_id": outcome.document_id,
            "version_id": outcome.version_id,
            "doc_id": doc_id,
            "status": "uploaded",
        }
    options = TextIngestOptions(**_DEFAULT_PROCESSING_OPTIONS)
    job = knowledge.create_processing_job(
        kb_id,
        version_id=outcome.version_id,
        options=_DEFAULT_PROCESSING_OPTIONS,
    )
    enqueue_version_ingest(
        app,
        kb_id,
        outcome.version_id,
        job["id"],
        filename=filename,
        graph_doc_id=doc_id,
        options=options,
    )
    return ingest_accept_payload(
        job_id=job["id"],
        version_id=outcome.version_id,
        ledger_document_id=outcome.document_id,
        doc_id=doc_id,
        filename=filename,
    )


def execute_http_poll_sync(
    app: FastAPI,
    knowledge: KnowledgeStore,
    kb_id: str,
    source_id: str,
    *,
    auto_process: bool,
) -> dict[str, Any]:
    source = knowledge.get_ingest_source(kb_id, source_id)
    if source["kind"] != "http_poll" or not source["enabled"]:
        raise AdminError(403, "forbidden", "来源未启用")
    url = str(source["config"].get("url") or "").strip()
    if not url:
        raise AdminError(422, "bad_url", "未配置 URL")
    at = _now_iso()
    try:
        text = fetch_http_poll_text(url)
    except AdminError:
        record_ingest_source_event(
            knowledge,
            kb_id,
            source_id,
            {"at": at, "status": "failed", "mode": "http_poll", "url": url},
        )
        raise
    except Exception as exc:
        record_ingest_source_event(
            knowledge,
            kb_id,
            source_id,
            {
                "at": at,
                "status": "failed",
                "mode": "http_poll",
                "url": url,
                "error": str(exc)[:500],
            },
        )
        raise

    prefix = str(source["config"].get("external_key_prefix") or "poll").strip() or "poll"
    doc_id = _doc_id_from_external_key(f"{prefix}-{uuid.uuid4().hex[:10]}", url)
    title = str(source["config"].get("title") or source["name"] or "HTTP poll")
    result = enqueue_text_from_source(
        app,
        knowledge,
        kb_id,
        source_id,
        title=title,
        text=text,
        doc_id=doc_id,
        auto_process=auto_process,
    )
    record_ingest_source_event(
        knowledge,
        kb_id,
        source_id,
        {
            "at": at,
            "status": "succeeded",
            "mode": "http_poll",
            "url": url,
            "doc_id": result.get("doc_id"),
            "job_id": result.get("job_id"),
        },
    )
    return result
