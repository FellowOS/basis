# Playwright E2E coverage

End-to-end tests exercise **real browser + API** (`BASIS_DATA_DIR=data/e2e`, `/_e2e/*` seed helpers). They are **not** a full UI regression suite — most behavior is covered by **Vitest** (components/utilities) and **pytest** (HTTP/MCP/ledger).

**Run:** from `web/`: `CI=1 npm run test:e2e` (see [web/README.md](../README.md)).

**Product gaps vs API:** [docs/progress.md](../../docs/progress.md) §3.1 / §3.2.

## Coverage legend

| Code | Meaning |
|------|---------|
| **—** | No dedicated E2E spec visits this surface |
| **S** | Smoke: route loads, key chrome / `data-testid` / tab visible |
| **P** | Partial: one primary flow, deep link, or redirect |
| **D** | Deeper: multi-step UI and/or API seed + UI assertion |

Many workspace graph Explorer routes **skip** when `explorer_runtime` is missing (`skipUnlessWorkspaceGraphWrite`, capabilities unavailable UI).

## Route ↔ E2E matrix

Routes follow [`web/src/routes/index.tsx`](../src/routes/index.tsx) (`AppRoutes`) and workspace sidebar [`nav-config.ts`](../src/lib/nav/nav-config.ts).

### Marketing & auth

| Route / surface | E2E | Spec(s) | Notes |
|-----------------|-----|---------|-------|
| `/` (marketing) | P | `home.spec.ts` | Anchors, register mode |
| `/login` | S | `shell.spec.ts`, `home.spec.ts` | Fields / register URL |
| Org SSO on login | P | `org-sso-login.spec.ts` | SSO entry, hint API, `sso_required` policy |
| `/settings` (org OIDC/SAML) | S | `org-saml-settings.spec.ts` | Panels visible |

### Product docs

| Route | E2E | Spec(s) |
|-------|-----|---------|
| `/docs/*` | P | `docs.spec.ts` | Sidebar nav, 404 → index |

### Platform admin (`/admin/*`)

| Route | E2E | Spec(s) | Notes |
|-------|-----|---------|-------|
| `/admin/connectors` | S | `admin-connectors.spec.ts` | Catalog search + nav |
| `/admin/workspaces` | S | `platform-admin.spec.ts` | Workspace table + create |
| `/admin/users` | S | `platform-admin.spec.ts` | Lists first platform admin (`data/e2e/playwright-admin.json`) |
| `/admin/models` | S | `platform-admin.spec.ts` | LLM tab + add model |
| `/admin/audit` | S | `platform-admin.spec.ts` | Workspace filter + refresh |
| `/admin/settings` | S | `platform-admin.spec.ts`, `desktop-product.spec.ts` | Login + org SSO (server); desktop redirects away |

### Workspace — Explore

| Route | E2E | Spec(s) | Notes |
|-------|-----|---------|-------|
| `/workspaces/:id/graph` | P | `graph-at.spec.ts`, `graph-diff-cross-link.spec.ts`, `onboarding.spec.ts` | `?at=` URL; workspace after ingest |
| `/workspaces/:id/search` | P | `search-temporal-url.spec.ts`, `search-graph-at.spec.ts`, `governance.spec.ts` | `as_of`, graph tab, scope |

### Workspace — Content

| Route | E2E | Spec(s) | Notes |
|-------|-----|---------|-------|
| `/workspaces/:id/sources` | D | `onboarding.spec.ts`, `processing-job.spec.ts`, `governance.spec.ts` | Paste ingest, library chrome |
| `/workspaces/:id/processing` | P | `processing-job.spec.ts`, `governance.spec.ts` | `?job=`, failed filter |
| `/workspaces/:id/entities` | P | `reasoning-derived.spec.ts` | Derived facts + search (API seed) |

### Workspace — Connectors

| Route | E2E | Spec(s) | Notes |
|-------|-----|---------|-------|
| `/workspaces/:id/onboarding/data` | D | `connector-mapping-suggest.spec.ts` | SQL hint → suggest → sync |
| `…/connectors/catalog` | S | `connectors.spec.ts` | Cards, connection → new mapping |
| `…/connectors/policy` | S | `connectors.spec.ts` | Save allowlist |
| `…/connectors/mappings` | P | `connectors.spec.ts`, `connector-mapping-suggest.spec.ts` | List; REST suggest (mock); cross-stream dialog |
| `…/connectors/mappings/new` | S | `connectors.spec.ts` | Prefill from connection |
| `…/connectors/mappings/:id/edit` | P | `connector-workspace.spec.ts` | Save target class + return to list |
| `…/connectors/runs` | S | `connector-workspace.spec.ts` | After `check`, run row visible |
| `…/connectors/oauth/callback` | P | `connector-workspace.spec.ts` | Mock exchange success; missing code/state error |
| Review writeback diff (connector) | P | `connectors.spec.ts` | From review queue UI |
| Mapping **Sync now** (list) | P | `connector-workspace.spec.ts` | Inbound sync toast |

### Workspace — Schema

