"""KB governance / governor scheduler — KnowledgeStore API."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from basis.core.ledger.governance_config import GovernanceConfig, validate_governance_config
from basis.core.ledger.persistence import governance_config as gov_persist

if TYPE_CHECKING:
    from basis.core.ledger.store import KnowledgeStore


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class GovernanceAccess:
    def __init__(self, store: KnowledgeStore) -> None:
        self._store = store

    def get_governance_config(self, kb_id: str) -> GovernanceConfig:
        with self._store._lock:
            self._store._assert_kb_exists(kb_id)
            row = gov_persist.fetch_governance_config_row(self._store._conn, kb_id)
            if row is None:
                now = _now()
                gov_persist.insert_default_governance_config(
                    self._store._conn, kb_id, created_at=now, updated_at=now
                )
                self._store._conn.commit()
                return GovernanceConfig(kb_id=kb_id)
        return gov_persist.governance_config_from_row(row)

    def update_governance_config(
        self,
        kb_id: str,
        *,
        governor_enabled: bool,
        governor_interval_minutes: int,
        governor_confidence_min: float,
    ) -> GovernanceConfig:
        config = GovernanceConfig(
            kb_id=kb_id,
            governor_enabled=governor_enabled,
            governor_interval_minutes=governor_interval_minutes,
            governor_confidence_min=governor_confidence_min,
        )
        validate_governance_config(config)
        existing = self.get_governance_config(kb_id)
        config = GovernanceConfig(
            kb_id=kb_id,
            schema_version=existing.schema_version,
            governor_enabled=governor_enabled,
            governor_interval_minutes=governor_interval_minutes,
            governor_confidence_min=governor_confidence_min,
            governor_last_run_at=existing.governor_last_run_at,
        )
        with self._store._lock:
            now = _now()
            gov_persist.upsert_governance_config(
                self._store._conn, config, created_at=now, updated_at=now
            )
            self._store._conn.commit()
        return config

    def touch_governor_last_run(self, kb_id: str, run_at: str) -> None:
        _ = self.get_governance_config(kb_id)
        with self._store._lock:
            gov_persist.touch_governor_last_run(
                self._store._conn, kb_id, run_at, _now()
            )
            self._store._conn.commit()

    def list_governor_enabled_kb_ids(self) -> list[str]:
        with self._store._lock:
            try:
                return gov_persist.list_governor_enabled_kb_ids(self._store._conn)
            except Exception as exc:
                msg = str(exc).lower()
                if "kb_governance_configs" in msg and (
                    "does not exist" in msg or "no such table" in msg
                ):
                    return []
                raise
