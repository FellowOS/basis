#!/usr/bin/env python3
"""Drop kb_* from graph session and in-memory ontology hub symbols (one-off)."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP = {".git", ".venv", "venv", "node_modules", "docs", "__pycache__", "desktop"}

# Longest match first.
REPLACEMENTS: list[tuple[str, str]] = [
    ("register_ontology_hub_governance_routes", "register_ontology_hub_governance_routes"),
    ("register_ontology_hub_catalog_routes", "register_ontology_hub_catalog_routes"),
    ("register_ontology_hub_routes", "register_ontology_hub_routes"),
    ("_rebuild_graph_projection_for_app", "_rebuild_graph_projection_for_app"),
    ("get_graph_session_registry", "get_graph_session_registry"),
    ("_rebuild_graph_adapter", "_rebuild_graph_adapter"),
    ("graph_session_registry", "graph_session_registry"),
    ("graph_runtime_available", "graph_runtime_available"),
    ("require_graph_session", "require_graph_session"),
    ("rebuild_graph_projection_bindings", "rebuild_graph_projection_bindings"),
    ("ensure_ontology_hub_loaded", "ensure_ontology_hub_loaded"),
    ("persist_ontology_hub", "persist_ontology_hub"),
    ("delete_ontology_hub", "delete_ontology_hub"),
    ("_ontology_hub_loaded", "_ontology_hub_loaded"),
    ("ontology_alignments", "ontology_alignments"),
    ("ontology_registries", "ontology_registries"),
    ("ontology_proposals", "ontology_proposals"),
    ("ontology_versions", "ontology_versions"),
    ("ontology_drafts", "ontology_drafts"),
    ("GraphSessionRegistry", "GraphSessionRegistry"),
    ("graph_session_for_workspace", "graph_session_for_workspace"),
    ("graph_runtime_for", "graph_runtime_for"),
    ("rebuild_graph_projection", "rebuild_graph_projection"),
    ("build_graph_adapter", "build_graph_adapter"),
    ("GraphRuntime", "GraphRuntime"),
    ("basis_for_workspace", "basis_for_workspace"),
    ("OntologyHubState", "OntologyHubState"),
    ("async def ontology_registry", "async def ontology_registry"),
    ("def graph_session(", "def graph_session("),
]

SUFFIXES = {".py", ".md", ".yml", ".yaml", ".ini", ".mjs", ".json"}


def _skip(path: Path) -> bool:
    return any(p in SKIP for p in path.parts)


def rewrite_files() -> int:
    changed = 0
    for path in ROOT.rglob("*"):
        if not path.is_file() or _skip(path):
            continue
        if path.suffix not in SUFFIXES and path.name not in {"importlinter.ini"}:
            continue
        if "openapi/basis-v1" in str(path) and path.suffix == ".json":
            continue
        text = path.read_text(encoding="utf-8")
        new = text
        for old, new_sub in REPLACEMENTS:
            new = new.replace(old, new_sub)
        if new != text:
            path.write_text(new, encoding="utf-8")
            changed += 1
    return changed


def git_mv_test_files() -> None:
    moves = [
        ("tests/test_graph_session_registry.py", "tests/test_graph_session_registry.py"),
        ("tests/test_kb_graph_session_routes.py", "tests/test_graph_session_routes.py"),
    ]
    for old, new in moves:
        o, n = ROOT / old, ROOT / new
        if o.is_file():
            subprocess.run(["git", "mv", str(o), str(n)], cwd=ROOT, check=True)


def main() -> int:
    n = rewrite_files()
    print(f"updated {n} files")
    git_mv_test_files()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
