"""Background scheduled agent governor passes (F-GOV-04 Phase B)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import FastAPI

from basis.domain.knowledge.services.governor import run_governor_pass
from basis.domain.knowledge.schedulers.governor_poll_due import is_governor_due
from basis.infra.runtime.observability.log_context import correlation_log_extra

logger = logging.getLogger(__name__)


def run_due_governor_passes(app: FastAPI) -> int:
    """Run governor for workspaces with scheduling enabled and interval elapsed."""
    knowledge = app.state.knowledge_store
    now = datetime.now(timezone.utc)
    ran = 0
    for workspace_id in knowledge.list_governor_enabled_workspace_ids():
        config = knowledge.get_governance_config(workspace_id)
        if not is_governor_due(config, now):
            continue
        try:
            run_governor_pass(
                knowledge,
                workspace_id,
                confidence_min=config.governor_confidence_min,
            )
            knowledge.touch_governor_last_run(workspace_id, now.isoformat())
            ran += 1
        except Exception:
            logger.exception(
                "scheduled governor pass failed kb=%s",
                workspace_id,
                extra=correlation_log_extra(workspace_id=workspace_id),
            )
    return ran
