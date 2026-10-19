"""Background scheduled agent governor passes (F-GOV-04 Phase B)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import FastAPI

from basis.domain.kb.services.governor import run_governor_pass
from basis.domain.kb.schedulers.governor_poll_due import is_governor_due
from basis.infra.observability.log_context import correlation_log_extra

logger = logging.getLogger(__name__)


def run_due_governor_passes(app: FastAPI) -> int:
    """Run governor for KBs with scheduling enabled and interval elapsed."""
    knowledge = app.state.knowledge_store
    now = datetime.now(timezone.utc)
    ran = 0
    for kb_id in knowledge.list_governor_enabled_kb_ids():
        config = knowledge.get_governance_config(kb_id)
        if not is_governor_due(config, now):
            continue
        try:
            run_governor_pass(
                knowledge,
                kb_id,
                confidence_min=config.governor_confidence_min,
            )
            knowledge.touch_governor_last_run(kb_id, now.isoformat())
            ran += 1
        except Exception:
            logger.exception(
                "scheduled governor pass failed kb=%s",
                kb_id,
                extra=correlation_log_extra(kb_id=kb_id),
            )
    return ran
