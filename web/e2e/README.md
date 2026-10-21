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

Many KB Explorer routes **skip** when `explorer_runtime` is missing (`skipUnlessKbGraphWrite`, “Workspace unavailable”).

## Route ↔ E2E matrix

Routes follow `web/src/app.tsx` and KB sidebar [`nav-config.ts`](../src/lib/nav-config.ts).

### Marketing & auth

| Route / surface | E2E | Spec(s) | Notes |
|-----------------|-----|---------|-------|
| `/` (marketing) | P | `home.spec.ts` | Anchors, register mode |
| `/login` | S | `shell.spec.ts`, `home.spec.ts` | Fields / register URL |
| Org SSO on login | P | `org-sso-login.spec.ts` | SSO entry visible |
| `/settings` (org OIDC/SAML) | S | `org-saml-settings.spec.ts` | Panels visible |

### Product docs

| Route | E2E | Spec(s) |
|-------|-----|---------|
| `/docs/*` | P | `docs.spec.ts` | Sidebar nav, 404 → index |

### Platform admin (`/admin/*`)

| Route | E2E | Spec(s) | Notes |
|-------|-----|---------|-------|
| `/admin/connectors` | S | `admin-connectors.spec.ts` | Catalog search + nav |
| `/admin/kbs` | — | | |
| `/admin/users` | S | `platform-admin.spec.ts` | Lists first platform admin (`data/e2e/playwright-admin.json`) |
| `/admin/models` | — | | |
| `/admin/audit` | — | | |
| `/admin/settings` | S | `desktop-product.spec.ts` | Desktop: route blocked |

### KB — Explore

| Route | E2E | Spec(s) | Notes |
|-------|-----|---------|-------|
| `/kbs/:id/graph` | P | `graph-at.spec.ts`, `graph-diff-cross-link.spec.ts`, `onboarding.spec.ts` | `?at=` URL; workspace after ingest |
| `/kbs/:id/search` | P | `search-temporal-url.spec.ts`, `search-graph-at.spec.ts`, `governance.spec.ts` | `as_of`, graph tab, scope |

### KB — Knowledge

| Route | E2E | Spec(s) | Notes |
|-------|-----|---------|-------|
| `/kbs/:id/sources` | D | `onboarding.spec.ts`, `processing-job.spec.ts`, `governance.spec.ts` | Paste ingest, library chrome |
| `/kbs/:id/processing` | P | `processing-job.spec.ts`, `governance.spec.ts` | `?job=`, failed filter |
| `/kbs/:id/entities` | P | `reasoning-derived.spec.ts` | Derived facts + search (API seed) |

### KB — Connectors

| Route | E2E | Spec(s) | Notes |
|-------|-----|---------|-------|
| `/kbs/:id/onboarding/data` | D | `connector-mapping-suggest.spec.ts` | SQL hint → suggest → sync |
| `…/connectors/catalog` | S | `connectors.spec.ts` | Cards, connection → new mapping |
| `…/connectors/policy` | S | `connectors.spec.ts` | Save allowlist |
| `…/connectors/mappings` | P | `connectors.spec.ts`, `connector-mapping-suggest.spec.ts` | List; suggest dialog smoke |
| `…/connectors/mappings/new` | S | `connectors.spec.ts` | Prefill from connection |
| `…/connectors/mappings/:id/edit` | P | `connector-workspace.spec.ts` | Save target class + return to list |
| `…/connectors/runs` | S | `connector-workspace.spec.ts` | After `check`, run row visible |
| `…/connectors/oauth/callback` | S | `connector-workspace.spec.ts` | Missing code/state error UI |
| Review writeback diff (connector) | P | `connectors.spec.ts` | From review queue UI |
| Mapping **Sync now** (list) | P | `connector-workspace.spec.ts` | Inbound sync toast |

### KB — Schema

| Route | E2E | Spec(s) | Notes |
|-------|-----|---------|-------|
| `/kbs/:id/ontology` | P | `governance.spec.ts`, `ontology-proposal-url.spec.ts` | Versions tab; proposal deep link |
| `/kbs/:id/analyze` | P | `analyze-hub.spec.ts` | Tabs; legacy `/sparql`, `/reasoning` redirects |
| `/kbs/:id/vocabulary` | S | `schema-surfaces.spec.ts` | Hub loads |
| `/kbs/:id/mappings` (statement / extraction) | S | `schema-surfaces.spec.ts` | Title/subtitle vs connector mappings |
| `/kbs/:id/ontology-versions` | P | `analyze-hub.spec.ts` | Via redirect/hub |
| `/kbs/:id/shacl` | S | `schema-surfaces.spec.ts` | Legacy route → ontology `?tab=shacl` |
| `/kbs/:id/alignments` | S | `schema-surfaces.spec.ts` | Legacy route → ontology `?tab=alignments` |

### KB — Govern

| Route | E2E | Spec(s) | Notes |
|-------|-----|---------|-------|
| `/kbs/:id/review` | D | `governance.spec.ts`, `connectors.spec.ts` | Conflicts, approve narrative, writeback |
| `/kbs/:id/entity-resolution` | S | `schema-surfaces.spec.ts` | Dedup scan action |
| `/kbs/:id/decisions` | P | `decisions-deep-link.spec.ts`, `governance.spec.ts` | List + `?decision=` |
| `/kbs/:id/lineage` | P | `lineage.spec.ts` | `?node=` deep link |
| `/kbs/:id/graph-diff` | P | `graph-diff.spec.ts` | `from` / `to` query |

### KB — System & account

| Route | E2E | Spec(s) | Notes |
|-------|-----|---------|-------|
| `/kbs/:id/alerts` | D | `governance.spec.ts` | Dismiss, deep links to sources/processing/review/decisions |
| `/kbs/:id/integration` | S | `mcp-integration.spec.ts` | Tab visible |
| `/kbs/:id/settings` | P | `settings-graph-audit.spec.ts`, `kb-settings-tabs.spec.ts` | Graph audit; general/members/search tabs |
| `/kbs/:id/mcp`, `/chat` (legacy) | S | `mcp-integration.spec.ts` | Redirects to integration |

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
| `connector-mapping-suggest.spec.ts` | Data onboarding wizard + mapping suggest API/UI |
| `connector-workspace.spec.ts` | Runs, mapping edit, sync now, OAuth error callback |
| `kb-settings-tabs.spec.ts` | KB settings general/members/search tabs |
| `platform-admin.spec.ts` | `/admin/users` (reuses `playwright-admin.json`) |
| `connectors.spec.ts` | KB connectors zones (catalog/policy/mappings) |
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
| `settings-graph-audit.spec.ts` | KB settings graph audit tab |
| `shell.spec.ts` | Login form |

## What to add next (suggested)

High-value gaps for UI E2E (still absent or **—** above):

- OAuth callback **success** path (mock exchange)
- Connector **REST** suggest (no SQL table hint) on mappings panel
- `/admin/kbs`, `/admin/models`, `/admin/audit` smoke

When adding specs, extend this table and link the F-* row in `docs/progress.md` if it closes a §3.1 gap.
