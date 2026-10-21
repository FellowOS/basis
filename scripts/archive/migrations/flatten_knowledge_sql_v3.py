#!/usr/bin/env python3
"""Move domain/knowledge/persistence/*.py to domain/knowledge/sql_*.py (phase 3)."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PERSIST = ROOT / "basis" / "domain" / "knowledge" / "persistence"
KNOWLEDGE = ROOT / "basis" / "domain" / "knowledge"

SKIP_DIRS = {".git", "node_modules", "__pycache__"}

_SYMBOL_TO_MODULE: dict[str, str] = {
    "ConnectorSyncPersistence": "sql_connector_sync",
    "purge_entity_connector_sync_data": "sql_connector_sync",
    "ConnectorVaultPersistence": "sql_connector_vault",
}

IMPORT_FROM_RE = re.compile(
    r"^(\s*)from basis\.domain\.knowledge\.persistence import (.+)$",
    re.MULTILINE,
)


def _module_stems() -> frozenset[str]:
    if not PERSIST.is_dir():
        return frozenset()
    return frozenset(
        p.stem for p in PERSIST.glob("*.py") if p.name != "__init__.py"
    )


def _parse_import_item(item: str) -> tuple[str, str | None]:
    item = item.strip()
    if " as " in item:
        name, alias = item.split(" as ", 1)
        return name.strip(), alias.strip()
    return item.strip(), None


def _lines_for_import(imports: str, stems: frozenset[str]) -> list[str]:
    by_mod: dict[str, list[str]] = {}
    knowledge_mods: list[str] = []

    for item in imports.split(","):
        if not item.strip():
            continue
        name, alias = _parse_import_item(item)
        label = f"{name} as {alias}" if alias else name
        if name in _SYMBOL_TO_MODULE:
            mod = _SYMBOL_TO_MODULE[name]
            by_mod.setdefault(mod, []).append(label)
        elif name in stems:
            target = f"sql_{name}"
            knowledge_mods.append(f"{target} as {alias}" if alias else target)
        else:
            knowledge_mods.append(item.strip())

    lines: list[str] = []
    if knowledge_mods:
        lines.append(f"from basis.domain.knowledge import {', '.join(knowledge_mods)}")
    for mod, labels in sorted(by_mod.items()):
        lines.append(f"from basis.domain.knowledge.{mod} import {', '.join(labels)}")
    return lines


def _rewrite_file(text: str, stems: frozenset[str]) -> str:
    def repl_from(match: re.Match[str]) -> str:
        indent, imports = match.group(1), match.group(2)
        lines = _lines_for_import(imports, stems)
        return "\n".join(indent + line for line in lines)

    text = IMPORT_FROM_RE.sub(repl_from, text)
    for stem in sorted(stems, key=len, reverse=True):
        text = text.replace(
            f"basis.domain.knowledge.persistence.{stem}",
            f"basis.domain.knowledge.sql_{stem}",
        )
    return text


def _move_modules() -> int:
    n = 0
    for path in sorted(PERSIST.glob("*.py")):
        if path.name == "__init__.py":
            continue
        dst = KNOWLEDGE / f"sql_{path.stem}.py"
        if dst.exists():
            print(f"conflict {dst}", file=sys.stderr)
            return -1
        path.rename(dst)
        n += 1
    init = PERSIST / "__init__.py"
    if init.is_file():
        init.unlink()
    if PERSIST.is_dir() and not any(PERSIST.iterdir()):
        PERSIST.rmdir()
    return n


def _write_sql_package() -> None:
    text = '''"""Canonical KB SQL façade types (see also `sql_<topic>` modules)."""

from basis.domain.knowledge.sql_connector_sync import (
    ConnectorSyncPersistence,
    purge_entity_connector_sync_data,
)
from basis.domain.knowledge.sql_connector_vault import ConnectorVaultPersistence

__all__ = [
    "ConnectorSyncPersistence",
    "ConnectorVaultPersistence",
    "purge_entity_connector_sync_data",
]
'''
    (KNOWLEDGE / "sql.py").write_text(text, encoding="utf-8")


def main() -> int:
    if not PERSIST.is_dir():
        print(f"missing {PERSIST}", file=sys.stderr)
        return 1
    stems = _module_stems()
    n_move = _move_modules()
    if n_move < 0:
        return 1
    _write_sql_package()
    changed = 0
    for pattern in ("**/*.py", "**/*.md"):
        for path in ROOT.glob(pattern):
            if not path.is_file() or any(s in path.parts for s in SKIP_DIRS):
                continue
            if path.name == "flatten_knowledge_sql_v3.py":
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            new = _rewrite_file(text, stems)
            if new != text:
                path.write_text(new, encoding="utf-8")
                changed += 1
    print(f"moved {n_move} sql modules; rewrote {changed} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
