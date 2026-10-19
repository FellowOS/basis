"""Platform-wide BOCP provider allowlist (stored in ``settings``)."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from basis.domain.connectors.allowlist import (
    PLATFORM_CONNECTOR_ALLOWLIST_KEY,
    normalize_allowed_providers,
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_platform_allowed_providers(conn: Any) -> list[str] | str:
    row = conn.execute(
        "SELECT value FROM settings WHERE key = ?",
        (PLATFORM_CONNECTOR_ALLOWLIST_KEY,),
    ).fetchone()
    if not row or not row[0]:
        return "*"
    try:
        parsed = json.loads(row[0])
    except json.JSONDecodeError:
        return "*"
    return normalize_allowed_providers(parsed)


def upsert_platform_allowed_providers(
    conn: Any,
    allowed_providers: list[str] | str,
) -> tuple[list[str] | str, str]:
    normalized = normalize_allowed_providers(allowed_providers)
    now = _now_iso()
    payload = json.dumps(normalized, ensure_ascii=False)
    conn.execute(
        """
        INSERT INTO settings(key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        """,
        (PLATFORM_CONNECTOR_ALLOWLIST_KEY, payload),
    )
    conn.commit()
    return normalized, now
