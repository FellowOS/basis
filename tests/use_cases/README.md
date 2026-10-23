# Acceptance tests (`test_uc_*`)

Vertical-slice flows (API-only). Naming: `test_uc_<slug>.py`. Add a row here when introducing a new use-case file.

| File | Slug | Intent | E2E (if any) |
|------|------|--------|----------------|
| `test_uc_release_gate.py` | `release_gate` | §9 release gate: ingest, graph, roles, backup/restore, idempotent rebuild | Partial overlap with processing/graph specs |
| `test_uc_m6_vertical_smoke.py` | `m6_vertical_smoke` | M6 smoke: alerts, rules, sources, remember → review | `governance.e2e.spec.ts`, `processing-job.e2e.spec.ts` (partial) |

**Integration** tests for the same domains live under `tests/integration/` (single-step behavior). **Contract** tests under `tests/contract/`.
