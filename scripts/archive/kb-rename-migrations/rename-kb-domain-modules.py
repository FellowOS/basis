#!/usr/bin/env python3
"""Rename domain-layer kb_* modules and sql_kb_* persistence helpers."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SKIP_PARTS = {
    ".git",
    ".venv",
    "venv",
    "node_modules",
    "docs",
    "__pycache__",
    "desktop/release",
    "desktop/pack",
    ".api-stage",
}

TEXT_SUFFIXES = {".py", ".md", ".mjs", ".sh", ".yml", ".yaml", ".ini", ".toml"}

# old dotted module suffix → new (under basis.domain / basis.domain.knowledge)
RENAMES: dict[str, str] = {
    "basis.domain.knowledge.access.alerts": "basis.domain.knowledge.access.alerts",
    "basis.domain.knowledge.services.alerts_emit": "basis.domain.knowledge.services.alerts_emit",
    "basis.domain.ontology.hub.scoped_state": "basis.domain.ontology.hub.scoped_state",
    "basis.domain.bridges.graph_session": "basis.domain.bridges.graph_session",
    "basis.domain.knowledge.sql_alerts": "basis.domain.knowledge.sql_alerts",
    "basis.domain.knowledge.sql_delete": "basis.domain.knowledge.sql_delete",
    "basis.domain.knowledge.sql_stats": "basis.domain.knowledge.sql_stats",
    "basis.domain.graph.session.basis_graph_session": "basis.domain.graph.session.basis_graph_session",
}


def _skipped(path: Path) -> bool:
    return any(part in SKIP_PARTS for part in path.parts)


def git_mv(old: Path, new: Path) -> None:
    if not old.is_file():
        raise SystemExit(f"missing {old}")
    if new.exists():
        raise SystemExit(f"target exists: {new}")
    subprocess.run(["git", "mv", str(old), str(new)], cwd=ROOT, check=True)


def main() -> int:
    file_moves = [
        (ROOT / "basis/domain/knowledge/access/kb_alerts.py", ROOT / "basis/domain/knowledge/access/workspace_alerts.py"),
        (ROOT / "basis/domain/knowledge/services/kb_alerts_emit.py", ROOT / "basis/domain/knowledge/services/workspace_alerts_emit.py"),
        (ROOT / "basis/domain/ontology/hub/kb_scoped_state.py", ROOT / "basis/domain/ontology/hub/workspace_scoped_state.py"),
        (ROOT / "basis/domain/bridges/kb_graph_session.py", ROOT / "basis/domain/bridges/workspace_graph_session.py"),
        (ROOT / "basis/domain/knowledge/sql_alerts.py", ROOT / "basis/domain/knowledge/sql_alerts.py"),
        (ROOT / "basis/domain/knowledge/sql_delete.py", ROOT / "basis/domain/knowledge/sql_delete.py"),
        (ROOT / "basis/domain/knowledge/sql_stats.py", ROOT / "basis/domain/knowledge/sql_stats.py"),
        (
            ROOT / "basis/domain/graph/session/basis_kb_graph_session.py",
            ROOT / "basis/domain/graph/session/basis_workspace_graph_session.py",
        ),
    ]

    for old, new in file_moves:
        print(f"git mv {old.relative_to(ROOT)} → {new.name}")
        git_mv(old, new)

    pairs = sorted(RENAMES.items(), key=lambda x: len(x[0]), reverse=True)
    changed = 0
    for path in ROOT.rglob("*"):
        if not path.is_file() or _skipped(path):
            continue
        if path.suffix not in TEXT_SUFFIXES:
            continue
        text = path.read_text(encoding="utf-8")
        new_text = text
        for old, new in pairs:
            new_text = new_text.replace(old, new)
        # `import sql_stats as` style
        new_text = new_text.replace("sql_stats", "sql_stats")
        new_text = new_text.replace("sql_alerts", "sql_alerts")
        new_text = new_text.replace("sql_delete", "sql_delete")
        if new_text != text:
            path.write_text(new_text, encoding="utf-8")
            changed += 1

    test_renames = [
        (
            ROOT / "tests/test_basis_kb_graph_session.py",
            ROOT / "tests/test_basis_workspace_graph_session.py",
        ),
        (ROOT / "tests/test_kb_alerts_emit.py", ROOT / "tests/test_workspace_alerts_emit.py"),
    ]
    for old, new in test_renames:
        if old.is_file():
            print(f"git mv {old.name} → {new.name}")
            git_mv(old, new)

    print(f"updated {changed} files with import paths")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
