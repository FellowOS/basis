# Basis automated tests (non-unit)

Unit tests stay colocated in application code (`web/src/**/*.test.ts`, optional `desktop/**.test.mjs`). Everything else lives under `tests/`.

## Layout

| Path | Layer | Runner |
|------|--------|--------|
| `integration/` | API / service **integration** | `uv run pytest tests/integration` |
| `use_cases/` | **Acceptance** / vertical-slice flows | `uv run pytest tests/use_cases` — [use_cases/README.md](./use_cases/README.md) |
| `contract/` | **Contract** + audit wrappers | `uv run pytest tests/contract` |
| `e2e/` | Browser **E2E** (`specs/`, Playwright package) | `cd tests/e2e && npm ci && CI=1 npm test` — [e2e/README.md](./e2e/README.md) |
| `support/` | Shared pytest helpers (not collected) | imported by tests |
| `conftest.py` | Global pytest fixtures | — |

Runtime E2E hooks used by the API (`is_playwright_e2e_data_dir`, OAuth stub) remain in `basis/infra/tooling/test_support/` because production HTTP imports them.

Structural audits (`scripts/audit-*.py`) stay in `scripts/`; CI runs them alongside pytest. Contract tests in `contract/` invoke the web/OpenAPI audits where applicable.

## Commands

```bash
# All pytest layers
uv run pytest -q

# Optional external DB / GitHub (see `.env.test.example`)
uv run pytest -q -m integration

# Web unit tests
cd web && npm test

# Playwright E2E
cd web && CI=1 npm run test:e2e
```

## File naming (enforced)

CI runs `uv run python scripts/audit-test-naming.py`. New files must match:

| Layer | Pattern | Example |
|-------|---------|---------|
| Integration | `test_<domain>_<behavior>.py` (≥2 segments after `test_`) | `test_workspace_token_grants.py` |
| Use case | `test_uc_<slug>.py` | `test_uc_release_gate.py` |
| Contract | `test_contract_<topic>.py` | `test_contract_openapi_v1_served.py` |
| Unit (web) | `<kebab>.test.ts` sibling of `<kebab>.ts` or `.tsx` | `graph-url-state.test.ts` |
| E2E | `<kebab>.e2e.spec.ts` under `tests/e2e/specs/` | `home.e2e.spec.ts` |

## Adding tests

- New HTTP behavior: `integration/test_<domain>_<behavior>.py` — one assertion focus per test; use file-local `_client` / `_session_client` or `support/demo_workspace.py`.
- New product journey anchor: `use_cases/test_uc_<slug>.py` (keep tests short).
- OpenAPI / MCP / web path parity: `contract/test_contract_<topic>.py`.
- New primary route smoke: `tests/e2e/specs/<feature>.e2e.spec.ts` + update `tests/e2e/README.md`.
