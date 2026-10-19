"""Explorer graph staging API on KnowledgeStore."""

from __future__ import annotations

from typing import Any, TYPE_CHECKING

from basis.domain.connectors.canonical_db import LockedCanonicalConn
from basis.domain.kb.persistence.graph_staging import GraphStagingPersistence

if TYPE_CHECKING:
    from basis.domain.kb.store import KnowledgeStore


class ExplorerKbAccess:
    def __init__(self, store: KnowledgeStore) -> None:
        self._store = store

    def _persist(self) -> GraphStagingPersistence:
        return GraphStagingPersistence(LockedCanonicalConn(self._store))

    def graph_staging_at(
        self,
        session: Any,
        kb_id: str,
        from_time: str,
        to_time: str,
        *,
        updated_by: str | None = None,
    ) -> dict[str, Any]:
        from basis.domain.explorer.graph_diff import diff_session_at
        from basis.domain.explorer.graph_staging import (
            build_graph_staging_payload,
            staging_session_key,
        )

        with self._store._lock:
            diff = diff_session_at(session, from_time, to_time)
            skey = staging_session_key(
                kb_id, str(diff.get("from_time") or from_time), str(diff.get("to_time") or to_time)
            )
            persist = self._persist()
            persisted_draft = persist.get_draft(kb_id, skey)
            payload = build_graph_staging_payload(kb_id, diff, draft=persisted_draft)
            persist.upsert_session(
                kb_id,
                session_key=skey,
                from_time=str(diff.get("from_time") or from_time),
                to_time=str(diff.get("to_time") or to_time),
                draft=persisted_draft,
                manifest=payload["manifest"],
                updated_by=updated_by,
            )
            return payload

    def upsert_graph_staging_session(
        self,
        kb_id: str,
        *,
        session_key: str,
        from_time: str = "",
        to_time: str = "",
        draft: dict[str, Any] | None = None,
        updated_by: str | None = None,
    ) -> dict[str, Any]:
        with self._store._lock:
            return self._persist().upsert_session(
                kb_id,
                session_key=session_key,
                from_time=from_time,
                to_time=to_time,
                draft=draft,
                updated_by=updated_by,
            )
