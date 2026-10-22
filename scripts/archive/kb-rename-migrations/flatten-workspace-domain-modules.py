#!/usr/bin/env python3
"""Drop workspace_ prefix from domain modules renamed from kb_*."""

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
}

TEXT_SUFFIXES = {".py", ".md", ".sh", ".yml", ".yaml"}

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
        (
            ROOT / "basis/domain/knowledge/access/workspace_alerts.py",
            ROOT / "basis/domain/knowledge/access/alerts.py",
        ),
        (
            ROOT / "basis/domain/knowledge/services/workspace_alerts_emit.py",
            ROOT / "basis/domain/knowledge/services/alerts_emit.py",
        ),
        (
            ROOT / "basis/domain/ontology/hub/workspace_scoped_state.py",
            ROOT / "basis/domain/ontology/hub/scoped_state.py",
        ),
        (
            ROOT / "basis/domain/bridges/workspace_graph_session.py",
            ROOT / "basis/domain/bridges/graph_session.py",
        ),
        (
            ROOT / "basis/domain/knowledge/sql_alerts.py",
            ROOT / "basis/domain/knowledge/sql_alerts.py",
        ),
        (
            ROOT / "basis/domain/knowledge/sql_delete.py",
            ROOT / "basis/domain/knowledge/sql_delete.py",
        ),
        (
            ROOT / "basis/domain/knowledge/sql_stats.py",
            ROOT / "basis/domain/knowledge/sql_stats.py",
        ),
        (
            ROOT / "basis/domain/graph/session/basis_workspace_graph_session.py",
            ROOT / "basis/domain/graph/session/basis_graph_session.py",
        ),
    ]

    for old, new in file_moves:
        print(f"git mv {old.relative_to(ROOT)} → {new.relative_to(ROOT)}")
        git_mv(old, new)

    test_moves = [
        (
            ROOT / "tests/test_basis_workspace_graph_session.py",
            ROOT / "tests/test_basis_graph_session.py",
        ),
        (
            ROOT / "tests/test_workspace_alerts_emit.py",
            ROOT / "tests/test_alerts_emit.py",
        ),
    ]
    for old, new in test_moves:
        if old.is_file():
            print(f"git mv {old.name} → {new.name}")
            git_mv(old, new)

    pairs = sorted(RENAMES.items(), key=lambda x: len(x[0]), reverse=True)
    extra = [
        ("sql_stats", "sql_stats"),
        ("sql_alerts", "sql_alerts"),
        ("sql_delete", "sql_delete"),
    ]
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
        for old, new in extra:
            new_text = new_text.replace(old, new)
        if new_text != text:
            path.write_text(new_text, encoding="utf-8")
            changed += 1

    print(f"updated {changed} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
