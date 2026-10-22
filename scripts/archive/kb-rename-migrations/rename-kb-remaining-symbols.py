#!/usr/bin/env python3
"""Further kb_* symbol cleanup (handlers, types, settings, tests)."""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP = {".git", ".venv", "venv", "node_modules", "docs", "__pycache__", "desktop"}
HTTP = ROOT / "basis" / "interface" / "http"
SUFFIXES = {".py", ".md", ".yml", ".yaml", ".ini", ".mjs"}

REPLACEMENTS: list[tuple[str, str]] = [
    ("admin_error_from_graph_http", "admin_error_from_graph_http"),
    ("record_governance_decision_for_workspace", "record_governance_decision_for_workspace"),
    ("emit_governance_tripped_for_workspace", "emit_governance_tripped_for_workspace"),
    ("fetch_entity_merge_for_workspace", "fetch_entity_merge_for_workspace"),
    ("BasisGraphSession", "BasisGraphSession"),
    ("audit_graph", "audit_graph"),
    ("WorkspaceAuditActor", "WorkspaceAuditActor"),
    ("WorkspaceAuditStore", "WorkspaceAuditStore"),
    ("list_audit_for_workspace", "list_audit_for_workspace"),
    ("assert_workspace_exists", "assert_workspace_exists"),
    ("_slug_for_workspace", "_slug_for_workspace"),
    ("_delete_workspace_scoped_ids", "_delete_workspace_scoped_ids"),
    ("graph_session_idle_seconds", "graph_session_idle_seconds"),
    ("graph_session_evict_interval_seconds", "graph_session_evict_interval_seconds"),
    ("BASIS_GRAPH_SESSION_IDLE_SECONDS", "BASIS_GRAPH_SESSION_IDLE_SECONDS"),
    ("BASIS_GRAPH_SESSION_EVICT_INTERVAL_SECONDS", "BASIS_GRAPH_SESSION_EVICT_INTERVAL_SECONDS"),
    ("graph_decisions_max_limit", "graph_decisions_max_limit"),
    ("BASIS_GRAPH_DECISIONS_MAX_LIMIT", "BASIS_GRAPH_DECISIONS_MAX_LIMIT"),
]


def _skip(path: Path) -> bool:
    return any(p in SKIP for p in path.parts)


def rewrite_text(text: str) -> str:
    for old, new in sorted(REPLACEMENTS, key=lambda x: len(x[0]), reverse=True):
        text = text.replace(old, new)
    return text


def strip_kb_handler_prefixes() -> int:
    changed = 0
    for path in HTTP.glob("*.py"):
        text = path.read_text(encoding="utf-8")
        new = re.sub(r"\basync def kb_(\w+)", r"async def \1", text)
        if new != text:
            path.write_text(new, encoding="utf-8")
            changed += 1
    return changed


def rewrite_repo() -> int:
    changed = 0
    for path in ROOT.rglob("*"):
        if not path.is_file() or _skip(path):
            continue
        if path.suffix not in SUFFIXES:
            continue
        text = path.read_text(encoding="utf-8")
        new = rewrite_text(text)
        if new != text:
            path.write_text(new, encoding="utf-8")
            changed += 1
    return changed


def patch_settings_env_fallback() -> None:
    path = ROOT / "basis/infra/runtime/config.py"
    text = path.read_text(encoding="utf-8")
    old_idle = 'os.environ.get("BASIS_GRAPH_SESSION_IDLE_SECONDS", "1800")'
    new_idle = (
        'os.environ.get("BASIS_GRAPH_SESSION_IDLE_SECONDS") '
        'or os.environ.get("BASIS_GRAPH_SESSION_IDLE_SECONDS", "1800")'
    )
    old_evict = 'os.environ.get("BASIS_GRAPH_SESSION_EVICT_INTERVAL_SECONDS", "300")'
    new_evict = (
        'os.environ.get("BASIS_GRAPH_SESSION_EVICT_INTERVAL_SECONDS") '
        'or os.environ.get("BASIS_GRAPH_SESSION_EVICT_INTERVAL_SECONDS", "300")'
    )
    if old_idle in text:
        text = text.replace(old_idle, new_idle)
    if old_evict in text:
        text = text.replace(old_evict, new_evict)
    path.write_text(text, encoding="utf-8")


def git_mv_tests() -> None:
    renames = [
        ("tests/test_kb_graph_route_errors.py", "tests/test_graph_route_errors.py"),
        ("tests/test_kb_e2e_helpers.py", "tests/test_workspace_e2e_helpers.py"),
        ("tests/test_kb_capabilities.py", "tests/test_workspace_capabilities.py"),
        ("tests/test_kb_ontology.py", "tests/test_workspace_ontology.py"),
        ("tests/test_kb_review.py", "tests/test_workspace_review.py"),
        ("tests/test_kb_alerts.py", "tests/test_workspace_alerts.py"),
        ("tests/test_kb_mappings.py", "tests/test_workspace_mappings.py"),
        ("tests/test_kb_sources.py", "tests/test_workspace_sources.py"),
        ("tests/test_kb_reasoning_rules.py", "tests/test_workspace_reasoning_rules.py"),
        ("tests/test_kb_delete.py", "tests/test_workspace_delete.py"),
    ]
    for old, new in renames:
        o, n = ROOT / old, ROOT / new
        if o.is_file() and not n.is_file():
            subprocess.run(["git", "mv", str(o), str(n)], cwd=ROOT, check=True)
            print(f"git mv {Path(old).name} → {Path(new).name}")


def main() -> int:
    n_handlers = strip_kb_handler_prefixes()
    n_files = rewrite_repo()
    patch_settings_env_fallback()
    git_mv_tests()
    print(f"handlers {n_handlers}, files {n_files}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
