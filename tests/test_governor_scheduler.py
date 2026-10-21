"""Scheduled governor passes (F-GOV-04 Phase B)."""

from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock

from basis.domain.knowledge.blob_store import BlobStore
from basis.domain.knowledge.governance_config import GovernanceConfig
from basis.domain.knowledge.schedulers.governor_poll_scheduler import run_due_governor_passes
from basis.domain.knowledge.schedulers.governor_poll_due import is_governor_due
from basis.domain.knowledge.store import KnowledgeStore


def _kb(tmp_path: Path) -> tuple[str, KnowledgeStore]:
    from basis.domain.tenancy.admin.store import AdminStore

    admin = AdminStore(tmp_path / "basis.db")
    user, _ = admin.register("sched@example.com", "password1", "Sched")
    workspace_id = admin.create_workspace(user, "Sched KB", None, "restricted").id
    admin.close()
    store = KnowledgeStore(tmp_path / "basis.db", BlobStore(tmp_path))
    return workspace_id, store


def test_is_governor_due_when_enabled_and_never_run(tmp_path: Path) -> None:
    workspace_id, store = _kb(tmp_path)
    store.update_governance_config(
        workspace_id,
        governor_enabled=True,
        governor_interval_minutes=60,
        governor_confidence_min=0.8,
    )
    config = store.get_governance_config(workspace_id)
    now = datetime.now(timezone.utc)
    assert is_governor_due(config, now) is True


def test_run_due_governor_passes_executes(tmp_path: Path) -> None:
    workspace_id, store = _kb(tmp_path)
    store.update_governance_config(
        workspace_id,
        governor_enabled=True,
        governor_interval_minutes=60,
        governor_confidence_min=0.75,
    )
    app = MagicMock()
    app.state.knowledge_store = store
    ran = run_due_governor_passes(app)
    assert ran == 1
    config = store.get_governance_config(workspace_id)
    assert config.governor_last_run_at is not None


def test_governor_disabled_not_due(tmp_path: Path) -> None:
    config = GovernanceConfig(workspace_id="x", governor_enabled=False, governor_interval_minutes=60)
    assert is_governor_due(config, datetime.now(timezone.utc)) is False
