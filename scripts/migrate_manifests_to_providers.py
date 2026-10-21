#!/usr/bin/env python3
"""One-time migration: manifests/*.json → providers/<service>.yaml."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

REPO_ROOT = Path(__file__).resolve().parents[1]
LEGACY_MANIFESTS_DIR = (
    REPO_ROOT / "basis" / "domain" / "connectors" / "manifests"
)
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from basis.domain.integration.catalog import default_providers_dir  # noqa: E402
from basis.domain.integration.adapters.sql.providers import sql_provider_manifests  # noqa: E402
from basis.domain.integration.manifest_schema import ConnectorManifest  # noqa: E402
from basis.domain.integration.provider_bundle import write_provider_bundle  # noqa: E402


def collect_legacy_manifests() -> list[ConnectorManifest]:
    root = LEGACY_MANIFESTS_DIR
    by_service: dict[str, ConnectorManifest] = {}
    bundle = root / "catalog_bundle.json"
    if bundle.is_file():
        raw_list = json.loads(bundle.read_text(encoding="utf-8"))
        if isinstance(raw_list, list):
            for item in raw_list:
                manifest = ConnectorManifest.model_validate(item)
                by_service[manifest.service] = manifest
    for path in sorted(root.glob("*.json")):
        if path.name == "catalog_bundle.json":
            continue
        manifest = ConnectorManifest.model_validate(
            json.loads(path.read_text(encoding="utf-8"))
        )
        by_service[manifest.service] = manifest
    return [by_service[k] for k in sorted(by_service.keys())]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--include-builtins",
        action="store_true",
        help="Also write postgres/mysql provider bundles (overrides code-only builtins at runtime).",
    )
    parser.add_argument(
        "--remove-legacy-json",
        action="store_true",
        help="Delete manifests/*.json after successful write (keeps catalog_bundle.json unless --remove-bundle).",
    )
    parser.add_argument(
        "--remove-bundle",
        action="store_true",
        help="Delete catalog_bundle.json when removing legacy files.",
    )
    args = parser.parse_args()

    providers_root = default_providers_dir()
    providers_root.mkdir(parents=True, exist_ok=True)

    manifests = collect_legacy_manifests()
    if args.include_builtins:
        for builtin in sql_provider_manifests():
            manifests.append(builtin)

    if not manifests:
        raise SystemExit(f"No legacy manifests found under {LEGACY_MANIFESTS_DIR}")

    for manifest in manifests:
        write_provider_bundle(providers_root, manifest)

    print(f"Migrated {len(manifests)} providers to {providers_root}")

    if args.remove_legacy_json:
        legacy = LEGACY_MANIFESTS_DIR
        for path in legacy.glob("*.json"):
            if path.name == "catalog_bundle.json" and not args.remove_bundle:
                continue
            path.unlink()
            print(f"Removed {path.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
