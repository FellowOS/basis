#!/usr/bin/env python3
"""Write provider bundles to ``basis/domain/connectors/providers/``."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from basis.domain.connectors.manifest_schema import ConnectorManifest
from basis.domain.connectors.provider_bundle import write_provider_bundle
from basis.domain.connectors.synthesis.batches import load_batch, list_batch_files
from basis.domain.connectors.synthesis.generators import all_generator_services
from basis.domain.connectors.synthesis.merge import merge_service

PROVIDERS_OUT_DIR = REPO_ROOT / "basis" / "domain" / "connectors" / "providers"


def _services_from_args(args: argparse.Namespace) -> list[tuple[str, str | None]]:
    """Return (service, ship_tier) pairs."""
    if args.batch is not None:
        batch = load_batch(args.batch)
        tier = batch.ship_tier_default
        return [(s, tier) for s in batch.services]
    if args.services:
        tier = args.tier
        return [(s.strip().lower(), tier) for s in args.services.split(",") if s.strip()]
    if args.all_batches:
        pairs: list[tuple[str, str | None]] = []
        for path in list_batch_files():
            batch_id = int(path.stem.split("_", 1)[1])
            batch = load_batch(batch_id)
            pairs.extend((s, batch.ship_tier_default) for s in batch.services)
        return pairs
    # Default: legacy generators only (batch 0 services).
    batch = load_batch(0)
    return [(s, batch.ship_tier_default) for s in batch.services]


def build_manifests(
    service_tiers: list[tuple[str, str | None]],
    *,
    synthesize: bool,
) -> list[ConnectorManifest]:
    manifests: list[ConnectorManifest] = []
    for service, tier in service_tiers:
        if synthesize:
            manifests.append(merge_service(service, ship_tier=tier))
        else:
            from basis.domain.connectors.synthesis.generators import manifest_from_generator

            m = manifest_from_generator(service)
            if m is None:
                raise ValueError(f"No generator for service '{service}'")
            if tier:
                payload = m.model_dump(mode="python")
                payload["x-basis-ship-tier"] = tier
                m = ConnectorManifest.model_validate(payload)
            manifests.append(m)
    return manifests


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--batch",
        type=int,
        help="Build services listed in synthesis/batches/batch_N.yaml",
    )
    parser.add_argument(
        "--services",
        help="Comma-separated service ids (e.g. github,slack)",
    )
    parser.add_argument(
        "--all-batches",
        action="store_true",
        help="Build every batch_*.yaml in order",
    )
    parser.add_argument(
        "--tier",
        help="x-basis-ship-tier when using --services (ga|beta|catalog)",
    )
    parser.add_argument(
        "--synthesize",
        action="store_true",
        default=True,
        help="Merge Nango/AnyConnect overlays (default: on)",
    )
    parser.add_argument(
        "--no-synthesize",
        action="store_false",
        dest="synthesize",
        help="Generators only (legacy behaviour)",
    )
    parser.add_argument(
        "--list-services",
        action="store_true",
        help="Print generator-known services and exit",
    )
    args = parser.parse_args()

    if args.list_services:
        for name in all_generator_services():
            print(name)
        return

    service_tiers = _services_from_args(args)
    manifests = build_manifests(service_tiers, synthesize=args.synthesize)
    PROVIDERS_OUT_DIR.mkdir(parents=True, exist_ok=True)
    for manifest in manifests:
        write_provider_bundle(PROVIDERS_OUT_DIR, manifest)
    names = ", ".join(m.service for m in manifests)
    print(
        f"Wrote {len(manifests)} provider manifest(s) to {PROVIDERS_OUT_DIR}/<service>.yaml "
        f"({names})"
    )


if __name__ == "__main__":
    main()
