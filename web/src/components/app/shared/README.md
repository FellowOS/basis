# Shared app UI (`components/app/shared/`)

Cross-route React building blocks. **Not** feature routes (`modules/`) or `/admin` blocks (`components/admin/`).

| Folder | Role | Avoid confusing with |
| --- | --- | --- |
| `shell/` | Global layout: sidebar, account menu, titlebar | `workspace/frame/` (per-workspace shell) |
| `console/` | Data **page patterns**: tables, `ConsolePageLayout`, empty states | Product name “console”; not workspace frame |
| `workspace/` | Per-workspace frame + `entity-ref-line` | — |
| `primitives/` | Generic controls (editors, icons, date picker) | — |
| `effects/` | Decorative motion | — |

**Naming:** URLs stay `/workspaces/:id/*` (API resource). UI paths use **workspace** / **explorer**, not `kb/`.
