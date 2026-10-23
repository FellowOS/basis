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

## Test case planning

Pick the **layer** first (not “one OpenAPI operation = one integration file”):

| Layer | Plan tests when… | Granularity |
|-------|------------------|-------------|
| `contract/` | OpenAPI/MCP drift, snapshots, schemathesis, web `operationId` audits | Spec-wide or audit scripts |
| `integration/` | A **bounded context** (BC) behavior, edge case, or short HTTP chain must hold in-process | One file ≈ one domain theme; one `test_*` ≈ one assertion focus |
| `use_cases/` | A **product journey** crosses several APIs (release gate, vertical smoke) | One `test_uc_<slug>.py`; document in [use_cases/README.md](./use_cases/README.md) |
| `e2e/` | Browser + real dev stack; route smoke / UX | `*.e2e.spec.ts`; matrix in [e2e/README.md](./e2e/README.md) |

**Integration** files are grouped by **backend domain** (`workspace_*`, `graph_*`, `connector_*`, `ontology_*`, …), aligned loosely with `basis/application/` and `basis/domain/` — not by OpenAPI path or tag. Breadth of “every route exists” lives in **contract**; depth of “this rule is correct” lives in **integration**.

Inside `integration/`, a file may use `TestClient`, domain helpers, stores, or MCP — whatever matches the behavior under test. Use `@pytest.mark.integration` when a real external DB or service is required (`uv run pytest -q -m integration`).

## Commands

```bash
# All pytest layers
uv run pytest -q

# Optional external DB / GitHub (see `.env.test.example`)
uv run pytest -q -m integration

# Web unit tests
cd web && npm test

# Playwright E2E
cd tests/e2e && CI=1 npm test
```

### Optional `@pytest.mark.integration`

Requires env from `.env.test.example` (copy to `.env.test`). Typical local gate:

| Env | Exercises |
|-----|-----------|
| `BASIS_TEST_POSTGRES_URL` | Same DB as `BASIS_DATABASE_URL` in `.env` if unset; see `tests/support/integration_env.py` |
| (postgres integration files) | `test_postgres_integration.py`, `test_postgres_backup_restore.py`, `test_db_schema_migrations.py` |
| `BASIS_TEST_GITHUB_*` | Connector REST invoke against real GitHub |

SQLite `uv run pytest -q` is the default CI path; run `-m integration` before releases when Postgres is available.

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

Checklist for a **new HTTP surface or behavior**:

1. **Contract** — Does OpenAPI/MCP or a CI audit need updating? → `contract/` or `scripts/audit-*.py` / `openapi/*.json`.
2. **Integration** — What BC/domain and behavior name? → new or existing `integration/test_<domain>_<behavior>.py`; prefer extending an existing domain file unless the theme is new.
3. **Use case** — Does it close a named product journey? → `use_cases/test_uc_<slug>.py` + README row.
4. **E2E** — Does the console need a primary-route smoke? → `tests/e2e/specs/<feature>.e2e.spec.ts` + e2e README matrix.

Conventions:

- Integration: one assertion focus per `test_*` function; fixtures from `conftest.py` / `support/demo_workspace.py` or file-local `_client`.
- Playwright-only HTTP (`/_e2e/*`, `data/e2e` gating): `test_*_playwright_*_http.py` in `integration/` — not `test_e2e_*.py`; browser tests only under `tests/e2e/`.
- Web UI logic: colocated `*.test.ts` next to source (see naming table above).
