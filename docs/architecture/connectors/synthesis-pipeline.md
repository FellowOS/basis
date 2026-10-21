# BOCP provider synthesis pipeline

**Audience:** Contributors changing `basis/domain/integration/providers/*.yaml`, batches, or wiring sibling Nango/Airbyte/AnyConnect repos.  
**Protocol & host:** [bocp.md](bocp.md), [runtime.md](runtime.md). **Batch plan:** [provider-migration.zh.md](provider-migration.zh.md) (living plan, Chinese).

## Purpose

The running server reads **committed** BOCP bundles under `basis/domain/integration/providers/<service>.yaml`. Bundles may be hand-edited or **generated** from upstream assets:

| Upstream | Role | Default discovery (relative to Basis repo) |
| --- | --- | --- |
| **Nango** | Auth templates | `../../nango/packages/providers/providers.yaml` |
| **Airbyte** | Declarative `manifest.yaml` per connector | `../../airbyte/airbyte-integrations/connectors` |
| **AnyConnect** (fellowos connectors) | Action catalog / invoke metadata | `../connectors/catalog/apps` or `../../fellowos/connectors/catalog/apps` |

Resolution: `basis/domain/integration/synthesis/paths.py`. Override via env vars in [`.env.synthesis.example`](../../../.env.synthesis.example) at repo root.

## Flow

1. **Batch list** — `basis/domain/integration/synthesis/batches/batch_N.yaml` (which `service` ids to build).
2. **Merge** — `merge_service()` in `synthesis/merge.py` (with `--synthesize`, default on) overlays Nango/AnyConnect/Airbyte; `--no-synthesize` uses Python generators only.
3. **Write** — `scripts/build_connector_manifests.py` → `basis/domain/integration/providers/*.yaml`.
4. **Runtime** — `ConnectorCatalog` / `ConnectorRuntime` load YAML at process start (not rebuilt on each request).

Synthesis does **not** run inside `uv run basis`; regenerate YAML, commit, then restart the API.

## Commands (repo root)

```bash
uv run python scripts/build_connector_manifests.py --list-services
uv run python scripts/build_connector_manifests.py --batch 0
uv run python scripts/build_connector_manifests.py --all-batches
uv run python scripts/build_connector_manifests.py --services github,slack --tier beta
uv run python scripts/build_connector_manifests.py --batch 0 --no-synthesize
```

Coverage report (read-only): `uv run python scripts/synthesis_catalog_report.py` (requires AnyConnect catalog path).

## What to commit

- `providers/*.yaml` when regenerating bundles.
- `synthesis/batches/*.yaml` when adding services to a batch.
- Synthesis **code** under `basis/domain/integration/synthesis/`.
- Do **not** commit `.env.synthesis` or machine-specific paths.

See [synthesis-pipeline.zh.md](synthesis-pipeline.zh.md) for the full Chinese runbook (mermaid diagram, verification table).
