"""Scheduled governor passes (F-GOV-04 Phase B)."""

from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock

from basis.core.ledger.blob_store import BlobStore
from basis.core.ledger.governance_config import GovernanceConfig
from basis.core.ledger.schedulers.governor_poll_scheduler import run_due_governor_passes
from basis.core.ledger.schedulers.governor_poll_due import is_governor_due
from basis.core.ledger.store import KnowledgeStore


def _kb(tmp_path: Path) -> tuple[str, KnowledgeStore]:
    from basis.control.admin.store import AdminStore

    admin = AdminStore(tmp_path / "basis.db")
    user, _ = admin.register("sched@example.com", "password1", "Sched")
    kb_id = admin.create_kb(user, "Sched KB", None, "restricted").id
    admin.close()
    store = KnowledgeStore(tmp_path / "basis.db", BlobStore(tmp_path))
    return kb_id, store


def test_is_governor_due_when_enabled_and_never_run(tmp_path: Path) -> None:
    kb_id, store = _kb(tmp_path)
    store.update_governance_config(
        kb_id,
        governor_enabled=True,
        governor_interval_minutes=60,
        governor_confidence_min=0.8,
    )
    config = store.get_governance_config(kb_id)
    now = datetime.now(timezone.utc)
    assert is_governor_due(config, now) is True


def test_run_due_governor_passes_executes(tmp_path: Path) -> None:
    kb_id, store = _kb(tmp_path)
    store.update_governance_config(
        kb_id,
        governor_enabled=True,
        governor_interval_minutes=60,
        governor_confidence_min=0.75,
    )
    app = MagicMock()
    app.state.knowledge_store = store
    ran = run_due_governor_passes(app)
    assert ran == 1
    config = store.get_governance_config(kb_id)
    assert config.governor_last_run_at is not None


def test_governor_disabled_not_due(tmp_path: Path) -> None:
    config = GovernanceConfig(kb_id="x", governor_enabled=False, governor_interval_minutes=60)
    assert is_governor_due(config, datetime.now(timezone.utc)) is False
