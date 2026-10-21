#!/usr/bin/env python3
"""Phase 2: group v1 HTTP routes under kb/ and platform/ (run once from repo root)."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
V1 = ROOT / "basis" / "api" / "http" / "routes" / "v1"

# (filename under v1/, destination relative to v1/)
KB_MOVES: tuple[tuple[str, str], ...] = (
    ("kbs.py", "kb/workspace/kbs.py"),
    ("kb_tokens.py", "kb/workspace/tokens.py"),
    ("kb_mappings.py", "kb/config/mappings.py"),
    ("kb_alerts.py", "kb/config/alerts.py"),
    ("kb_governance.py", "kb/config/governance.py"),
    ("kb_e2e_helpers.py", "kb/e2e_helpers.py"),
    ("kb_reasoning_rules.py", "kb/config/reasoning_rules.py"),
    ("kb_graph.py", "kb/graph/__init__.py"),
    ("kb_graph_read.py", "kb/graph/read.py"),
    ("kb_graph_search.py", "kb/graph/search.py"),
    ("kb_graph_models.py", "kb/graph/models.py"),
    ("kb_documents.py", "kb/documents/__init__.py"),
    ("kb_documents_crud.py", "kb/documents/crud.py"),
    ("kb_documents_jobs.py", "kb/documents/jobs.py"),
    ("kb_documents_ontology.py", "kb/documents/ontology.py"),
    ("kb_documents_models.py", "kb/documents/models.py"),
    ("kb_documents_processing_support.py", "kb/documents/processing_support.py"),
    ("kb_sources.py", "kb/sources/__init__.py"),
    ("kb_sources_crud.py", "kb/sources/crud.py"),
    ("kb_sources_ingest.py", "kb/sources/ingest.py"),
    ("kb_sources_models.py", "kb/sources/models.py"),
    ("kb_sources_support.py", "kb/sources/support.py"),
    ("kb_connectors.py", "kb/connectors/__init__.py"),
    ("kb_connectors_catalog.py", "kb/connectors/catalog.py"),
    ("kb_connectors_connections.py", "kb/connectors/connections.py"),
    ("kb_connectors_mappings.py", "kb/connectors/mappings.py"),
    ("kb_connectors_outbox.py", "kb/connectors/outbox.py"),
    ("kb_connectors_oauth.py", "kb/connectors/oauth.py"),
    ("kb_connectors_tools.py", "kb/connectors/tools.py"),
    ("kb_connectors_models.py", "kb/connectors/models.py"),
    ("kb_connectors_support.py", "kb/connectors/support.py"),
    ("kb_ledger.py", "kb/ledger/__init__.py"),
    ("kb_ledger_read.py", "kb/ledger/read.py"),
    ("kb_ledger_remember.py", "kb/ledger/remember.py"),
    ("kb_ledger_mutations.py", "kb/ledger/mutations.py"),
    ("kb_ledger_models.py", "kb/ledger/models.py"),
    ("kb_review.py", "kb/review/__init__.py"),
    ("kb_review_queue.py", "kb/review/queue.py"),
    ("kb_review_audit.py", "kb/review/audit.py"),
    ("kb_review_models.py", "kb/review/models.py"),
    ("kb_review_resolve.py", "kb/review/resolve.py"),
    ("kb_review_resolve_approve.py", "kb/review/resolve_approve.py"),
    ("kb_review_resolve_reject.py", "kb/review/resolve_reject.py"),
    ("kb_explorer_query.py", "kb/explorer/__init__.py"),
    ("kb_explorer_sparql.py", "kb/explorer/sparql.py"),
    ("kb_explorer_semantic.py", "kb/explorer/semantic.py"),
    ("kb_explorer_decisions.py", "kb/explorer/decisions.py"),
    ("kb_explorer_reasoning.py", "kb/explorer/reasoning.py"),
    ("kb_explorer_graph_io.py", "kb/explorer/graph_io.py"),
    ("kb_explorer_temporal.py", "kb/explorer/temporal.py"),
    ("kb_explorer_staging.py", "kb/explorer/staging.py"),
    ("kb_explorer_governance.py", "kb/explorer/governance.py"),
    ("kb_explorer_shared.py", "kb/explorer/shared.py"),
    ("kb_ontology.py", "kb/ontology/__init__.py"),
    ("kb_ontology_vocabulary.py", "kb/ontology/vocabulary.py"),
    ("kb_ontology_alignments.py", "kb/ontology/alignments.py"),
    ("kb_ontology_session.py", "kb/ontology/session.py"),
)

PLATFORM_MOVES: tuple[tuple[str, str], ...] = (
    ("auth.py", "platform/auth.py"),
    ("oauth.py", "platform/oauth.py"),
    ("organizations.py", "platform/organizations.py"),
    ("settings.py", "platform/settings.py"),
    ("platform.py", "platform/platform.py"),
    ("models.py", "platform/models.py"),
    ("model_providers.py", "platform/model_providers.py"),
    ("audit.py", "platform/audit.py"),
    ("reasoning.py", "platform/reasoning.py"),
    ("realtime.py", "platform/realtime.py"),
    ("mcp.py", "platform/mcp.py"),
)

HUB_MOVES: tuple[tuple[str, str], ...] = (
    ("../kb_ontology_hub.py", "kb/ontology/hub/__init__.py"),
    ("../kb_ontology_hub_catalog.py", "kb/ontology/hub/catalog.py"),
    ("../kb_ontology_hub_governance.py", "kb/ontology/hub/governance.py"),
    ("../kb_ontology_hub_support.py", "kb/ontology/hub/support.py"),
)


def _module_path(rel: str) -> str:
    """v1/kb/graph/read.py -> basis.api.http.routes.v1.kb.graph.read"""
    stem = rel.replace("/", ".").removesuffix(".py")
    if stem.endswith(".__init__"):
        stem = stem[: -len(".__init__")]
    return f"basis.api.http.routes.v1.{stem}"


def _build_import_replacements() -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    for src, dst in KB_MOVES + PLATFORM_MOVES:
        old_mod = f"basis.api.http.routes.v1.{src.removesuffix('.py')}"
        new_mod = _module_path(dst)
        pairs.append((old_mod, new_mod))
    http = ROOT / "basis" / "api" / "http"
    for src, dst in HUB_MOVES:
        old_name = Path(src).name.removesuffix(".py")
        old_mod = f"basis.api.http.{old_name}"
        new_mod = _module_path(f"kb/ontology/hub/{Path(dst).name}")
        pairs.append((old_mod, new_mod))
    pairs.sort(key=lambda x: len(x[0]), reverse=True)
    return pairs


def _move_files() -> None:
    for src, dst in KB_MOVES + PLATFORM_MOVES:
        src_path = V1 / src
        dst_path = V1 / dst
        if not src_path.is_file():
            print(f"skip missing {src_path}", file=sys.stderr)
            continue
        dst_path.parent.mkdir(parents=True, exist_ok=True)
        src_path.rename(dst_path)
    http = ROOT / "basis" / "api" / "http"
    for src, dst in HUB_MOVES:
        src_path = (V1 / src).resolve() if not src.startswith("..") else (http / Path(src).name)
        dst_path = V1 / dst
        if not src_path.is_file():
            print(f"skip missing {src_path}", file=sys.stderr)
            continue
        dst_path.parent.mkdir(parents=True, exist_ok=True)
        src_path.rename(dst_path)


def _touch_packages() -> None:
    for pkg in (
        V1 / "kb",
        V1 / "platform",
        V1 / "kb/graph",
        V1 / "kb/documents",
        V1 / "kb/sources",
        V1 / "kb/connectors",
        V1 / "kb/ledger",
        V1 / "kb/review",
        V1 / "kb/explorer",
        V1 / "kb/ontology",
        V1 / "kb/ontology/hub",
    ):
        init = pkg / "__init__.py"
        if not init.exists():
            init.write_text('"""KB HTTP routes."""\n', encoding="utf-8")


def _rewrite_imports(replacements: list[tuple[str, str]]) -> int:
    changed = 0
    for pattern in ("**/*.py", "**/*.md"):
        for path in ROOT.glob(pattern):
            if ".git" in path.parts or "node_modules" in path.parts:
                continue
            if path.name in {"reorganize_api_routes_v2.py", "migrate_package_layout_v2.py"}:
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            original = text
            for old, new in replacements:
                text = text.replace(old, new)
            if text != original:
                path.write_text(text, encoding="utf-8")
                changed += 1
    return changed


def main() -> int:
    if not V1.is_dir():
        print(f"missing {V1}", file=sys.stderr)
        return 1
    replacements = _build_import_replacements()
    _move_files()
    _touch_packages()
    n = _rewrite_imports(replacements)
    print(f"moved routes; updated {n} files with {len(replacements)} import mappings")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