| Route | E2E | Spec(s) | Notes |
|-------|-----|---------|-------|
| `/workspaces/:id/ontology` | P | `governance.spec.ts`, `ontology-proposal-url.spec.ts` | Versions tab; proposal deep link |
| `/workspaces/:id/analyze` | P | `analyze-hub.spec.ts` | Tabs; legacy `/sparql`, `/reasoning` redirects |
| `/workspaces/:id/vocabulary` | S | `schema-surfaces.spec.ts` | Hub loads |
| `/workspaces/:id/mappings` (statement / extraction) | S | `schema-surfaces.spec.ts` | Title/subtitle vs connector mappings |
| `/workspaces/:id/ontology-versions` | P | `analyze-hub.spec.ts` | Via redirect/hub |
| `/workspaces/:id/shacl` | S | `schema-surfaces.spec.ts` | Legacy route → ontology `?tab=shacl` |
| `/workspaces/:id/alignments` | S | `schema-surfaces.spec.ts` | Legacy route → ontology `?tab=alignments` |

### Workspace — Govern

| Route | E2E | Spec(s) | Notes |
|-------|-----|---------|-------|
| `/workspaces/:id/review` | D | `governance.spec.ts`, `connectors.spec.ts` | Conflicts, approve narrative, writeback |
| `/workspaces/:id/entity-resolution` | S | `schema-surfaces.spec.ts` | Dedup scan action |
| `/workspaces/:id/decisions` | P | `decisions-deep-link.spec.ts`, `governance.spec.ts` | List + `?decision=` |
| `/workspaces/:id/lineage` | P | `lineage.spec.ts` | `?node=` deep link |
| `/workspaces/:id/graph-diff` | P | `graph-diff.spec.ts` | `from` / `to` query |

### Workspace — System & account

| Route | E2E | Spec(s) | Notes |
|-------|-----|---------|-------|
| `/workspaces/:id/alerts` | D | `governance.spec.ts` | Dismiss, deep links to sources/processing/review/decisions |
| `/workspaces/:id/integration` | S | `mcp-integration.spec.ts` | Tab visible |
| `/workspaces/:id/settings` | P | `settings-graph-audit.spec.ts`, `settings-tabs.spec.ts` | Graph audit; general/members/search tabs |
| `/workspaces/:id/mcp`, `/chat` (legacy) | S | `mcp-integration.spec.ts` | Redirects to integration |

### Desktop product

| Surface | E2E | Spec(s) |
|---------|-----|---------|
| Desktop nav / admin gate | P | `desktop-product.spec.ts` (`BASIS_E2E_DESKTOP=1`) |

### Non-UI integration

| Area | E2E | Spec(s) |
|------|-----|---------|
| MCP over HTTP (smoke) | P | `mcp-integration.spec.ts` |

## Spec file index

| File | Primary intent |
|------|----------------|
| `admin-connectors.spec.ts` | Platform connector catalog admin |
| `analyze-hub.spec.ts` | Query & reasoning hub + legacy routes |
| `connector-mapping-suggest.spec.ts` | Onboarding wizard; SQL/REST suggest API; auto-expand; mappings dialog |
| `connector-workspace.spec.ts` | Runs, mapping edit, sync now, OAuth callback (mock exchange + error) |
| `settings-tabs.spec.ts` | Workspace settings general/members/search tabs |
| `platform-admin.spec.ts` | `/admin/workspaces`, `/admin/users`, `/admin/models`, `/admin/audit`, `/admin/settings` |
| `connectors.spec.ts` | Workspace connectors zones (catalog/policy/mappings) |
| `decisions-deep-link.spec.ts` | Decisions list URL state |
| `desktop-product.spec.ts` | Desktop profile routing |
| `docs.spec.ts` | In-app product docs |
| `governance.spec.ts` | Alerts, review, governance trips, cross-links |
| `graph-at.spec.ts` | Graph temporal `?at=` |
| `graph-diff.spec.ts` | Graph diff page |
| `graph-diff-cross-link.spec.ts` | Graph → diff navigation |
| `home.spec.ts` | Marketing + register entry |
| `lineage.spec.ts` | Lineage node deep link |
| `mcp-integration.spec.ts` | Integration / MCP / legacy chat paths |
| `onboarding.spec.ts` | Register → sources paste → graph |
| `ontology-proposal-url.spec.ts` | Ontology proposal list highlight |
| `org-saml-settings.spec.ts` | Org SAML settings panel |
| `org-sso-login.spec.ts` | Login SSO affordance |
| `processing-job.spec.ts` | Processing job detail / failed flows |
| `reasoning-derived.spec.ts` | Reasoning → entities derived facts UI |
| `schema-surfaces.spec.ts` | Statement mappings, entity resolution, vocabulary, SHACL/alignments redirects |
| `search-graph-at.spec.ts` | Search graph tab URL |
| `search-temporal-url.spec.ts` | Search chunk `as_of` URL |
| `settings-graph-audit.spec.ts` | Workspace settings graph audit tab |
| `shell.spec.ts` | Login form |

## Optional env (live connector)

| Variable | Spec | Purpose |
|----------|------|---------|
| `BASIS_E2E_GITHUB_TOKEN` | `connector-mapping-suggest.spec.ts` | Live GitHub PAT: auto-suggest, batch-create, mappings dialog (skipped when unset) |

## What to add next (suggested)

- Connector OAuth **exchange** against a real provider (or recorded HTTP fixture on the API process)
- Org SSO **full browser login** loop (see `scripts/enterprise_sso_smoke.py` for manual/CI smoke)
- Live GitHub suggest with `run_sync: true` in a gated job (network + rate limits)

When adding specs, extend this table and link the F-* row in `docs/progress.md` if it closes a §3.1 gap.
