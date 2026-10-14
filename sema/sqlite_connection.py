"""Shared SQLite connection settings (AdminStore + KnowledgeStore use one DB file)."""

from __future__ import annotations

import sqlite3
from pathlib import Path

# Milliseconds to wait when another connection holds the DB (e.g. explorer + playground).
DEFAULT_BUSY_TIMEOUT_MS = 30_000


def connect_sqlite(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute(f"PRAGMA busy_timeout={DEFAULT_BUSY_TIMEOUT_MS}")
    conn.execute("PRAGMA journal_mode=WAL")
    return conn
