#!/usr/bin/env python3
"""Knowledge may import domain.connector only via connector_port (and listed modules)."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KNOWLEDGE = ROOT / "basis" / "domain" / "knowledge"

IMPORT_RE = re.compile(
    r"^\s*(?:from|import)\s+(basis\.domain\.connector(?:\.[a-zA-Z0-9_]+)*)",
    re.MULTILINE,
)

ALLOWED_FILES = frozenset(
    {
        KNOWLEDGE / "connector_port.py",
        KNOWLEDGE / "sql_connector_vault.py",
        KNOWLEDGE / "sql_connector_sync.py",
        KNOWLEDGE / "sql_graph_staging.py",
        KNOWLEDGE / "access" / "graph_staging.py",
        KNOWLEDGE / "access" / "connector.py",
    }
)


def main() -> int:
    errors: list[str] = []
    for path in sorted(KNOWLEDGE.rglob("*.py")):
        if path in ALLOWED_FILES:
            continue
        text = path.read_text(encoding="utf-8")
        for match in IMPORT_RE.finditer(text):
            errors.append(
                f"{path.relative_to(ROOT)}: forbidden import {match.group(1)!r} "
                "(use basis.domain.knowledge.connector_port or extend allowlist)"
            )
    if errors:
        for line in errors:
            print(line, file=sys.stderr)
        return 1
    print(f"OK: knowledge connector imports limited to {len(ALLOWED_FILES)} modules + port.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
