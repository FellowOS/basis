#!/usr/bin/env python3
"""Report AnyConnect + Nango coverage for provider synthesis (no per-service Python)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from basis.core.connectors.synthesis.anyconnect_catalog import load_anyconnect_procedures
from basis.core.connectors.synthesis.executor_index import invoke_wire_for_action
from basis.core.connectors.synthesis.nango_auth import load_nango_provider_raw
from basis.core.connectors.synthesis.paths import anyconnect_catalog_dir, nango_providers_yaml


def main() -> None:
    ac_dir = anyconnect_catalog_dir()
    nango = nango_providers_yaml()
    print(f"anyconnect_catalog={ac_dir or 'missing'}")
    print(f"nango_providers={nango or 'missing'}")
    if ac_dir is None:
        sys.exit(1)
    services = sorted(p.stem.replace("-", "_") for p in ac_dir.glob("*.json"))
    nango_hits = 0
    invoke_ready = 0
    total_actions = 0
    for service in services:
        has_nango = load_nango_provider_raw(service) is not None
        if has_nango:
            nango_hits += 1
        loaded = load_anyconnect_procedures(service)
        if not loaded:
            continue
        _, procedures = loaded
        total_actions += len(procedures)
        for proc in procedures:
            if invoke_wire_for_action(service, proc.id):
                invoke_ready += 1
    print(f"catalog_services={len(services)}")
    print(f"nango_auth_hits={nango_hits}")
    print(f"catalog_procedure_actions={total_actions}")
    print(f"invoke_wire_known={invoke_ready}")


if __name__ == "__main__":
    main()
