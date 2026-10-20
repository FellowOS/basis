"""Persist per-knowledge-base ContextGraph snapshots on disk (not SQL persistence)."""

from __future__ import annotations

import json
import os
import re
import threading
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from basis.core.projection.session import GraphSession

_SAFE_KB_ID = re.compile(r"[^a-zA-Z0-9._-]+")
_kb_write_locks: dict[str, threading.Lock] = {}
_lock_guard = threading.Lock()


@dataclass(frozen=True)
class GraphSnapshotMeta:
    projection_revision: int
    schema_version: int
    saved_at: str
    kb_id: str


def _kb_write_lock(kb_id: str) -> threading.Lock:
    with _lock_guard:
        lock = _kb_write_locks.get(kb_id)
        if lock is None:
            lock = threading.Lock()
            _kb_write_locks[kb_id] = lock
        return lock


def _fsync_path(path: Path) -> None:
    with path.open("rb") as handle:
        os.fsync(handle.fileno())


def _atomic_replace(tmp: Path, final: Path) -> None:
    _fsync_path(tmp)
    os.replace(tmp, final)


class GraphPersistence:
    """Filesystem snapshot store for projected ContextGraph JSON per KB."""

    def __init__(self, data_dir: Path) -> None:
        self._dir = data_dir / "graphs"
        self._dir.mkdir(parents=True, exist_ok=True)

    def graph_path(self, kb_id: str) -> Path:
        safe = _SAFE_KB_ID.sub("_", kb_id).strip("._") or "kb"
        return self._dir / f"{safe}.json"

    def meta_path(self, kb_id: str) -> Path:
        return self.graph_path(kb_id).with_suffix(".json.meta")

    def _path(self, kb_id: str) -> Path:
        return self.graph_path(kb_id)

    def _read_meta(self, kb_id: str) -> GraphSnapshotMeta | None:
        path = self.meta_path(kb_id)
        if not path.is_file():
            return None
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None
        return GraphSnapshotMeta(
            projection_revision=int(payload.get("projection_revision", 0)),
            schema_version=int(payload.get("schema_version", 0)),
            saved_at=str(payload.get("saved_at", "")),
            kb_id=str(payload.get("kb_id", kb_id)),
        )

    def _write_meta_atomic(
        self,
        kb_id: str,
        *,
        projection_revision: int,
        schema_version: int,
    ) -> None:
        final = self.meta_path(kb_id)
        tmp = final.with_name(f"{final.name}.{uuid.uuid4().hex}.tmp")
        payload = {
            "kb_id": kb_id,
            "projection_revision": projection_revision,
            "schema_version": schema_version,
            "saved_at": datetime.now(timezone.utc).isoformat(),
        }
        tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        _atomic_replace(tmp, final)

    def load_snapshot(self, kb_id: str) -> tuple[GraphSession, GraphSnapshotMeta | None]:
        session = GraphSession()
        path = self._path(kb_id)
        for stale in path.parent.glob(f"{path.name}.*.tmp"):
            try:
                stale.unlink(missing_ok=True)
            except OSError:
                pass
        if path.is_file():
            session.graph.load_from_file(path)
        return session, self._read_meta(kb_id)

    def load(self, kb_id: str) -> GraphSession:
        session, _meta = self.load_snapshot(kb_id)
        return session

    def save(
        self,
        kb_id: str,
        session: GraphSession,
        *,
        projection_revision: int = 0,
        schema_version: int = 1,
    ) -> GraphSnapshotMeta:
        path = self._path(kb_id)
        tmp = path.with_name(f"{path.name}.{uuid.uuid4().hex}.tmp")
        with _kb_write_lock(kb_id):
            session.graph.save_to_file(tmp)
            _atomic_replace(tmp, path)
            self._write_meta_atomic(
                kb_id,
                projection_revision=projection_revision,
                schema_version=schema_version,
            )
        meta = self._read_meta(kb_id)
        assert meta is not None
        return meta

    def delete(self, kb_id: str) -> None:
        with _kb_write_lock(kb_id):
            path = self._path(kb_id)
            if path.is_file():
                path.unlink()
            meta = self.meta_path(kb_id)
            if meta.is_file():
                meta.unlink()
            hub = self.graph_path(kb_id).with_suffix(".ontology-hub.json")
            if hub.is_file():
                hub.unlink()
