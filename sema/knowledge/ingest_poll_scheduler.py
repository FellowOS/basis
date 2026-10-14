"""Background HTTP poll for ingest sources."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import FastAPI

from sema.knowledge.ingest_source_service import execute_http_poll_sync, is_http_poll_due

logger = logging.getLogger(__name__)


def run_due_http_polls(app: FastAPI) -> int:
    """Run all due http_poll sources once. Returns count executed."""
    knowledge = app.state.knowledge_store
    now = datetime.now(timezone.utc)
    sources = knowledge.list_http_poll_sources_global()
    ran = 0
    for source in sources:
        if not is_http_poll_due(source, now):
            continue
        kb_id = source["kb_id"]
        source_id = source["id"]
        try:
            execute_http_poll_sync(app, knowledge, kb_id, source_id, auto_process=True)
            ran += 1
        except Exception:
            logger.exception("http_poll failed kb=%s source=%s", kb_id, source_id)
    return ran
