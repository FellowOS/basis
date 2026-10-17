# Agent guide (Basis)

Instructions for AI coding agents working in this repository. Humans can skim this for the same conventions.

## What this repo is

**Basis** — self-hosted knowledge platform: FastAPI backend (`basis` Python package) + React console (`web/`). Evidence ledger is canonical; graph and search are projections. See [README.md](./README.md) and [docs/design/README.md](./docs/design/README.md).

| Area | Path | Stack |
|------|------|--------|
| API | repo root (`basis/`, `admin/`) | Python 3.10+, FastAPI, Semantica SDK |
| Web | `web/` | Vite, React, React Router, Tailwind v4, shadcn |
| Explorer UI | `web/src/explorer/` | Vendored workspace UI (graph, ontology, …) |

## Before you change code

1. **Scope** — Smallest correct diff. Do not refactor or “improve” unrelated files.
2. **Match existing style** — Naming, imports (`.js` suffix in TS paths), i18n keys, console patterns.
3. **Do not hand-edit** `web/src/components/ui/*` — vendor shadcn only via CLI (see [Web UI](#web-ui-shadcn)).
4. **Commits / PRs** — Only when the user explicitly asks. Never force-push `main`, never skip hooks unless asked.
5. **Secrets** — Do not commit `.env` or credentials.

## Web UI (shadcn)

### `components/` — three roots

| Root | Path | Rules |
|------|------|--------|
| **Vendor** | `web/src/components/ui/*` | **Do not hand-edit.** Update only via `npx shadcn add …` (use `-o` to sync). |
| **Admin** | `web/src/components/admin/*` | `/admin/*` UI only (layout, SSO, access, `admin/models/`, …). |
| **App** | `web/src/components/app/*` | `shared/` (cross-product) + `kb/` + `marketing/`. |

No files at `components/` root. Full map: [web/README.md](./web/README.md).

#### `app/shared/` (cross-product)

| Path | Use for |
|------|---------|
| `app/shared/primitives/` | PublicIcon, DatePicker, editors, … |
| `app/shared/effects/` | Decorative motion. |
| `app/shared/console/` | DataTable, ConsolePageLayout, EmptyState, … |
| `app/shared/shell/` | Global layout — not `app/kb/explorer-shell/`. |

`app/kb/` and `app/marketing/` are product-specific; they may import `app/shared/*` and `ui/*`.

### Imports

- Stock shadcn → `@/components/ui/*`
- Primitives / effects → `@/components/app/shared/primitives/…`, `…/effects/…`
- Console patterns → `@/components/app/shared/console`
- Admin-only blocks → `@/components/admin/*`
- KB product → `@/components/app/kb/*`

**Direction:** `admin/` and `app/` → `ui/` and `app/shared/*`. Never `ui/` → `app/` or `admin/`.

### Card surfaces

Use `resourceCardSurfaceClass` / `cardElevationClass` from `@/lib/ui/card-surface.js` — never add these exports to `ui/card.tsx`.

### Do not (UI)

- Patch `web/src/components/ui/` for Basis branding or app APIs.
- Add styled raw `<select>` / checkbox in `web/src/pages/` or `web/src/components/admin/`.
- Put cross-product patterns under `app/kb/` — use `app/shared/console/` or `app/shared/primitives/`.
- Reintroduce a `basis-ui/` wrapper layer for styling that belongs in project CSS.

### Syncing shadcn

```bash
cd web && npx shadcn@latest add -y -o <component-names>
```

After sync: `npm run typecheck` — fix **primitives**, **shell**, and imports, not `ui/` source.

### Styling policy

- Prefer design tokens (`border-border`, `text-muted-foreground`) over one-off hex.
- **Project-wide control chrome** (field focus without ring, status badges, console outline buttons) lives in **`web/src/styles.css`** — `data-slot`, `[data-basis-app]`, utilities like `badge-status-success`, `native-select--full`.
- Explorer-specific CSS: `web/src/styles/explorer/`. Graph search dock shadows live in Explorer sources, not global CSS.

### KB Explorer layering

1. `web/src/pages/kb/*.tsx` — routes, crumbs, gates.
2. `web/src/components/app/kb/workspaces/kb-*-workspace.tsx` — lazy-load Explorer.
3. `web/src/explorer/workspaces/*/` — implementation ([explorer README](./web/src/explorer/README.md)).

### Forms and console

- Prefer shadcn **`Form`** + React Hook Form + Zod for dialogs and settings (`@/components/ui/form`).
- List pages: `ConsolePageLayout`, `DataPanel`, `DataTable`, `ToolbarSearch` from `@/components/app/shared/console`.
- Breadcrumbs: shadcn `Breadcrumb` via `PageHeader` / `Crumb[]`.

## Web i18n

- Strings in `web/src/i18n/locales/{en,zh}/*.ts` (zh mirrors `locales/en/index.ts`). React: `useI18n()` → `t.<ns>.<key>`; interpolation: `fmt()` from `@/i18n/format.js`. Non-React / Explorer: `messagesForLocale(locale)` or existing `*Copy.ts` bridges (`graphWorkspaceCopy`, `graphInspectorCopy`, …).
- **Do not** hardcode UI copy, inline `locale === 'zh' ? …`, or duplicate inspector/helpers keys. API-keyed maps (`apiErrorCodes`, audit actions, status labels, …): keep en/zh in sync.
- Tables: `t.common.emptyCell` (`—`), `t.common.ellipsis` (`…`).
- After new keys: `cd web && npm run audit:locale && npm run typecheck`.

## Verification

From `web/`:

```bash
npm run typecheck
npm test
npm run build   # when touching build-sensitive code
```

From repo root (API):

```bash
uv run pytest -q
```

Run relevant checks after substantive edits; say if something was not run.

## Python / API

- Package layout and CLI entry: `pyproject.toml` (`basis` console script).
- Migrations: `admin/migrations/`.
- Prefer existing patterns in route handlers and services; follow pytest style in `tests/`.

## Docs for specific tasks

| Task | Read |
|------|------|
| Web structure / KB folders | [web/README.md](./web/README.md) |
| Explorer vendoring | [web/src/explorer/README.md](./web/src/explorer/README.md) |
| Product / architecture | [docs/design/README.md](./docs/design/README.md) |
| OpenAPI v1 (platform + KB surfaces) | [docs/design/openapi-v1-spec.md](./docs/design/openapi-v1-spec.md), [openapi/basis-v1-platform.yaml](./openapi/basis-v1-platform.yaml), [openapi/basis-v1-kb.yaml](./openapi/basis-v1-kb.yaml) |
| Core / MCP / client SDK refactor | [docs/design/core-rest-sdk-refactor.md](./docs/design/core-rest-sdk-refactor.md) |
| KB HTTP client (`@basis/client`) | [packages/client/README.md](./packages/client/README.md) — web imports via `file:../packages/client`; full OpenAPI via `createBasisOpenApiClient` |
| Python HTTP client | [packages/client-py/README.md](./packages/client-py/README.md) — `scripts/gen-python-client.py` |
| Web ↔ operationId audit | [docs/design/web-openapi-operation-audit.md](./docs/design/web-openapi-operation-audit.md) — `scripts/audit-web-operation-ids.py` |
| HTTP in web | Typed: `openapi-client.ts` (`openApi*` / `kbOpenApi*` / `publicOpenApi*`); stream/multipart: `basis-session-fetch.ts`; paths: `kb-api-path.ts`, `api-v1-path.ts`; E2E `e2e/api-v1-path.ts` |

**Naming:** Normative HTTP = **`openapi/basis-v1.yaml`**. `basis/core/` = server operations (OpenAPI + MCP call this). **semantica** = in-process runtime. **Application SDK** = `@basis/client` (generated from OpenAPI). Server exposes **only OpenAPI + MCP** to clients.

## Out of scope unless asked

- Mass renames, directory moves, or syncing all shadcn components without a request.
- Committing drive-by README changes unrelated to the task.
- Editing generated or vendor trees except through documented sync commands.
